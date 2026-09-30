/**
 * Pure test-engine logic (no Cloudflare / D1 imports) so it can be unit-tested with vitest in Node.
 * Rules: docs/ARCHITECTURE.md §4.
 */
import type { AnswerValue, Availability, QuestionType, ScorePolicy, ScoreStats } from "../shared/contract";

/** Seconds of grace after a deadline during which saves / submits are still accepted. */
export const DEADLINE_GRACE_MS = 30_000;

export interface QuestionOption {
  id: string;
  text: string;
}

/** A question as frozen in a test_versions snapshot (answer included — server only). */
export interface SnapshotQuestion {
  id: number;
  position: number;
  type: QuestionType;
  prompt: string;
  imageUrl: string | null;
  options: QuestionOption[];
  /** single: option id · multi: option ids · truefalse: boolean · short: accepted answers */
  answer: AnswerValue;
  points: number;
  required: boolean;
}

export interface TestSnapshot {
  title: string;
  questions: SnapshotQuestion[];
}

export const TRUE_FALSE_OPTIONS: QuestionOption[] = [
  { id: "true", text: "True" },
  { id: "false", text: "False" },
];

/* ───────────── answer normalisation ───────────── */

/** Case-, width- and whitespace-insensitive form used for short answers ("Ca²⁺" ≡ "ca2+"). */
export function normalizeShortAnswer(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

/** Accepts `true`/`false` or the option ids "true"/"false". */
function toBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

export type AnswerCheck = { ok: true; value: AnswerValue } | { ok: false; error: string };

/**
 * Validates a student's answer against the question type and normalises it for storage.
 * Empty answers (""/[]) are allowed so a student can clear a response.
 */
export function normalizeStudentAnswer(q: SnapshotQuestion, value: unknown): AnswerCheck {
  const optionIds = new Set(q.options.map((o) => o.id));
  switch (q.type) {
    case "single":
      if (typeof value !== "string") return { ok: false, error: `Question ${q.position}: expected one option id` };
      if (value !== "" && !optionIds.has(value)) return { ok: false, error: `Question ${q.position}: unknown option` };
      return { ok: true, value };
    case "multi": {
      if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
        return { ok: false, error: `Question ${q.position}: expected a list of option ids` };
      }
      const unique = [...new Set(value as string[])];
      if (unique.some((v) => !optionIds.has(v))) return { ok: false, error: `Question ${q.position}: unknown option` };
      return { ok: true, value: unique };
    }
    case "truefalse": {
      const b = toBoolean(value);
      if (b === null) return { ok: false, error: `Question ${q.position}: expected true or false` };
      return { ok: true, value: b };
    }
    case "short":
      if (typeof value !== "string") return { ok: false, error: `Question ${q.position}: expected text` };
      return { ok: true, value: value.slice(0, 500) };
  }
}

/** True when the student gave a non-empty answer. */
export function isAnswered(value: AnswerValue | undefined | null): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  return value.trim() !== "";
}

/* ───────────── grading ───────────── */

/**
 * single = exact option id · multi = exact set (all-or-nothing) · truefalse = boolean ·
 * short = case/space-insensitive match against any accepted answer.
 */
export function isCorrect(q: SnapshotQuestion, given: AnswerValue | undefined | null): boolean {
  if (given === undefined || given === null) return false;
  switch (q.type) {
    case "single":
      return typeof given === "string" && given !== "" && given === q.answer;
    case "multi": {
      if (!Array.isArray(given) || !Array.isArray(q.answer)) return false;
      const want = new Set(q.answer);
      const got = new Set(given);
      if (want.size === 0 || want.size !== got.size) return false;
      for (const id of got) if (!want.has(id)) return false;
      return true;
    }
    case "truefalse": {
      const b = toBoolean(given);
      return b !== null && b === toBoolean(q.answer);
    }
    case "short": {
      if (typeof given !== "string") return false;
      const g = normalizeShortAnswer(given);
      if (g === "") return false;
      const accepted = Array.isArray(q.answer) ? q.answer : [String(q.answer)];
      return accepted.some((a) => normalizeShortAnswer(a) === g);
    }
  }
}

export interface GradedQuestion {
  questionId: number;
  correct: boolean;
  points: number;
  earned: number;
}

export interface GradeResult {
  score: number;
  maxScore: number;
  items: GradedQuestion[];
}

export function gradeAttempt(snapshot: TestSnapshot, answers: Record<string, AnswerValue>): GradeResult {
  let score = 0;
  let maxScore = 0;
  const items: GradedQuestion[] = [];
  for (const q of snapshot.questions) {
    const correct = isCorrect(q, answers[String(q.id)]);
    const earned = correct ? q.points : 0;
    score += earned;
    maxScore += q.points;
    items.push({ questionId: q.id, correct, points: q.points, earned });
  }
  return { score, maxScore, items };
}

