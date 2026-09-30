import { Hono, type Context } from "hono";
import { saveAnswersBody, startAttemptBody, type AnswerValue } from "../../shared/contract";
import { requireStudent } from "../auth";
import { nowIso, parseJson, stmt } from "../db";
import {
  SnapshotCache,
  attemptNumberOf,
  ensureCurrentVersion,
  finalizeAttempt,
  loadAssignment,
  loadAttempt,
  loadEnrollmentAttempts,
  sameTestAttempts,
  sweepExpired,
  toInProgress,
  toResult,
  windowOf,
  type AssignmentRow,
  type AttemptRow,
} from "../engine";
import type { AppEnv } from "../env";
import { computeDeadline, isAnswered, isAssignmentOpen, isAttemptExpired, normalizeStudentAnswer } from "../grading";
import { badRequest, conflict, forbidden, idParam, notFound, readBody } from "../http";

export const attemptRoutes = new Hono<AppEnv>();
attemptRoutes.use("/attempts", requireStudent);
attemptRoutes.use("/attempts/*", requireStudent);

const MAX_ANSWER_KEYS = 200;

function currentEnrollment(c: Context<AppEnv>) {
  const e = c.get("student").enrollment;
  if (!e) throw forbidden("Please join your section first (scan the section QR code).", "no_enrollment");
  return e;
}

/** Loads an attempt that belongs to the caller's active enrollment (404 otherwise — no existence leak). */
async function ownAttempt(c: Context<AppEnv>, id: number): Promise<{ attempt: AttemptRow; asg: AssignmentRow }> {
  const e = currentEnrollment(c);
  const attempt = await loadAttempt(c.env.DB, id);
  if (!attempt || attempt.enrollment_id !== e.id) throw notFound("Attempt not found.");
  const asg = await loadAssignment(c.env.DB, attempt.assignment_id);
  if (!asg) throw notFound("Attempt not found.");
  return { attempt, asg };
}

async function render(db: D1Database, attempt: AttemptRow, asg: AssignmentRow, snapshots: SnapshotCache, now: Date) {
  const mine = sameTestAttempts(await loadEnrollmentAttempts(db, attempt.enrollment_id), attempt.test_id);
  const number = attemptNumberOf(mine, attempt.id);
  if (attempt.submitted_at) {
    const submittedCount = mine.filter((a) => a.submitted_at !== null).length;
    return toResult(attempt, asg, snapshots, number, submittedCount, now);
  }
  return toInProgress(attempt, asg, snapshots, number, now);
}

/** Start a new attempt, or resume the one in progress. */
attemptRoutes.post("/attempts", async (c) => {
  const body = await readBody(c, startAttemptBody);
  const e = currentEnrollment(c);
  const db = c.env.DB;
  const asg = await loadAssignment(db, body.assignmentId);
  if (!asg || asg.class_id !== e.classId) throw notFound("Test not found.");

  const now = new Date();
  const snapshots = new SnapshotCache(db);
  const attempts = await sweepExpired(db, await loadEnrollmentAttempts(db, e.id), new Map([[asg.id, asg]]), snapshots, now);
  const mine = sameTestAttempts(attempts, asg.test_id);

  const inProgress = mine.find((a) => a.submitted_at === null);
  if (inProgress) {
    const resumeAsg = inProgress.assignment_id === asg.id ? asg : ((await loadAssignment(db, inProgress.assignment_id)) ?? asg);
    return c.json(await toInProgress(inProgress, resumeAsg, snapshots, attemptNumberOf(mine, inProgress.id), now));
  }

  if (!isAssignmentOpen(windowOf(asg), now)) throw conflict("This test is not open right now.", "not_open");
  const submittedCount = mine.filter((a) => a.submitted_at !== null).length;
  if (asg.max_attempts !== null && submittedCount >= asg.max_attempts) {
    throw conflict("You have used all your attempts for this test.", "max_attempts");
  }

  const versionId = await ensureCurrentVersion(db, asg.test_id);
  // The partial unique index (migration 0002) guarantees one in-progress attempt per enrollment+assignment,
  // so a double-click / two tabs resume the same attempt instead of creating two.
  await stmt(
    db,
    `INSERT OR IGNORE INTO attempts (enrollment_id, assignment_id, test_version_id, started_at, deadline_at, answers)
     VALUES (?, ?, ?, ?, ?, '{}')`,
    e.id,
    asg.id,
    versionId,
    nowIso(now),
    computeDeadline(now, asg.time_limit_min),
  ).run();
  const created = await db
    .prepare(
      `SELECT a.id FROM attempts a WHERE a.enrollment_id = ? AND a.assignment_id = ? AND a.submitted_at IS NULL ORDER BY a.id DESC LIMIT 1`,
    )
    .bind(e.id, asg.id)
    .first<{ id: number }>();
  const attempt = created ? await loadAttempt(db, created.id) : null;
  if (!attempt) throw new Error("Failed to start attempt");
  const all = sameTestAttempts(await loadEnrollmentAttempts(db, e.id), asg.test_id);
  return c.json(await toInProgress(attempt, asg, snapshots, attemptNumberOf(all, attempt.id), now), 201);
});

