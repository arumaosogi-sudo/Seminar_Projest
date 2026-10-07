/**
 * Test engine (D1-bound part). Pure rules live in grading.ts. docs/ARCHITECTURE.md §4.
 */
import type {
  AnswerValue,
  AttemptInProgress,
  AttemptResult,
  Availability,
  ScorePolicy,
  StudentQuestion,
  StudentTestItem,
  TestKind,
} from "../shared/contract";
import { nowIso, parseJson, queryAll, queryFirst, stmt } from "./db";
import {
  canRevealAnswers,
  displayCorrectAnswer,
  gradeAttempt,
  isAttemptExpired,
  isAssignmentOpen,
  pickCountedAttempt,
  type SnapshotQuestion,
  type TestSnapshot,
  type WindowSettings,
} from "./grading";
import { conflict } from "./http";

/* ───────────── rows ───────────── */

export interface AssignmentRow {
  id: number;
  test_id: number;
  class_id: number;
  time_limit_min: number | null;
  max_attempts: number | null;
  score_policy: ScorePolicy;
  availability: Availability;
  is_open: number;
  opens_at: string | null;
  closes_at: string | null;
  show_answers: number;
  required_first: number;
  class_status: "active" | "archived";
  title: string;
  kind: TestKind;
  current_version: number;
}

export interface AttemptRow {
  id: number;
  enrollment_id: number;
  assignment_id: number;
  test_version_id: number;
  started_at: string;
  deadline_at: string | null;
  submitted_at: string | null;
  answers: string;
  score: number | null;
  max_score: number | null;
  auto_submitted: number;
  test_id: number;
}

const ASSIGNMENT_SELECT = `
  SELECT ta.id, ta.test_id, ta.class_id, ta.time_limit_min, ta.max_attempts, ta.score_policy, ta.availability,
         ta.is_open, ta.opens_at, ta.closes_at, ta.show_answers, ta.required_first,
         c.status AS class_status, t.title, t.kind, t.current_version
    FROM test_assignments ta
    JOIN tests t ON t.id = ta.test_id
    JOIN classes c ON c.id = ta.class_id`;

const ATTEMPT_SELECT = `
  SELECT a.id, a.enrollment_id, a.assignment_id, a.test_version_id, a.started_at, a.deadline_at, a.submitted_at,
         a.answers, a.score, a.max_score, a.auto_submitted, ta.test_id
    FROM attempts a JOIN test_assignments ta ON ta.id = a.assignment_id`;

export function windowOf(a: AssignmentRow): WindowSettings {
  return {
    availability: a.availability,
    isOpen: a.is_open === 1,
    opensAt: a.opens_at,
    closesAt: a.closes_at,
    classArchived: a.class_status === "archived",
  };
}

export async function loadAssignment(db: D1Database, id: number): Promise<AssignmentRow | null> {
  return queryFirst<AssignmentRow>(db, `${ASSIGNMENT_SELECT} WHERE ta.id = ?`, id);
}

export async function loadClassAssignments(db: D1Database, classId: number): Promise<AssignmentRow[]> {
  return queryAll<AssignmentRow>(db, `${ASSIGNMENT_SELECT} WHERE ta.class_id = ? ORDER BY ta.id`, classId);
}

export async function loadAttempt(db: D1Database, id: number): Promise<AttemptRow | null> {
  return queryFirst<AttemptRow>(db, `${ATTEMPT_SELECT} WHERE a.id = ?`, id);
}

export async function loadEnrollmentAttempts(db: D1Database, enrollmentId: number): Promise<AttemptRow[]> {
  return queryAll<AttemptRow>(db, `${ATTEMPT_SELECT} WHERE a.enrollment_id = ? ORDER BY a.id`, enrollmentId);
}

/* ───────────── snapshots / versions ───────────── */

/** Per-request cache: snapshots are immutable, so caching by version id is always safe. */
export class SnapshotCache {
  private readonly map = new Map<number, TestSnapshot>();
  private readonly db: D1Database;
  constructor(db: D1Database) {
    this.db = db;
  }
  async get(versionId: number): Promise<TestSnapshot> {
    const hit = this.map.get(versionId);
    if (hit) return hit;
    const row = await queryFirst<{ snapshot: string }>(this.db, "SELECT snapshot FROM test_versions WHERE id = ?", versionId);
    const snap = parseJson<TestSnapshot>(row?.snapshot, { title: "", questions: [] });
    this.map.set(versionId, snap);
    return snap;
  }
}

