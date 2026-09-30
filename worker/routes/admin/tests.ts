import { Hono } from "hono";
import {
  assignmentSettings,
  saveTestBody,
  type AdminAssignment,
  type AdminQuestion,
  type AdminTestDetail,
  type AdminTestSaveResult,
  type AdminTestSummary,
  type TestKind,
} from "../../../shared/contract";
import { auditStmt, nowIso, queryAll, queryFirst, stmt } from "../../db";
import { loadQuestions } from "../../engine";
import type { AppEnv } from "../../env";
import { isAssignmentOpen } from "../../grading";
import { badRequest, conflict, idParam, notFound, readBody } from "../../http";
import { normalizeQuestionInput, type NormalizedQuestion } from "../../questionInput";
import { assertWritable, loadClassBasics } from "./common";

export const testAdminRoutes = new Hono<AppEnv>();

/* ───────────── summaries / detail ───────────── */

interface TestSummaryRow {
  id: number;
  title: string;
  description: string;
  kind: TestKind;
  current_version: number;
  updated_at: string;
  question_count: number;
  max_score: number;
  assigned: number;
  attempt_count: number;
}

const TEST_SUMMARY_SELECT = `
  SELECT t.id, t.title, t.description, t.kind, t.current_version, t.updated_at,
         (SELECT COUNT(*) FROM questions q WHERE q.test_id = t.id) AS question_count,
         (SELECT COALESCE(SUM(points), 0) FROM questions q WHERE q.test_id = t.id) AS max_score,
         (SELECT COUNT(*) FROM test_assignments ta WHERE ta.test_id = t.id) AS assigned,
         (SELECT COUNT(*) FROM attempts a JOIN test_assignments ta ON ta.id = a.assignment_id WHERE ta.test_id = t.id) AS attempt_count
    FROM tests t`;

function toSummary(r: TestSummaryRow): AdminTestSummary {
  return {
    id: r.id,
    title: r.title,
    kind: r.kind,
    questionCount: r.question_count,
    maxScore: r.max_score,
    currentVersion: r.current_version,
    assignedClassCount: r.assigned,
    attemptCount: r.attempt_count,
    updatedAt: r.updated_at,
  };
}

/** True when the current version already has attempts (→ editing questions must create a new version). */
async function currentVersionLocked(db: D1Database, testId: number, version: number): Promise<boolean> {
  const row = await queryFirst(
    db,
    `SELECT 1 AS one FROM attempts a JOIN test_versions tv ON tv.id = a.test_version_id
      WHERE tv.test_id = ? AND tv.version_no = ? LIMIT 1`,
    testId,
    version,
  );
  return row !== null;
}

async function loadTestDetail(db: D1Database, id: number): Promise<AdminTestDetail> {
  const row = await queryFirst<TestSummaryRow>(db, `${TEST_SUMMARY_SELECT} WHERE t.id = ?`, id);
  if (!row) throw notFound("Test not found.");
  const [questions, versions, locked] = await Promise.all([
    loadQuestions(db, id),
    queryAll<{ version_no: number; created_at: string; attempt_count: number }>(
      db,
      `SELECT tv.version_no, tv.created_at, (SELECT COUNT(*) FROM attempts a WHERE a.test_version_id = tv.id) AS attempt_count
         FROM test_versions tv WHERE tv.test_id = ? ORDER BY tv.version_no`,
      id,
    ),
    currentVersionLocked(db, id, row.current_version),
  ]);
  return {
    ...toSummary(row),
    description: row.description,
    questions: questions.map<AdminQuestion>((q) => ({ ...q })),
    versionLocked: locked,
    versions: versions.map((v) => ({ versionNo: v.version_no, createdAt: v.created_at, attemptCount: v.attempt_count })),
  };
}

testAdminRoutes.get("/tests", async (c) => {
  const rows = await queryAll<TestSummaryRow>(c.env.DB, `${TEST_SUMMARY_SELECT} ORDER BY t.updated_at DESC, t.id DESC`);
  return c.json<AdminTestSummary[]>(rows.map(toSummary));
});

testAdminRoutes.get("/tests/:id", async (c) => c.json(await loadTestDetail(c.env.DB, idParam(c))));