attemptRoutes.get("/attempts/:id", async (c) => {
  const { attempt, asg } = await ownAttempt(c, idParam(c));
  const db = c.env.DB;
  const now = new Date();
  const snapshots = new SnapshotCache(db);
  let current = attempt;
  if (!current.submitted_at && isAttemptExpired(current.deadline_at, windowOf(asg), now)) {
    current = await finalizeAttempt(db, current, snapshots, true, now);
  }
  return c.json(await render(db, current, asg, snapshots, now));
});

attemptRoutes.put("/attempts/:id/answers", async (c) => {
  const id = idParam(c);
  const body = await readBody(c, saveAnswersBody);
  const { attempt, asg } = await ownAttempt(c, id);
  const db = c.env.DB;
  const now = new Date();
  const snapshots = new SnapshotCache(db);

  if (attempt.submitted_at) throw conflict("This attempt has already been submitted.", "already_submitted");
  if (isAttemptExpired(attempt.deadline_at, windowOf(asg), now)) {
    await finalizeAttempt(db, attempt, snapshots, true, now);
    throw conflict("Time is up — your saved answers were submitted automatically.", "expired");
  }

  const entries = Object.entries(body.answers);
  if (entries.length > MAX_ANSWER_KEYS) throw badRequest("Too many answers in one request.");
  const snap = await snapshots.get(attempt.test_version_id);
  const byId = new Map(snap.questions.map((q) => [String(q.id), q]));
  const patch: Record<string, AnswerValue> = {};
  for (const [key, value] of entries) {
    const q = byId.get(key);
    if (!q) throw badRequest(`Unknown question id ${key.slice(0, 20)}.`);
    const check = normalizeStudentAnswer(q, value);
    if (!check.ok) throw badRequest(check.error);
    patch[key] = check.value;
  }

  const savedAt = nowIso(now);
  if (entries.length > 0) {
    // json_patch merges atomically in SQLite, so concurrent saves from two tabs never drop answers.
    const res = await stmt(
      db,
      "UPDATE attempts SET answers = json_patch(answers, ?) WHERE id = ? AND submitted_at IS NULL",
      JSON.stringify(patch),
      id,
    ).run();
    if (!res.meta.changes) throw conflict("This attempt has already been submitted.", "already_submitted");
  }
  return c.json({ savedAt });
});

attemptRoutes.post("/attempts/:id/submit", async (c) => {
  const { attempt, asg } = await ownAttempt(c, idParam(c));
  const db = c.env.DB;
  const now = new Date();
  const snapshots = new SnapshotCache(db);

  let current = attempt;
  if (!current.submitted_at) {
    const expired = isAttemptExpired(current.deadline_at, windowOf(asg), now);
    if (!expired) {
      const snap = await snapshots.get(current.test_version_id);
      const answers = parseJson<Record<string, AnswerValue>>(current.answers, {});
      const missing = snap.questions.filter((q) => q.required && !isAnswered(answers[String(q.id)]));
      if (missing.length > 0) {
        throw badRequest(
          `Please answer all required questions before submitting (missing: ${missing.map((q) => q.position).join(", ")}).`,
        );
      }
    }
    current = await finalizeAttempt(db, current, snapshots, expired, now);
  }
  return c.json(await render(db, current, asg, snapshots, now));
});
