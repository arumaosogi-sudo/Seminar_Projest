import { Hono } from "hono";
import type { AdminResults, AnswerValue, EnrollmentStatus, ScorePolicy, TestKind } from "../../../shared/contract";
import { parseJson, placeholders, queryAll, type SqlValue } from "../../db";
import { SnapshotCache } from "../../engine";
import type { AppEnv } from "../../env";
import { histogram, isCorrect, pickCountedAttempt, round2, scoreStats } from "../../grading";
import { badRequest } from "../../http";
import { ANONYMIZED_LABEL, loadClassBasics } from "./common";

export const resultRoutes = new Hono<AppEnv>();

const MAX_TESTS = 20;

interface EnrollmentRow {
  id: number;
  status: EnrollmentStatus;
  class_id: number;
  class_name: string;
  student_code: string | null;
  first_name: string | null;
}

interface AttemptRow {
  id: number;
  enrollment_id: number;
  test_id: number;
  test_version_id: number;
  answers: string;
  score: number;
  submitted_at: string;
}

/**
 * GET /api/admin/results?classId=&testIds=1,2&status=all
 * Counted score per student/test follows the score policy of the test's assignment in the student's class.
 * Withdrawn enrollments are excluded unless status=all.
 */
resultRoutes.get("/results", async (c) => {
  const db = c.env.DB;
  const classIdRaw = c.req.query("classId");
  const includeWithdrawn = c.req.query("status") === "all";
  let classId: number | null = null;
  if (classIdRaw) {
    if (!/^\d+$/.test(classIdRaw)) throw badRequest("classId must be a number.");
    classId = Number(classIdRaw);
    await loadClassBasics(db, classId);
  }
  const classWhere = classId === null ? "c.status = 'active'" : "c.id = ?";
  const classParams: SqlValue[] = classId === null ? [] : [classId];

  // Tests: explicit list or every test assigned to the selected classes.
  let testIds: number[];
  const testIdsRaw = c.req.query("testIds");
  if (testIdsRaw) {
    const parts = testIdsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.some((p) => !/^\d+$/.test(p))) throw badRequest("testIds must be a comma-separated list of numbers.");
    testIds = [...new Set(parts.map(Number))];
    if (testIds.length > MAX_TESTS) throw badRequest(`Select at most ${MAX_TESTS} tests.`);
  } else {
    const rows = await queryAll<{ test_id: number }>(
      db,
      `SELECT DISTINCT ta.test_id FROM test_assignments ta JOIN classes c ON c.id = ta.class_id WHERE ${classWhere} LIMIT ${MAX_TESTS}`,
      ...classParams,
    );
    testIds = rows.map((r) => r.test_id);
  }

  const enrollments = await queryAll<EnrollmentRow>(
    db,
    `SELECT e.id, e.status, e.class_id, c.name AS class_name, s.student_code, s.first_name
       FROM enrollments e JOIN students s ON s.id = e.student_id JOIN classes c ON c.id = e.class_id
      WHERE ${classWhere} ${includeWithdrawn ? "" : "AND e.status = 'active'"}
      ORDER BY c.academic_year DESC, c.semester DESC, c.section, s.student_code`,
    ...classParams,
  );

  const empty: AdminResults = {
    classId,
    tests: [],
    paired: null,
    distribution: [],
    itemAnalysis: [],
    rows: enrollments.map((e) => ({
      studentCode: e.student_code ?? ANONYMIZED_LABEL,
      firstName: e.first_name,
      className: e.class_name,
      enrollmentStatus: e.status,
      scores: {},
    })),
  };
  if (testIds.length === 0) return c.json(empty);

  const inTests = placeholders(testIds.length);
  const [tests, policies, versions, attempts] = await Promise.all([
    queryAll<{ id: number; title: string; kind: TestKind; current_version: number; max_score: number }>(
      db,
      `SELECT t.id, t.title, t.kind, t.current_version,
              (SELECT COALESCE(SUM(points), 0) FROM questions q WHERE q.test_id = t.id) AS max_score
         FROM tests t WHERE t.id IN (${inTests}) ORDER BY t.id`,
      ...testIds,
    ),
    queryAll<{ test_id: number; class_id: number; score_policy: ScorePolicy }>(
      db,
      `SELECT test_id, class_id, score_policy FROM test_assignments WHERE test_id IN (${inTests})`,
      ...testIds,
    ),
    queryAll<{ id: number; test_id: number; version_no: number }>(
      db,
      `SELECT id, test_id, version_no FROM test_versions WHERE test_id IN (${inTests})`,
      ...testIds,
    ),
    queryAll<AttemptRow>(
      db,
      `SELECT a.id, a.enrollment_id, ta.test_id, a.test_version_id, a.answers, a.score, a.submitted_at
         FROM attempts a
         JOIN test_assignments ta ON ta.id = a.assignment_id
         JOIN enrollments e ON e.id = a.enrollment_id
         JOIN classes c ON c.id = e.class_id
        WHERE a.submitted_at IS NOT NULL AND ta.test_id IN (${inTests}) AND ${classWhere}
              ${includeWithdrawn ? "" : "AND e.status = 'active'"}`,
      ...testIds,
      ...classParams,
    ),
  ]);

  const policyOf = new Map(policies.map((p) => [`${p.class_id}:${p.test_id}`, p.score_policy]));
  const versionNo = new Map(versions.map((v) => [v.id, v]));
  const enrollmentById = new Map(enrollments.map((e) => [e.id, e]));

  // counted[testId][enrollmentId] = score
  const counted = new Map<number, Map<number, number>>();
  for (const t of tests) {
    const perEnrollment = new Map<number, AttemptRow[]>();
    for (const a of attempts) {
      if (a.test_id !== t.id) continue;
      const list = perEnrollment.get(a.enrollment_id) ?? [];
      list.push(a);
      perEnrollment.set(a.enrollment_id, list);
    }
    const scores = new Map<number, number>();
    for (const [enrollmentId, list] of perEnrollment) {
      const e = enrollmentById.get(enrollmentId);
      if (!e) continue;
      const policy = policyOf.get(`${e.class_id}:${t.id}`) ?? "highest";
      const pick = pickCountedAttempt(
        list.map((a) => ({ id: a.id, score: a.score ?? 0, submittedAt: a.submitted_at })),
        policy,
      );
      if (pick) scores.set(enrollmentId, pick.score);
    }
    counted.set(t.id, scores);
  }

  // Item analysis on the current version (or the newest version that has submissions).
  const snapshots = new SnapshotCache(db);
  const itemAnalysis: AdminResults["itemAnalysis"] = [];
  for (const t of tests) {
    const mine = attempts.filter((a) => a.test_id === t.id);
    if (mine.length === 0) {
      itemAnalysis.push({ testId: t.id, items: [] });
      continue;
    }
    const byVersion = new Map<number, AttemptRow[]>();
    for (const a of mine) byVersion.set(a.test_version_id, [...(byVersion.get(a.test_version_id) ?? []), a]);
    const chosen = [...byVersion.keys()].sort(
      (x, y) => (versionNo.get(y)?.version_no ?? 0) - (versionNo.get(x)?.version_no ?? 0),
    )[0];
    const snap = await snapshots.get(chosen);
    const list = byVersion.get(chosen) ?? [];
    const parsed = list.map((a) => parseJson<Record<string, AnswerValue>>(a.answers, {}));
    itemAnalysis.push({
      testId: t.id,
      items: snap.questions.map((q) => {
        const correct = parsed.filter((ans) => isCorrect(q, ans[String(q.id)])).length;
        return {
          questionId: q.id,
          position: q.position,
          prompt: q.prompt,
          percentCorrect: list.length ? Math.round((correct / list.length) * 1000) / 10 : 0,
          n: list.length,
        };
      }),
    });
  }

  // Paired pre → post when exactly one pretest and one posttest are selected.
  const pres = tests.filter((t) => t.kind === "pretest");
  const posts = tests.filter((t) => t.kind === "posttest");
  let paired: AdminResults["paired"] = null;
  if (pres.length === 1 && posts.length === 1) {
    const pre = counted.get(pres[0].id) ?? new Map<number, number>();
    const post = counted.get(posts[0].id) ?? new Map<number, number>();
    const gains: number[] = [];
    for (const [enrollmentId, preScore] of pre) {
      const postScore = post.get(enrollmentId);
      if (postScore !== undefined) gains.push(postScore - preScore);
    }
    paired = {
      n: gains.length,
      meanGain: gains.length ? round2(gains.reduce((s, g) => s + g, 0) / gains.length) : null,
      improved: gains.filter((g) => g > 0).length,
    };
  }

  const result: AdminResults = {
    classId,
    tests: tests.map((t) => ({
      testId: t.id,
      title: t.title,
      kind: t.kind,
      maxScore: t.max_score,
      stats: scoreStats([...(counted.get(t.id)?.values() ?? [])], t.max_score),
    })),
    paired,
    distribution: tests.map((t) => ({ testId: t.id, bins: histogram([...(counted.get(t.id)?.values() ?? [])], t.max_score) })),
    itemAnalysis,
    rows: enrollments.map((e) => ({
      studentCode: e.student_code ?? ANONYMIZED_LABEL,
      firstName: e.first_name,
      className: e.class_name,
      enrollmentStatus: e.status,
      scores: Object.fromEntries(tests.map((t) => [String(t.id), counted.get(t.id)?.get(e.id) ?? null])),
    })),
  };
  return c.json(result);
});
