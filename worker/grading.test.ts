import { describe, expect, it } from "vitest";
import {
  JOIN_CODE_ALPHABET,
  computeDeadline,
  generateJoinCode,
  gradeAttempt,
  histogram,
  isAssignmentOpen,
  isAttemptExpired,
  isCorrect,
  normalizeShortAnswer,
  normalizeStudentAnswer,
  pickCountedAttempt,
  scoreStats,
  type SnapshotQuestion,
  type WindowSettings,
} from "./grading";
import { normalizeQuestionInput } from "./questionInput";

const q = (over: Partial<SnapshotQuestion>): SnapshotQuestion => ({
  id: 1,
  position: 1,
  type: "single",
  prompt: "?",
  imageUrl: null,
  options: [
    { id: "a", text: "A" },
    { id: "b", text: "B" },
    { id: "c", text: "C" },
  ],
  answer: "a",
  points: 1,
  required: true,
  ...over,
});

describe("grading rules", () => {
  it("single: exact option id", () => {
    expect(isCorrect(q({}), "a")).toBe(true);
    expect(isCorrect(q({}), "b")).toBe(false);
    expect(isCorrect(q({}), ["a"])).toBe(false);
    expect(isCorrect(q({}), undefined)).toBe(false);
  });

  it("multi: all-or-nothing set match, order-insensitive", () => {
    const m = q({ type: "multi", answer: ["a", "c"] });
    expect(isCorrect(m, ["c", "a"])).toBe(true);
    expect(isCorrect(m, ["a"])).toBe(false);
    expect(isCorrect(m, ["a", "b", "c"])).toBe(false);
    expect(isCorrect(m, "a")).toBe(false);
  });

  it("truefalse: boolean, also accepts the 'true'/'false' option ids", () => {
    const t = q({ type: "truefalse", answer: false, options: [] });
    expect(isCorrect(t, false)).toBe(true);
    expect(isCorrect(t, "false")).toBe(true);
    expect(isCorrect(t, true)).toBe(false);
  });

  it("short: case / space / width-insensitive against any accepted answer", () => {
    const s = q({ type: "short", answer: ["Calcium", "Ca2+"], options: [] });
    expect(isCorrect(s, "  calcium ")).toBe(true);
    expect(isCorrect(s, "CA 2+")).toBe(true);
    expect(isCorrect(s, "Ca²⁺")).toBe(true);
    expect(isCorrect(s, "")).toBe(false);
    expect(isCorrect(s, "sodium")).toBe(false);
    expect(normalizeShortAnswer(" Epi Mysium ")).toBe("epimysium");
  });

  it("gradeAttempt sums points and reports max score", () => {
    const snap = {
      title: "T",
      questions: [q({ id: 1, points: 2 }), q({ id: 2, type: "truefalse", answer: true, points: 3 })],
    };
    const g = gradeAttempt(snap, { "1": "a", "2": false });
    expect(g.score).toBe(2);
    expect(g.maxScore).toBe(5);
    expect(g.items.map((i) => i.correct)).toEqual([true, false]);
  });

  it("normalizes and validates student answers per type", () => {
    expect(normalizeStudentAnswer(q({}), "z").ok).toBe(false);
    expect(normalizeStudentAnswer(q({ type: "multi", answer: ["a"] }), ["a", "a", "b"])).toEqual({ ok: true, value: ["a", "b"] });
    expect(normalizeStudentAnswer(q({ type: "truefalse", answer: true }), "true")).toEqual({ ok: true, value: true });
    expect(normalizeStudentAnswer(q({ type: "short", answer: ["x"] }), 5).ok).toBe(false);
  });
});