/* ───────────── create / save ───────────── */

function normalizeAll(questions: Parameters<typeof normalizeQuestionInput>[0][]): NormalizedQuestion[] {
  return questions.map((q, i) => {
    const r = normalizeQuestionInput(q, i);
    if (!r.ok) throw badRequest(r.error);
    return r.question;
  });
}

/** Canonical content used to decide whether the question list really changed. */
function contentKey(qs: Omit<NormalizedQuestion, "id">[]): string {
  return JSON.stringify(
    qs.map((q) => [q.type, q.prompt, q.imageUrl ?? null, q.options, q.answer, q.points, q.required]),
  );
}

function insertQuestionStmt(db: D1Database, testId: number, q: NormalizedQuestion, position: number): D1PreparedStatement {
  return stmt(
    db,
    `INSERT INTO questions (test_id, position, type, prompt, image_url, options, answer, points, required)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    testId,
    position,
    q.type,
    q.prompt,
    q.imageUrl,
    JSON.stringify(q.options),
    JSON.stringify(q.answer),
    q.points,
    q.required ? 1 : 0,
  );
}

testAdminRoutes.post("/tests", async (c) => {
  const body = await readBody(c, saveTestBody);
  const questions = normalizeAll(body.questions).map((q) => ({ ...q, id: undefined }));
  const db = c.env.DB;
  const now = nowIso();
  const created = await stmt(
    db,
    "INSERT INTO tests (title, description, kind, current_version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?) RETURNING id",
    body.title,
    body.description,
    body.kind,
    now,
    now,
  ).first<{ id: number }>();
  if (!created) throw new Error("Test insert returned no id");
  const id = created.id;
  try {
    await db.batch([
      ...questions.map((q, i) => insertQuestionStmt(db, id, q, i + 1)),
      auditStmt(db, c.get("admin").email, "test.create", "test", id, { title: body.title, questions: questions.length }),
    ]);
  } catch (err) {
    await stmt(db, "DELETE FROM tests WHERE id = ?", id).run(); // don't leave a half-created test behind
    throw err;
  }
  const result: AdminTestSaveResult = { test: await loadTestDetail(db, id), newVersionCreated: false };
  return c.json(result, 201);
});

/**
 * Saves the whole test in one batch. If the current version already has attempts AND the questions changed,
 * `current_version` is bumped (old attempts keep their frozen snapshot). Title/description-only edits never bump.
 */
testAdminRoutes.put("/tests/:id", async (c) => {
  const id = idParam(c);
  const body = await readBody(c, saveTestBody);
  const db = c.env.DB;
  const test = await queryFirst<{ current_version: number }>(db, "SELECT current_version FROM tests WHERE id = ?", id);
  if (!test) throw notFound("Test not found.");

  const incoming = normalizeAll(body.questions);
  const existing = await loadQuestions(db, id);
  const existingIds = new Set(existing.map((q) => q.id));
  const seen = new Set<number>();
  for (const q of incoming) {
    if (q.id === undefined) continue;
    if (!existingIds.has(q.id)) throw badRequest(`Question id ${q.id} does not belong to this test.`);
    if (seen.has(q.id)) throw badRequest(`Question id ${q.id} appears twice.`);
    seen.add(q.id);
  }

  const changed = contentKey(incoming) !== contentKey(existing);
  const locked = changed && (await currentVersionLocked(db, id, test.current_version));
  const version = locked ? test.current_version + 1 : test.current_version;
  const admin = c.get("admin");

  const statements: D1PreparedStatement[] = [
    // A snapshot of the (new) current version that nobody has used yet is stale after this save → drop it;
    // it is re-created from the saved questions when the next attempt starts.
    stmt(
      db,
      `DELETE FROM test_versions WHERE test_id = ? AND version_no = ?
         AND NOT EXISTS (SELECT 1 FROM attempts a WHERE a.test_version_id = test_versions.id)`,
      id,
      version,
    ),
    stmt(
      db,
      "UPDATE tests SET title = ?, description = ?, kind = ?, current_version = ?, updated_at = ? WHERE id = ?",
      body.title,
      body.description,
      body.kind,
      version,
      nowIso(),
      id,
    ),
  ];
  for (const q of existing) {
    if (!seen.has(q.id)) statements.push(stmt(db, "DELETE FROM questions WHERE id = ? AND test_id = ?", q.id, id));
  }
  incoming.forEach((q, i) => {
    if (q.id === undefined) {
      statements.push(insertQuestionStmt(db, id, q, i + 1));
    } else {
      statements.push(
        stmt(
          db,
          `UPDATE questions SET position = ?, type = ?, prompt = ?, image_url = ?, options = ?, answer = ?, points = ?, required = ?
            WHERE id = ? AND test_id = ?`,
          i + 1,
          q.type,
          q.prompt,
          q.imageUrl,
          JSON.stringify(q.options),
          JSON.stringify(q.answer),
          q.points,
          q.required ? 1 : 0,
          q.id,
          id,
        ),
      );
    }
  });
  statements.push(
    auditStmt(db, admin.email, "test.update", "test", id, {
      questions: incoming.length,
      version,
      newVersionCreated: locked,
    }),
  );
  await db.batch(statements);

  const result: AdminTestSaveResult = { test: await loadTestDetail(db, id), newVersionCreated: locked };
  return c.json(result);
});

testAdminRoutes.delete("/tests/:id", async (c) => {
  const id = idParam(c);
  const db = c.env.DB;
  const t = await queryFirst<{ title: string }>(db, "SELECT title FROM tests WHERE id = ?", id);
  if (!t) throw notFound("Test not found.");
  const used = await queryFirst(
    db,
    "SELECT 1 AS one FROM attempts a JOIN test_assignments ta ON ta.id = a.assignment_id WHERE ta.test_id = ? LIMIT 1",
    id,
  );
  if (used) throw conflict("Students have already taken this test, so it cannot be deleted.", "has_attempts");
  await db.batch([
    stmt(db, "DELETE FROM test_assignments WHERE test_id = ?", id),
    stmt(db, "DELETE FROM test_versions WHERE test_id = ?", id),
    stmt(db, "DELETE FROM questions WHERE test_id = ?", id),
    stmt(db, "DELETE FROM tests WHERE id = ?", id),
    auditStmt(db, c.get("admin").email, "test.delete", "test", id, { title: t.title }),
  ]);
  return c.json({ ok: true as const });
});

/* ───────────── assignments ───────────── */

interface AssignmentAdminRow {
  id: number;
  test_id: number;
  class_id: number;
  class_name: string;
  class_status: "active" | "archived";
  time_limit_min: number | null;
  max_attempts: number | null;
  score_policy: "highest" | "latest" | "first";
  availability: "manual" | "scheduled";
  is_open: number;
  opens_at: string | null;
  closes_at: string | null;
  show_answers: number;
  required_first: number;
  student_count: number;
  submitted_count: number;
}

const ASSIGNMENT_ADMIN_SELECT = `
  SELECT ta.id, ta.test_id, ta.class_id, c.name AS class_name, c.status AS class_status,
         ta.time_limit_min, ta.max_attempts, ta.score_policy, ta.availability, ta.is_open, ta.opens_at, ta.closes_at,
         ta.show_answers, ta.required_first,
         (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = ta.class_id AND e.status = 'active') AS student_count,
         (SELECT COUNT(DISTINCT a.enrollment_id)
            FROM attempts a
            JOIN enrollments e ON e.id = a.enrollment_id
            JOIN test_assignments ta2 ON ta2.id = a.assignment_id
           WHERE e.class_id = ta.class_id AND e.status = 'active' AND ta2.test_id = ta.test_id
             AND a.submitted_at IS NOT NULL) AS submitted_count
    FROM test_assignments ta JOIN classes c ON c.id = ta.class_id`;

function toAdminAssignment(r: AssignmentAdminRow, now: Date): AdminAssignment {
  const isOpen = r.is_open === 1;
  return {
    id: r.id,
    testId: r.test_id,
    classId: r.class_id,
    className: r.class_name,
    timeLimitMin: r.time_limit_min,
    maxAttempts: r.max_attempts,
    scorePolicy: r.score_policy,
    availability: r.availability,
    isOpen,
    opensAt: r.opens_at,
    closesAt: r.closes_at,
    showAnswers: r.show_answers === 1,
    requiredFirst: r.required_first === 1,
    currentlyOpen: isAssignmentOpen(
      { availability: r.availability, isOpen, opensAt: r.opens_at, closesAt: r.closes_at, classArchived: r.class_status === "archived" },
      now,
    ),
    submittedCount: r.submitted_count,
    studentCount: r.student_count,
  };
}

testAdminRoutes.get("/tests/:id/assignments", async (c) => {
  const id = idParam(c);
  const db = c.env.DB;
  if (!(await queryFirst(db, "SELECT 1 AS one FROM tests WHERE id = ?", id))) throw notFound("Test not found.");
  const rows = await queryAll<AssignmentAdminRow>(db, `${ASSIGNMENT_ADMIN_SELECT} WHERE ta.test_id = ? ORDER BY c.academic_year DESC, c.semester DESC, c.section`, id);
  const now = new Date();
  return c.json<AdminAssignment[]>(rows.map((r) => toAdminAssignment(r, now)));
});

testAdminRoutes.put("/tests/:id/assignments/:classId", async (c) => {
  const testId = idParam(c);
  const classId = idParam(c, "classId");
  const s = await readBody(c, assignmentSettings);
  const db = c.env.DB;
  const test = await queryFirst<{ title: string }>(db, "SELECT title FROM tests WHERE id = ?", testId);
  if (!test) throw notFound("Test not found.");
  const cls = await loadClassBasics(db, classId);
  assertWritable(cls);

  const opensAt = s.opensAt ? new Date(s.opensAt).toISOString() : null;
  const closesAt = s.closesAt ? new Date(s.closesAt).toISOString() : null;
  if (s.availability === "scheduled" && opensAt && closesAt && Date.parse(opensAt) >= Date.parse(closesAt)) {
    throw badRequest("closesAt must be after opensAt.");
  }
  const now = nowIso();
  await db.batch([
    stmt(
      db,
      `INSERT INTO test_assignments (test_id, class_id, time_limit_min, max_attempts, score_policy, availability, is_open,
                                     opens_at, closes_at, show_answers, required_first, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (test_id, class_id) DO UPDATE SET
         time_limit_min = excluded.time_limit_min, max_attempts = excluded.max_attempts, score_policy = excluded.score_policy,
         availability = excluded.availability, is_open = excluded.is_open, opens_at = excluded.opens_at,
         closes_at = excluded.closes_at, show_answers = excluded.show_answers, required_first = excluded.required_first,
         updated_at = excluded.updated_at`,
      testId,
      classId,
      s.timeLimitMin,
      s.maxAttempts,
      s.scorePolicy,
      s.availability,
      s.isOpen ? 1 : 0,
      opensAt,
      closesAt,
      s.showAnswers ? 1 : 0,
      s.requiredFirst ? 1 : 0,
      now,
      now,
    ),
    auditStmt(db, c.get("admin").email, "assignment.upsert", "test", testId, { classId, ...s, opensAt, closesAt }),
  ]);
  const row = await queryFirst<AssignmentAdminRow>(db, `${ASSIGNMENT_ADMIN_SELECT} WHERE ta.test_id = ? AND ta.class_id = ?`, testId, classId);
  if (!row) throw new Error("Assignment not found after upsert");
  return c.json(toAdminAssignment(row, new Date()));
});

testAdminRoutes.delete("/tests/:id/assignments/:classId", async (c) => {
  const testId = idParam(c);
  const classId = idParam(c, "classId");
  const db = c.env.DB;
  const asg = await queryFirst<{ id: number }>(
    db,
    "SELECT id FROM test_assignments WHERE test_id = ? AND class_id = ?",
    testId,
    classId,
  );
  if (!asg) throw notFound("This test is not assigned to that class.");
  if (await queryFirst(db, "SELECT 1 AS one FROM attempts WHERE assignment_id = ? LIMIT 1", asg.id)) {
    throw conflict("Students have already taken this test in that class, so it cannot be unassigned.", "has_attempts");
  }
  await db.batch([
    stmt(db, "DELETE FROM test_assignments WHERE id = ?", asg.id),
    auditStmt(db, c.get("admin").email, "assignment.delete", "test", testId, { classId }),
  ]);
  return c.json({ ok: true as const });
});