interface QuestionRow {
  id: number;
  position: number;
  type: SnapshotQuestion["type"];
  prompt: string;
  image_url: string | null;
  options: string;
  answer: string;
  points: number;
  required: number;
}

export async function loadQuestions(db: D1Database, testId: number): Promise<SnapshotQuestion[]> {
  const rows = await queryAll<QuestionRow>(
    db,
    "SELECT id, position, type, prompt, image_url, options, answer, points, required FROM questions WHERE test_id = ? ORDER BY position, id",
    testId,
  );
  return rows.map((r) => ({
    id: r.id,
    position: r.position,
    type: r.type,
    prompt: r.prompt,
    imageUrl: r.image_url,
    options: parseJson(r.options, []),
    answer: parseJson<AnswerValue>(r.answer, ""),
    points: r.points,
    required: r.required === 1,
  }));
}

/** Returns the id of the frozen (test, current_version) snapshot, creating it from the live questions if needed. */
export async function ensureCurrentVersion(db: D1Database, testId: number): Promise<number> {
  const test = await queryFirst<{ title: string; current_version: number }>(
    db,
    "SELECT title, current_version FROM tests WHERE id = ?",
    testId,
  );
  if (!test) throw conflict("This test no longer exists.");
  const existing = await queryFirst<{ id: number }>(
    db,
    "SELECT id FROM test_versions WHERE test_id = ? AND version_no = ?",
    testId,
    test.current_version,
  );
  if (existing) return existing.id;
  const questions = await loadQuestions(db, testId);
  if (questions.length === 0) throw conflict("This test has no questions yet.", "empty_test");
  const snapshot: TestSnapshot = { title: test.title, questions: questions.map((q, i) => ({ ...q, position: i + 1 })) };
  // INSERT OR IGNORE + re-select: two students starting at the same moment end up on the same snapshot.
  await stmt(
    db,
    "INSERT OR IGNORE INTO test_versions (test_id, version_no, snapshot, created_at) VALUES (?, ?, ?, ?)",
    testId,
    test.current_version,
    JSON.stringify(snapshot),
    nowIso(),
  ).run();
  const row = await queryFirst<{ id: number }>(
    db,
    "SELECT id FROM test_versions WHERE test_id = ? AND version_no = ?",
    testId,
    test.current_version,
  );
  if (!row) throw new Error("Failed to create test version");
  return row.id;
}

/* ───────────── attempt lifecycle ───────────── */

/** Grades a submitted attempt from the answers stored in the database and writes score/max_score. */
async function gradeStored(db: D1Database, attemptId: number, snapshots: SnapshotCache): Promise<AttemptRow | null> {
  const row = await loadAttempt(db, attemptId);
  if (!row || !row.submitted_at) return row;
  const snap = await snapshots.get(row.test_version_id);
  const g = gradeAttempt(snap, parseJson<Record<string, AnswerValue>>(row.answers, {}));
  await stmt(db, "UPDATE attempts SET score = ?, max_score = ? WHERE id = ?", g.score, g.maxScore, attemptId).run();
  return { ...row, score: g.score, max_score: g.maxScore };
}

/**
 * Submits an attempt in two steps so the score always matches the stored answers:
 *  1. claim — `UPDATE … SET submitted_at WHERE submitted_at IS NULL` (only the first submit wins; saves stop matching),
 *  2. re-read the answers now frozen in the row, grade them and write the score.
 * Also repairs a submitted attempt whose score was never written (e.g. isolate died between the two steps).
 */
export async function finalizeAttempt(
  db: D1Database,
  attempt: AttemptRow,
  snapshots: SnapshotCache,
  auto: boolean,
  now: Date,
): Promise<AttemptRow> {
  if (attempt.submitted_at) {
    if (attempt.score !== null) return attempt;
    return (await gradeStored(db, attempt.id, snapshots)) ?? attempt;
  }
  const claim = await stmt(
    db,
    "UPDATE attempts SET submitted_at = ?, auto_submitted = ? WHERE id = ? AND submitted_at IS NULL",
    nowIso(now),
    auto ? 1 : 0,
    attempt.id,
  ).run();
  if (!claim.meta.changes) {
    // Someone else submitted first — make sure it is graded, then return their result.
    const other = await loadAttempt(db, attempt.id);
    if (other && other.submitted_at && other.score === null) return (await gradeStored(db, attempt.id, snapshots)) ?? other;
    return other ?? attempt;
  }
  return (await gradeStored(db, attempt.id, snapshots)) ?? attempt;
}