/** Value shown as "correct answer" in the student review. Short answers show the first accepted answer. */
export function displayCorrectAnswer(q: SnapshotQuestion): AnswerValue {
  if (q.type === "short") return Array.isArray(q.answer) ? (q.answer[0] ?? "") : String(q.answer);
  if (q.type === "truefalse") return toBoolean(q.answer) ?? false;
  return q.answer;
}

/**
 * Answer review (correct answers) is revealed only when it can no longer be used to improve a score:
 * the attempt is submitted, the assignment allows it, AND (the student has no attempts left OR the
 * assignment is no longer open). Unlimited attempts (attemptsLeft = null) → only after the test closes.
 */
export function canRevealAnswers(p: {
  showAnswers: boolean;
  submitted: boolean;
  attemptsLeft: number | null;
  assignmentOpen: boolean;
}): boolean {
  if (!p.showAnswers || !p.submitted) return false;
  const noAttemptsLeft = p.attemptsLeft !== null && p.attemptsLeft <= 0;
  return noAttemptsLeft || !p.assignmentOpen;
}

/* ───────────── time windows ───────────── */

export interface WindowSettings {
  availability: Availability;
  isOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
  classArchived: boolean;
}

/** manual → is_open · scheduled → opens_at <= now < closes_at · archived classes are never open. */
export function isAssignmentOpen(w: WindowSettings, now: Date): boolean {
  if (w.classArchived) return false;
  if (w.availability === "manual") return w.isOpen;
  if (!w.opensAt || !w.closesAt) return false;
  const t = now.getTime();
  return Date.parse(w.opensAt) <= t && t < Date.parse(w.closesAt);
}

export function computeDeadline(startedAt: Date, timeLimitMin: number | null): string | null {
  if (timeLimitMin === null || timeLimitMin <= 0) return null;
  return new Date(startedAt.getTime() + timeLimitMin * 60_000).toISOString();
}

/**
 * An unsubmitted attempt is expired (→ auto-submit on next read/save) when:
 * the time limit + grace has passed, a scheduled window closed (+ grace),
 * a manual assignment was closed, or the class was archived.
 */
export function isAttemptExpired(deadlineAt: string | null, w: WindowSettings, now: Date): boolean {
  const t = now.getTime();
  if (deadlineAt && t > Date.parse(deadlineAt) + DEADLINE_GRACE_MS) return true;
  if (w.classArchived) return true;
  if (w.availability === "manual") return !w.isOpen;
  if (w.closesAt && t > Date.parse(w.closesAt) + DEADLINE_GRACE_MS) return true;
  return false;
}

/* ───────────── score policy ───────────── */

export interface SubmittedAttemptLike {
  id: number;
  score: number;
  submittedAt: string;
}

/** Counted attempt per score policy, considering submitted attempts only. Ties resolve to the earlier attempt. */
export function pickCountedAttempt<T extends SubmittedAttemptLike>(attempts: T[], policy: ScorePolicy): T | null {
  if (attempts.length === 0) return null;
  const ordered = [...attempts].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt) || a.id - b.id);
  if (policy === "first") return ordered[0];
  if (policy === "latest") return ordered[ordered.length - 1];
  let best = ordered[0];
  for (const a of ordered) if (a.score > best.score) best = a;
  return best;
}

/* ───────────── statistics ───────────── */

const round2 = (n: number) => Math.round(n * 100) / 100;

/** n / mean / sample SD / min / max. SD is null when n < 2. */
export function scoreStats(values: number[], maxScore: number | null): ScoreStats {
  const n = values.length;
  if (n === 0) return { n: 0, mean: null, sd: null, min: null, max: null, maxScore };
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const sd = n < 2 ? null : Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));
  return {
    n,
    mean: round2(mean),
    sd: sd === null ? null : round2(sd),
    min: Math.min(...values),
    max: Math.max(...values),
    maxScore,
  };
}

/** Integer bins 0..maxScore (extended if an older version allowed a higher score). */
export function histogram(values: number[], maxScore: number): { score: number; count: number }[] {
  const top = Math.max(0, Math.ceil(maxScore), ...values.map((v) => Math.ceil(v)));
  const bins = Array.from({ length: top + 1 }, (_, score) => ({ score, count: 0 }));
  for (const v of values) {
    const i = Math.min(top, Math.max(0, Math.round(v)));
    bins[i].count += 1;
  }
  return bins;
}

export { round2 };

/* ───────────── join codes ───────────── */

/** Unambiguous alphabet: no 0/O, 1/I. 32 symbols → no modulo bias with random bytes. */
export const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateJoinCode(randomBytes: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = randomBytes(4);
  let out = "MUS-";
  for (let i = 0; i < 4; i++) out += JOIN_CODE_ALPHABET[bytes[i] % JOIN_CODE_ALPHABET.length];
  return out;
}

export function normalizeJoinCode(code: string): string {
  return code.trim().toUpperCase();
}