describe("open window", () => {
  const base: WindowSettings = { availability: "manual", isOpen: true, opensAt: null, closesAt: null, classArchived: false };
  const now = new Date("2026-10-28T03:00:00.000Z");

  it("manual follows is_open; archived classes are never open", () => {
    expect(isAssignmentOpen(base, now)).toBe(true);
    expect(isAssignmentOpen({ ...base, isOpen: false }, now)).toBe(false);
    expect(isAssignmentOpen({ ...base, classArchived: true }, now)).toBe(false);
  });

  it("scheduled: opens_at <= now < closes_at", () => {
    const s: WindowSettings = {
      ...base,
      availability: "scheduled",
      isOpen: false,
      opensAt: "2026-10-28T02:00:00.000Z",
      closesAt: "2026-10-30T09:00:00.000Z",
    };
    expect(isAssignmentOpen(s, now)).toBe(true);
    expect(isAssignmentOpen(s, new Date("2026-10-28T02:00:00.000Z"))).toBe(true);
    expect(isAssignmentOpen(s, new Date("2026-10-30T09:00:00.000Z"))).toBe(false);
    expect(isAssignmentOpen(s, new Date("2026-10-27T00:00:00.000Z"))).toBe(false);
  });

  it("deadline = start + limit; expiry honours the 30 s grace", () => {
    const start = new Date("2026-10-28T03:00:00.000Z");
    const deadline = computeDeadline(start, 20);
    expect(deadline).toBe("2026-10-28T03:20:00.000Z");
    expect(computeDeadline(start, null)).toBeNull();
    expect(isAttemptExpired(deadline, base, new Date("2026-10-28T03:20:29.000Z"))).toBe(false);
    expect(isAttemptExpired(deadline, base, new Date("2026-10-28T03:20:31.000Z"))).toBe(true);
    expect(isAttemptExpired(null, { ...base, isOpen: false }, start)).toBe(true);
  });
});

describe("score policy", () => {
  const attempts = [
    { id: 1, score: 6, submittedAt: "2026-10-28T03:00:00.000Z" },
    { id: 2, score: 9, submittedAt: "2026-10-28T04:00:00.000Z" },
    { id: 3, score: 7, submittedAt: "2026-10-28T05:00:00.000Z" },
  ];
  it("highest / latest / first", () => {
    expect(pickCountedAttempt(attempts, "highest")?.id).toBe(2);
    expect(pickCountedAttempt(attempts, "latest")?.id).toBe(3);
    expect(pickCountedAttempt(attempts, "first")?.id).toBe(1);
    expect(pickCountedAttempt([], "highest")).toBeNull();
  });
  it("highest ties resolve to the earlier attempt", () => {
    expect(pickCountedAttempt([{ ...attempts[1], id: 5 }, { ...attempts[0], score: 9 }], "highest")?.id).toBe(1);
  });
});

describe("statistics", () => {
  it("mean / sample sd / min / max", () => {
    const s = scoreStats([2, 4, 4, 4, 5, 5, 7, 9], 10);
    expect(s).toMatchObject({ n: 8, mean: 5, min: 2, max: 9, maxScore: 10 });
    expect(s.sd).toBeCloseTo(2.14, 2);
    expect(scoreStats([], 10)).toMatchObject({ n: 0, mean: null, sd: null });
    expect(scoreStats([3], 10).sd).toBeNull();
  });
  it("histogram bins 0..maxScore", () => {
    const h = histogram([0, 2, 2, 10], 10);
    expect(h).toHaveLength(11);
    expect(h[2]).toEqual({ score: 2, count: 2 });
    expect(h[10].count).toBe(1);
  });
});

describe("join codes", () => {
  it("uses MUS- + 4 chars from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateJoinCode();
      expect(code).toMatch(/^MUS-[A-HJ-NP-Z2-9]{4}$/);
    }
    expect(JOIN_CODE_ALPHABET).not.toMatch(/[01IO]/);
    expect(JOIN_CODE_ALPHABET).toHaveLength(32);
  });
  it("maps bytes deterministically", () => {
    expect(generateJoinCode(() => new Uint8Array([0, 31, 32, 255]))).toBe("MUS-A9A9");
  });
});

describe("question input (test builder)", () => {
  it("fixes true/false options and wraps short answers", () => {
    const tf = normalizeQuestionInput({ type: "truefalse", prompt: "x", options: [], answer: "false", points: 1, required: true }, 0);
    expect(tf.ok && tf.question.answer).toBe(false);
    const sh = normalizeQuestionInput({ type: "short", prompt: "x", options: [], answer: " Epimysium ", points: 1, required: true }, 0);
    expect(sh.ok && sh.question.answer).toEqual(["Epimysium"]);
  });
  it("rejects answers that are not options", () => {
    const r = normalizeQuestionInput(
      { type: "single", prompt: "x", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], answer: "c", points: 1, required: true },
      2,
    );
    expect(r).toEqual({ ok: false, error: "Question 3: choose the correct option" });
  });
});