/** Lazy auto-submit: submits every expired in-progress attempt of this enrollment. Returns the refreshed list. */
export async function sweepExpired(
  db: D1Database,
  attempts: AttemptRow[],
  assignments: Map<number, AssignmentRow>,
  snapshots: SnapshotCache,
  now: Date,
): Promise<AttemptRow[]> {
  const out: AttemptRow[] = [];
  for (const a of attempts) {
    if (a.submitted_at && a.score === null) {
      out.push(await finalizeAttempt(db, a, snapshots, false, now)); // repair ungraded submission
      continue;
    }
    if (!a.submitted_at) {
      const asg = assignments.get(a.assignment_id) ?? (await loadAssignment(db, a.assignment_id));
      if (asg && isAttemptExpired(a.deadline_at, windowOf(asg), now)) {
        out.push(await finalizeAttempt(db, a, snapshots, true, now));
        continue;
      }
    }
    out.push(a);
  }
  return out;
}

export function toStudentQuestion(q: SnapshotQuestion): StudentQuestion {
  return {
    id: q.id,
    position: q.position,
    type: q.type,
    prompt: q.prompt,
    imageUrl: q.imageUrl,
    options: q.options.map((o) => ({ id: o.id, text: o.text })),
    points: q.points,
    required: q.required,
  };
}

/** Attempts of the same enrollment on the same test (any assignment — attempts follow a moved enrollment). */
export function sameTestAttempts(all: AttemptRow[], testId: number): AttemptRow[] {
  return all.filter((a) => a.test_id === testId);
}

function submittedLike(attempts: AttemptRow[]) {
  return attempts
    .filter((a) => a.submitted_at !== null)
    .map((a) => ({ id: a.id, score: a.score ?? 0, submittedAt: a.submitted_at as string, row: a }));
}

export function countedAttempt(attempts: AttemptRow[], policy: ScorePolicy): AttemptRow | null {
  return pickCountedAttempt(submittedLike(attempts), policy)?.row ?? null;
}

export async function toInProgress(
  attempt: AttemptRow,
  asg: AssignmentRow,
  snapshots: SnapshotCache,
  attemptNumber: number,
  now: Date,
): Promise<AttemptInProgress> {
  const snap = await snapshots.get(attempt.test_version_id);
  return {
    attemptId: attempt.id,
    assignmentId: attempt.assignment_id,
    title: snap.title || asg.title,
    status: "in_progress",
    startedAt: attempt.started_at,
    deadlineAt: attempt.deadline_at,
    serverNow: nowIso(now),
    attemptNumber,
    maxAttempts: asg.max_attempts,
    questions: snap.questions.map(toStudentQuestion),
    answers: parseJson<Record<string, AnswerValue>>(attempt.answers, {}),
  };
}

export async function toResult(
  attempt: AttemptRow,
  asg: AssignmentRow,
  snapshots: SnapshotCache,
  attemptNumber: number,
  submittedCount: number,
  now: Date,
): Promise<AttemptResult> {
  const snap = await snapshots.get(attempt.test_version_id);
  const answers = parseJson<Record<string, AnswerValue>>(attempt.answers, {});
  let review: AttemptResult["review"] = null;
  const attemptsLeft = asg.max_attempts === null ? null : Math.max(0, asg.max_attempts - submittedCount);
  // Never reveal answers while they could still be used to improve the score (see canRevealAnswers).
  const reveal = canRevealAnswers({
    showAnswers: asg.show_answers === 1,
    submitted: attempt.submitted_at !== null,
    attemptsLeft,
    assignmentOpen: isAssignmentOpen(windowOf(asg), now),
  });
  if (reveal) {
    const g = gradeAttempt(snap, answers);
    const byId = new Map(g.items.map((i) => [i.questionId, i]));
    review = snap.questions.map((q) => {
      const item = byId.get(q.id);
      return {
        questionId: q.id,
        position: q.position,
        type: q.type,
        prompt: q.prompt,
        // Option texts let the result page show "Actin, Tropomyosin" instead of option ids.
        options: q.options.map((o) => ({ id: o.id, text: o.text })),
        yourAnswer: answers[String(q.id)] ?? null,
        correctAnswer: displayCorrectAnswer(q),
        correct: item?.correct ?? false,
        points: q.points,
        earned: item?.earned ?? 0,
      };
    });
  }
  return {
    attemptId: attempt.id,
    assignmentId: attempt.assignment_id,
    title: snap.title || asg.title,
    status: "submitted",
    startedAt: attempt.started_at,
    submittedAt: attempt.submitted_at ?? attempt.started_at,
    autoSubmitted: attempt.auto_submitted === 1,
    score: attempt.score ?? 0,
    maxScore: attempt.max_score ?? 0,
    attemptNumber,
    attemptsLeft,
    review,
  };
}

