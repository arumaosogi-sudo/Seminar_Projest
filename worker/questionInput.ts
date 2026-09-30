/** Pure validation of admin question input (test builder). No Cloudflare imports. */
import type { AnswerValue, QuestionType } from "../shared/contract";
import { TRUE_FALSE_OPTIONS, type QuestionOption } from "./grading";

export interface RawQuestionInput {
  id?: number;
  type: QuestionType;
  prompt: string;
  imageUrl?: string | null;
  options: { id: string; text: string }[];
  answer: string | string[] | boolean;
  points: number;
  required: boolean;
}

export interface NormalizedQuestion {
  id?: number;
  type: QuestionType;
  prompt: string;
  imageUrl: string | null;
  options: QuestionOption[];
  answer: AnswerValue;
  points: number;
  required: boolean;
}

export type QuestionCheck = { ok: true; question: NormalizedQuestion } | { ok: false; error: string };

/**
 * Validates one question and normalises its answer for storage:
 * single → option id · multi → unique option ids · truefalse → boolean (options fixed to True/False) ·
 * short → non-empty list of accepted answers.
 */
export function normalizeQuestionInput(q: RawQuestionInput, index: number): QuestionCheck {
  const label = `Question ${index + 1}`;
  const base = {
    id: q.id,
    type: q.type,
    prompt: q.prompt.trim(),
    imageUrl: q.imageUrl ?? null,
    points: q.points,
    required: q.required,
  };

  if (q.type === "truefalse") {
    let answer: boolean | null = null;
    if (typeof q.answer === "boolean") answer = q.answer;
    else if (q.answer === "true" || q.answer === "false") answer = q.answer === "true";
    if (answer === null) return { ok: false, error: `${label}: true/false answer must be true or false` };
    return { ok: true, question: { ...base, options: TRUE_FALSE_OPTIONS, answer } };
  }

  if (q.type === "short") {
    const list = (Array.isArray(q.answer) ? q.answer : typeof q.answer === "string" ? [q.answer] : [])
      .map((a) => a.trim())
      .filter((a) => a !== "");
    const unique = [...new Set(list)];
    if (unique.length === 0) return { ok: false, error: `${label}: add at least one accepted answer` };
    if (unique.some((a) => a.length > 200)) return { ok: false, error: `${label}: accepted answers must be ≤ 200 characters` };
    return { ok: true, question: { ...base, options: [], answer: unique.slice(0, 20) } };
  }

  // single / multi
  const options = q.options.map((o) => ({ id: o.id.trim(), text: o.text.trim() }));
  if (options.length < 2) return { ok: false, error: `${label}: add at least two options` };
  const ids = new Set(options.map((o) => o.id));
  if (ids.size !== options.length || ids.has("")) return { ok: false, error: `${label}: option ids must be unique` };

  if (q.type === "single") {
    if (typeof q.answer !== "string" || !ids.has(q.answer)) {
      return { ok: false, error: `${label}: choose the correct option` };
    }
    return { ok: true, question: { ...base, options, answer: q.answer } };
  }

  if (!Array.isArray(q.answer)) return { ok: false, error: `${label}: choose the correct options` };
  const answer = [...new Set(q.answer)];
  if (answer.length === 0) return { ok: false, error: `${label}: choose at least one correct option` };
  if (answer.some((a) => !ids.has(a))) return { ok: false, error: `${label}: correct options must be listed options` };
  return { ok: true, question: { ...base, options, answer } };
}
