/**
 * Form model for per-section assignment settings (AssignTest page).
 * The UI keeps raw input strings so fields can be blank while typing; `toSettings` converts
 * and validates them into the contract's AssignmentSettings (ISO UTC datetimes).
 */
import { assignmentSettings, type AdminAssignment, type AssignmentSettings, type ScorePolicy, type TestKind } from "@shared/contract";
import { isoToLocalInput, localInputToIso } from "./format";

export interface AssignForm {
  timeMode: "none" | "limited";
  minutes: string;
  attemptsMode: "once" | "retakes";
  /** Max attempts when retakes are allowed; "" = unlimited. */
  attempts: string;
  scorePolicy: ScorePolicy;
  availability: "manual" | "scheduled";
  isOpen: boolean;
  opensLocal: string;
  closesLocal: string;
  showAnswers: boolean;
  requiredFirst: boolean;
}

export function defaultForm(_kind?: TestKind): AssignForm {
  return {
    timeMode: "none",
    minutes: "30",
    attemptsMode: "once",
    attempts: "3",
    scorePolicy: "highest",
    availability: "manual",
    isOpen: false,
    opensLocal: "",
    closesLocal: "",
    showAnswers: false,
    // Games / 3D are always open (no Pretest lock in the UI) — keep the stored flag off.
    requiredFirst: false,
  };
}

export function formFromAssignment(a: AssignmentSettings): AssignForm {
  return {
    timeMode: a.timeLimitMin === null ? "none" : "limited",
    minutes: String(a.timeLimitMin ?? 30),
    attemptsMode: a.maxAttempts === 1 ? "once" : "retakes",
    attempts: a.maxAttempts === null ? "" : a.maxAttempts === 1 ? "3" : String(a.maxAttempts),
    scorePolicy: a.scorePolicy,
    availability: a.availability,
    isOpen: a.isOpen,
    opensLocal: isoToLocalInput(a.opensAt),
    closesLocal: isoToLocalInput(a.closesAt),
    showAnswers: a.showAnswers,
    requiredFirst: a.requiredFirst,
  };
}

export type ToSettingsResult = { ok: true; value: AssignmentSettings } | { ok: false; error: string };

export function toSettings(f: AssignForm): ToSettingsResult {
  let timeLimitMin: number | null = null;
  if (f.timeMode === "limited") {
    const m = Number(f.minutes);
    if (!Number.isInteger(m) || m < 1 || m > 600) return { ok: false, error: "Time limit must be 1–600 minutes." };
    timeLimitMin = m;
  }
  let maxAttempts: number | null = 1;
  if (f.attemptsMode === "retakes") {
    if (f.attempts.trim() === "") maxAttempts = null;
    else {
      const n = Number(f.attempts);
      if (!Number.isInteger(n) || n < 2 || n > 50) return { ok: false, error: "Retakes: allow 2–50 attempts, or leave blank for unlimited." };
      maxAttempts = n;
    }
  }
  let opensAt: string | null = null;
  let closesAt: string | null = null;
  if (f.availability === "scheduled") {
    opensAt = localInputToIso(f.opensLocal);
    closesAt = localInputToIso(f.closesLocal);
    if (!opensAt || !closesAt) return { ok: false, error: "Set both the opening and closing date & time." };
    if (Date.parse(closesAt) <= Date.parse(opensAt)) return { ok: false, error: "The closing time must be after the opening time." };
  }
  const candidate: AssignmentSettings = {
    timeLimitMin,
    maxAttempts,
    scorePolicy: f.scorePolicy,
    availability: f.availability,
    isOpen: f.availability === "manual" ? f.isOpen : false,
    opensAt,
    closesAt,
    showAnswers: f.showAnswers,
    requiredFirst: f.requiredFirst,
  };
  const parsed = assignmentSettings.safeParse(candidate);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings." };
  return { ok: true, value: parsed.data };
}

/** Compare the saved server settings with the form (to skip unchanged PUTs). */
export function sameSettings(a: AssignmentSettings, b: AssignmentSettings): boolean {
  const norm = (s: AssignmentSettings) => ({
    ...s,
    opensAt: s.opensAt ? new Date(s.opensAt).getTime() : null,
    closesAt: s.closesAt ? new Date(s.closesAt).getTime() : null,
    isOpen: s.availability === "manual" ? s.isOpen : false,
  });
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

export function pickSettings(a: AdminAssignment): AssignmentSettings {
  const { timeLimitMin, maxAttempts, scorePolicy, availability, isOpen, opensAt, closesAt, showAnswers, requiredFirst } = a;
  return { timeLimitMin, maxAttempts, scorePolicy, availability, isOpen, opensAt, closesAt, showAnswers, requiredFirst };
}