/** 1-based position of `attemptId` among the enrollment's attempts on the same test. */
export function attemptNumberOf(sameTest: AttemptRow[], attemptId: number): number {
  const ids = sameTest.map((a) => a.id).sort((a, b) => a - b);
  const idx = ids.indexOf(attemptId);
  return idx === -1 ? ids.length + 1 : idx + 1;
}

/* ───────────── student test list / status ───────────── */

export interface StudentTestState {
  assignment: AssignmentRow;
  item: StudentTestItem;
  submittedAny: boolean;
}

/**
 * Computes the student's view of every assignment of their class (auto-submitting expired attempts first).
 * questionCount/maxScore describe the current version of the test.
 */
export async function studentTestStates(db: D1Database, enrollmentId: number, classId: number, now: Date): Promise<StudentTestState[]> {
  const assignments = await loadClassAssignments(db, classId);
  if (assignments.length === 0) return [];
  const byId = new Map(assignments.map((a) => [a.id, a]));
  const snapshots = new SnapshotCache(db);
  const attempts = await sweepExpired(db, await loadEnrollmentAttempts(db, enrollmentId), byId, snapshots, now);

  const qStats = await queryAll<{ test_id: number; n: number; pts: number }>(
    db,
    `SELECT test_id, COUNT(*) AS n, COALESCE(SUM(points), 0) AS pts FROM questions
      WHERE test_id IN (SELECT test_id FROM test_assignments WHERE class_id = ?) GROUP BY test_id`,
    classId,
  );
  const qByTest = new Map(qStats.map((q) => [q.test_id, q]));

  return assignments.map((asg) => {
    const mine = sameTestAttempts(attempts, asg.test_id);
    const submitted = mine.filter((a) => a.submitted_at !== null);
    const inProgress = mine.find((a) => a.submitted_at === null) ?? null;
    const open = isAssignmentOpen(windowOf(asg), now);
    const counted = countedAttempt(mine, asg.score_policy);
    const lastSubmitted = [...submitted].sort((a, b) => (b.submitted_at as string).localeCompare(a.submitted_at as string) || b.id - a.id)[0];
    const canStartMore = asg.max_attempts === null || submitted.length < asg.max_attempts;

    let status: StudentTestItem["status"];
    if (inProgress) status = "in_progress";
    else if (open) status = canStartMore ? "open" : "submitted";
    else if (submitted.length > 0) status = "submitted";
    else if (asg.class_status === "archived") status = "closed";
    else if (asg.availability === "scheduled" && asg.opens_at && now.getTime() < Date.parse(asg.opens_at)) status = "not_open";
    else if (asg.availability === "scheduled") status = "closed";
    else status = "not_open";

    const q = qByTest.get(asg.test_id);
    return {
      assignment: asg,
      submittedAny: submitted.length > 0,
      item: {
        assignmentId: asg.id,
        testId: asg.test_id,
        title: asg.title,
        kind: asg.kind,
        questionCount: q?.n ?? 0,
        timeLimitMin: asg.time_limit_min,
        maxAttempts: asg.max_attempts,
        attemptsUsed: submitted.length,
        scorePolicy: asg.score_policy,
        isOpen: open,
        opensAt: asg.opens_at,
        closesAt: asg.closes_at,
        status,
        inProgressAttemptId: inProgress?.id ?? null,
        countedScore: counted?.score ?? null,
        maxScore: counted?.max_score ?? (q ? q.pts : null),
        lastSubmittedAttemptId: lastSubmitted?.id ?? null,
      },
    };
  });
}
