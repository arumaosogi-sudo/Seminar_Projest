/**
 * Pure helpers shared by the student Tests pages (list · take · result).
 * No React here so they stay easy to unit-test (testHelpers.test.ts).
 */
import type { AnswerValue, QuestionType, ScorePolicy, StudentQuestion, StudentTestItem, TestKind } from "@shared/contract";

export const KIND_LABEL: Record<TestKind, string> = { pretest: "Pretest", posttest: "Posttest", other: "Other" };

export const POLICY_LABEL: Record<ScorePolicy, string> = { highest: "Highest", latest: "Latest", first: "First" };

export const POLICY_SENTENCE: Record<ScorePolicy, string> = {
  highest: "counts highest score",
  latest: "counts latest score",
  first: "counts first score",
};

/** Instruction line above a question (Figma: blue, uppercase, 11–12 px). */
export const TYPE_HINT: Record<QuestionType, string> = {
  single: "Choose one answer",
  multi: "Select all that apply",
  truefalse: "True or false",
  short: "Short answer",
};

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const fullFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** "24 Sep, 13:12" (local time). */
export function shortDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dateFmt.format(d);
}

/** "25 Oct 2026, 14:07" (local time). */
export function fullDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : fullFmt.format(d);
}

/** Milliseconds → "14:32" or "1:02:05". Negative values clamp to 0:00. */
export function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Duration between two ISO times as "11:26" (used for "took 11:26"). */
export function durationBetween(startIso: string, endIso: string): string {
  return clock(new Date(endIso).getTime() - new Date(startIso).getTime());
}

/** Same rule as the server (worker/grading.ts isAnswered): blank strings and empty selections don't count. */
export function isAnswered(v: AnswerValue | undefined | null): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "boolean") return true;
  if (Array.isArray(v)) return v.length > 0;
  return v.trim().length > 0;
}

/** Human-readable answer: option ids → option texts, booleans → True/False. */
export function answerText(
  type: QuestionType,
  options: { id: string; text: string }[],
  value: AnswerValue | null | undefined,
): string {
  if (value === null || value === undefined) return "No answer";
  if (type === "truefalse") {
    const b = typeof value === "boolean" ? value : value === "true";
    return b ? "True" : "False";
  }
  if (type === "short") return typeof value === "string" && value.trim() ? value : "No answer";
  const byId = new Map(options.map((o) => [o.id, o.text]));
  const ids = Array.isArray(value) ? value : [String(value)];
  if (ids.length === 0) return "No answer";
  return ids.map((id) => byId.get(id) ?? id).join(", ");
}

/** "Attempts 1 of 2" style value for the list cards ("1 of ∞" when unlimited). */
export function attemptsValue(t: Pick<StudentTestItem, "attemptsUsed" | "maxAttempts">): string {
  return `${t.attemptsUsed} of ${t.maxAttempts === null ? "∞" : t.maxAttempts}`;
}

/** Attempts the student can still start (null = unlimited). */
export function attemptsLeft(t: Pick<StudentTestItem, "attemptsUsed" | "maxAttempts">): number | null {
  return t.maxAttempts === null ? null : Math.max(0, t.maxAttempts - t.attemptsUsed);
}

/** Can a new attempt be started right now? */
export function canStart(t: StudentTestItem): boolean {
  if (t.status === "in_progress") return true;
  if (!t.isOpen || t.status === "not_open" || t.status === "closed") return false;
  const left = attemptsLeft(t);
  return left === null || left > 0;
}

/** Questions the student hasn't answered yet (1-based positions), split by required / optional. */
export function unanswered(questions: StudentQuestion[], answers: Record<string, AnswerValue>) {
  const missing = questions.filter((q) => !isAnswered(answers[String(q.id)]));
  return {
    required: missing.filter((q) => q.required).map((q) => q.position),
    optional: missing.filter((q) => !q.required).map((q) => q.position),
  };
}

/** Status filter on the list page (Figma pills: All · Open · Done). */
export type ListFilter = "all" | "open" | "done";

export function matchesFilter(t: StudentTestItem, f: ListFilter): boolean {
  if (f === "all") return true;
  if (f === "open") return t.status === "open" || t.status === "in_progress";
  return t.status === "submitted" || (t.status === "closed" && t.lastSubmittedAttemptId !== null);
}
