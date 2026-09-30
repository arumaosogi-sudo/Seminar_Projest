/**
 * Pure model for the test builder (no React) — easy to unit test.
 * The draft keeps an answer slot per question type so switching types doesn't lose work.
 */
import type { AdminQuestion, AdminTestDetail, QuestionInput, QuestionType, SaveTestBody, TestKind } from "@shared/contract";

export interface DraftOption {
  id: string;
  text: string;
}

export interface DraftQuestion {
  /** Stable client key (dnd-kit id, React key). */
  key: string;
  /** Server id once saved. */
  id?: number;
  type: QuestionType;
  prompt: string;
  imageUrl: string | null;
  options: DraftOption[];
  single: string;
  multi: string[];
  tf: boolean | null;
  accepted: string[];
  points: number;
  required: boolean;
}

export interface DraftTest {
  title: string;
  description: string;
  kind: TestKind;
  questions: DraftQuestion[];
}

export const TYPE_LABEL: Record<QuestionType, string> = {
  single: "Multiple choice",
  multi: "Checkboxes",
  truefalse: "True / False",
  short: "Short answer",
};

let keySeq = 0;
export const newKey = () => `q${Date.now().toString(36)}${(keySeq++).toString(36)}`;

/** Next option id not used in the question: "a", "b", … "z", then "o27", "o28"… (≤ 20 chars). */
export function nextOptionId(options: DraftOption[]): string {
  const used = new Set(options.map((o) => o.id));
  for (let i = 0; i < 26; i++) {
    const id = String.fromCharCode(97 + i);
    if (!used.has(id)) return id;
  }
  let n = 27;
  while (used.has(`o${n}`)) n++;
  return `o${n}`;
}

export function blankQuestion(type: QuestionType = "single"): DraftQuestion {
  return {
    key: newKey(),
    type,
    prompt: "",
    imageUrl: null,
    options: type === "single" || type === "multi" ? [{ id: "a", text: "Option 1" }, { id: "b", text: "Option 2" }] : [],
    single: "",
    multi: [],
    tf: null,
    accepted: [""],
    points: 1,
    required: true,
  };
}

export function questionFromServer(q: AdminQuestion, key: string = newKey()): DraftQuestion {
  const d: DraftQuestion = {
    key,
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    imageUrl: q.imageUrl,
    options: q.type === "single" || q.type === "multi" ? q.options.map((o) => ({ ...o })) : [],
    single: "",
    multi: [],
    tf: null,
    accepted: [""],
    points: q.points,
    required: q.required,
  };
  const a = q.answer;
  if (q.type === "single") d.single = typeof a === "string" ? a : Array.isArray(a) ? (a[0] ?? "") : "";
  if (q.type === "multi") d.multi = Array.isArray(a) ? [...a] : typeof a === "string" && a ? [a] : [];
  if (q.type === "truefalse") d.tf = typeof a === "boolean" ? a : a === "true" ? true : a === "false" ? false : null;
  if (q.type === "short") d.accepted = Array.isArray(a) && a.length ? [...a] : typeof a === "string" && a ? [a] : [""];
  return d;
}

export function draftFromServer(t: AdminTestDetail): DraftTest {
  return {
    title: t.title,
    description: t.description ?? "",
    kind: t.kind,
    questions: [...t.questions].sort((a, b) => a.position - b.position).map((q) => questionFromServer(q)),
  };
}

/** Switch a question's type, seeding sensible defaults for the new type. */
export function changeType(q: DraftQuestion, type: QuestionType): DraftQuestion {
  if (q.type === type) return q;
  const next: DraftQuestion = { ...q, type };
  const isChoice = type === "single" || type === "multi";
  if (isChoice && next.options.length === 0) next.options = [{ id: "a", text: "Option 1" }, { id: "b", text: "Option 2" }];
  if (type === "single" && !next.single && q.type === "multi") next.single = q.multi[0] ?? "";
  if (type === "multi" && next.multi.length === 0 && q.type === "single" && q.single) next.multi = [q.single];
  return next;
}

export function duplicateQuestion(q: DraftQuestion): DraftQuestion {
  return { ...q, key: newKey(), id: undefined, options: q.options.map((o) => ({ ...o })), multi: [...q.multi], accepted: [...q.accepted] };
}

export function questionAnswer(q: DraftQuestion): QuestionInput["answer"] {
  switch (q.type) {
    case "single":
      return q.single;
    case "multi":
      return q.multi.filter((id) => q.options.some((o) => o.id === id));
    case "truefalse":
      return q.tf ?? false;
    case "short":
      return q.accepted.map((s) => s.trim()).filter(Boolean);
  }
}

export function toSaveBody(d: DraftTest): SaveTestBody {
  return {
    title: d.title.trim(),
    description: d.description,
    kind: d.kind,
    questions: d.questions.map((q) => ({
      ...(q.id ? { id: q.id } : {}),
      type: q.type,
      prompt: q.prompt.trim(),
      imageUrl: q.imageUrl,
      options: q.type === "single" || q.type === "multi" ? q.options.map((o) => ({ id: o.id, text: o.text.trim() })) : [],
      answer: questionAnswer(q),
      points: q.points,
      required: q.required,
    })),
  };
}

export interface ValidationResult {
  title?: string;
  byQuestion: Record<string, string[]>;
  count: number;
}

export function validateDraft(d: DraftTest): ValidationResult {
  const byQuestion: Record<string, string[]> = {};
  let count = 0;
  const title = d.title.trim() ? undefined : "The test needs a title.";
  if (title) count++;
  for (const q of d.questions) {
    const errs: string[] = [];
    if (!q.prompt.trim()) errs.push("Write the question.");
    if (!Number.isInteger(q.points) || q.points < 0 || q.points > 100) errs.push("Points must be a whole number from 0 to 100.");
    if (q.type === "single" || q.type === "multi") {
      if (q.options.length < 1) errs.push("Add at least one option.");
      if (q.options.length > 12) errs.push("Use at most 12 options.");
      if (q.options.some((o) => !o.text.trim())) errs.push("Options can’t be empty.");
      if (q.type === "single" && !q.options.some((o) => o.id === q.single)) errs.push("Mark the correct option.");
      if (q.type === "multi" && !q.multi.some((id) => q.options.some((o) => o.id === id))) errs.push("Mark at least one correct option.");
    }
    if (q.type === "truefalse" && q.tf === null) errs.push("Choose whether the statement is true or false.");
    if (q.type === "short" && !q.accepted.some((s) => s.trim())) errs.push("Add at least one accepted answer.");
    if (errs.length) {
      byQuestion[q.key] = errs;
      count += errs.length;
    }
  }
  return { title, byQuestion, count };
}

export const maxScoreOf = (d: DraftTest) => d.questions.reduce((s, q) => s + (Number.isFinite(q.points) ? q.points : 0), 0);
