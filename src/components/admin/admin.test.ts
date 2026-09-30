import { describe, expect, it } from "vitest";
import type { AdminQuestion, AdminResults, AdminTestDetail } from "@shared/contract";
import { saveTestBody } from "@shared/contract";
import { resolveCurrentClass } from "./adminClass";
import { defaultForm, formFromAssignment, sameSettings, toSettings } from "./assign";
import { blankQuestion, changeType, draftFromServer, duplicateQuestion, nextOptionId, toSaveBody, validateDraft } from "./builder";
import { parseCsv, parseRosterCsv } from "./csv";
import { buildScoresSheet, buildSummarySheet, defaultTestIds, resultsFileName, rowChange } from "./exportResults";
import { isoToLocalInput, localInputToIso, relativeTime, signed, slugify } from "./format";

describe("csv", () => {
  it("parses quotes, escaped quotes, CRLF and BOM", () => {
    expect(parseCsv('﻿a,"b, c","d ""q"""\r\n1,2,3\n')).toEqual([
      ["a", "b, c", 'd "q"'],
      ["1", "2", "3"],
    ]);
  });
  it("detects semicolon and tab delimiters", () => {
    expect(parseCsv("x;y\n1;2")).toEqual([["x", "y"], ["1", "2"]]);
    expect(parseCsv("x\ty\n1\t2")).toEqual([["x", "y"], ["1", "2"]]);
  });
  it("maps tolerant headers, skips invalid + duplicate rows", () => {
    const r = parseRosterCsv("First name,Student ID\nAnn,6531501234\nBob,abc\nAnn again,6531501234\nCat,653150123");
    expect(r.headerDetected).toBe(true);
    expect(r.entries).toEqual([
      { studentCode: "6531501234", firstName: "Ann" },
      { studentCode: "653150123", firstName: "Cat" },
    ]);
    expect(r.duplicates).toBe(1);
    expect(r.invalid).toEqual([{ line: 3, value: "abc" }]);
  });
  it("works without a header row", () => {
    const r = parseRosterCsv("6531501234,Ann\n6531501235");
    expect(r.headerDetected).toBe(false);
    expect(r.entries).toEqual([{ studentCode: "6531501234", firstName: "Ann" }, { studentCode: "6531501235" }]);
  });
  it("skips an unknown (e.g. Thai) header row instead of reporting it", () => {
    const r = parseRosterCsv("รหัส,ชื่อ\n6531501234,เอ");
    expect(r.invalid).toHaveLength(0);
    expect(r.entries).toEqual([{ studentCode: "6531501234", firstName: "เอ" }]);
  });
});

describe("builder", () => {
  const q = (over: Partial<AdminQuestion>): AdminQuestion => ({
    id: 1,
    position: 1,
    type: "single",
    prompt: "P",
    imageUrl: null,
    options: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
    answer: "b",
    points: 2,
    required: true,
    ...over,
  });
  const detail = (questions: AdminQuestion[]): AdminTestDetail => ({
    id: 9,
    title: "T",
    kind: "posttest",
    questionCount: questions.length,
    maxScore: 0,
    currentVersion: 1,
    assignedClassCount: 0,
    attemptCount: 0,
    updatedAt: "2026-01-01T00:00:00Z",
    description: "",
    questions,
    versionLocked: false,
    versions: [],
  });

  it("round-trips server questions into a valid save body (sorted by position)", () => {
    const d = draftFromServer(
      detail([
        q({ id: 2, position: 2, type: "truefalse", options: [], answer: false }),
        q({ id: 1, position: 1 }),
        q({ id: 3, position: 3, type: "multi", answer: ["a", "b"] }),
        q({ id: 4, position: 4, type: "short", options: [], answer: ["actin", "Actin filament"] }),
      ]),
    );
    const body = toSaveBody(d);
    expect(body.questions.map((x) => x.id)).toEqual([1, 2, 3, 4]);
    expect(body.questions.map((x) => x.answer)).toEqual(["b", false, ["a", "b"], ["actin", "Actin filament"]]);
    expect(body.questions[1].options).toEqual([]);
    expect(validateDraft(d).count).toBe(0);
    expect(saveTestBody.safeParse(body).success).toBe(true);
  });

  it("flags missing prompt / correct answer / title", () => {
    const blank = blankQuestion();
    const v = validateDraft({ title: " ", description: "", kind: "other", questions: [blank] });
    expect(v.title).toBeTruthy();
    expect(v.byQuestion[blank.key]).toEqual(["Write the question.", "Mark the correct option."]);
    const tf = { ...blankQuestion("truefalse"), prompt: "x" };
    expect(validateDraft({ title: "t", description: "", kind: "other", questions: [tf] }).byQuestion[tf.key]).toHaveLength(1);
    const short = { ...blankQuestion("short"), prompt: "x", accepted: ["  "] };
    expect(validateDraft({ title: "t", description: "", kind: "other", questions: [short] }).byQuestion[short.key]).toEqual(["Add at least one accepted answer."]);
  });

  it("keeps answers when switching single ↔ multi", () => {
    const s = { ...blankQuestion("single"), single: "b" };
    const m = changeType(s, "multi");
    expect(m.multi).toEqual(["b"]);
    expect(changeType(m, "single").single).toBe("b");
    expect(changeType(blankQuestion("short"), "single").options).toHaveLength(2);
  });

  it("duplicates without the server id and with a new key", () => {
    const s = { ...blankQuestion(), id: 5 };
    const dup = duplicateQuestion(s);
    expect(dup.id).toBeUndefined();
    expect(dup.key).not.toBe(s.key);
    expect(dup.options).not.toBe(s.options);
  });

  it("generates unused option ids", () => {
    expect(nextOptionId([{ id: "a", text: "" }, { id: "c", text: "" }])).toBe("b");
    const full = Array.from({ length: 26 }, (_, i) => ({ id: String.fromCharCode(97 + i), text: "" }));
    expect(nextOptionId(full)).toBe("o27");
  });
});

describe("assign settings", () => {
  it("converts defaults to valid settings", () => {
    const r = toSettings(defaultForm("pretest"));
    expect(r.ok && r.value).toMatchObject({ timeLimitMin: null, maxAttempts: 1, requiredFirst: true, availability: "manual" });
  });
  it("blank retakes = unlimited; validates ranges", () => {
    const f = { ...defaultForm("other"), attemptsMode: "retakes" as const, attempts: "" };
    const r = toSettings(f);
    expect(r.ok && r.value.maxAttempts).toBeNull();
    expect(toSettings({ ...f, attempts: "1" }).ok).toBe(false);
    expect(toSettings({ ...defaultForm("other"), timeMode: "limited", minutes: "0" }).ok).toBe(false);
  });
  it("requires an ordered schedule and converts local → ISO", () => {
    const base = { ...defaultForm("other"), availability: "scheduled" as const };
    expect(toSettings(base).ok).toBe(false);
    expect(toSettings({ ...base, opensLocal: "2026-10-02T10:00", closesLocal: "2026-10-02T09:00" }).ok).toBe(false);
    const r = toSettings({ ...base, opensLocal: "2026-10-02T09:00", closesLocal: "2026-10-02T10:30", isOpen: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.isOpen).toBe(false); // manual switch ignored when scheduled
      expect(isoToLocalInput(r.value.opensAt)).toBe("2026-10-02T09:00");
      expect(formFromAssignment(r.value).closesLocal).toBe("2026-10-02T10:30");
      expect(sameSettings(r.value, { ...r.value, opensAt: new Date(r.value.opensAt!).toISOString().replace(".000Z", "Z") })).toBe(true);
    }
  });
});

describe("format", () => {
  it("datetime-local round trip", () => {
    expect(isoToLocalInput(localInputToIso("2026-01-31T23:59"))).toBe("2026-01-31T23:59");
    expect(localInputToIso("")).toBeNull();
    expect(localInputToIso("garbage")).toBeNull();
  });
  it("relative time + signed numbers + slugs", () => {
    const now = Date.parse("2026-10-01T12:00:00Z");
    expect(relativeTime("2026-10-01T11:59:50Z", now)).toBe("just now");
    expect(relativeTime("2026-10-01T11:55:00Z", now)).toBe("5 minutes ago");
    expect(signed(1.25)).toBe("+1.3");
    expect(signed(-2)).toBe("−2");
    expect(signed(0)).toBe("0");
    expect(slugify("2569/1 · Section 1")).toBe("2569-1-section-1");
  });
  it("picks a stored or newest class", () => {
    const c = (id: number, y: number, s: number, sec: number) =>
      ({ id, academicYear: y, semester: s, section: sec }) as Parameters<typeof resolveCurrentClass>[0][number];
    const list = [c(1, 2568, 2, 1), c(2, 2569, 1, 2), c(3, 2569, 1, 1)];
    expect(resolveCurrentClass(list, 1)).toBe(1);
    expect(resolveCurrentClass(list, 99)).toBe(3);
    expect(resolveCurrentClass([], 1)).toBeNull();
  });
});

describe("results export", () => {
  const results: AdminResults = {
    classId: 1,
    tests: [
      { testId: 1, title: "Pre", kind: "pretest", maxScore: 10, stats: { n: 2, mean: 5, sd: 1, min: 4, max: 6, maxScore: 10 } },
      { testId: 2, title: "Post", kind: "posttest", maxScore: 10, stats: { n: 1, mean: 8, sd: 0, min: 8, max: 8, maxScore: 10 } },
    ],
    paired: { n: 1, meanGain: 4, improved: 1 },
    distribution: [],
    itemAnalysis: [],
    rows: [
      { studentCode: "6531501234", firstName: "Ann", className: "2569/1 · Section 1", enrollmentStatus: "active", scores: { "1": 4, "2": 8 } },
      { studentCode: "6531501235", firstName: null, className: "2569/1 · Section 1", enrollmentStatus: "withdrawn", scores: { "1": 6, "2": null } },
    ],
  };
  it("builds the Scores sheet without e-mails, with change and withdrawn filter", () => {
    const active = buildScoresSheet(results, false);
    expect(active[0]).toEqual(["Student ID", "First name", "Section", "Status", "Pre (/10)", "Post (/10)", "Change"]);
    expect(active).toHaveLength(2);
    expect(active[1]).toEqual(["6531501234", "Ann", "2569/1 · Section 1", "Active", 4, 8, 4]);
    const all = buildScoresSheet(results, true);
    expect(all[2]).toEqual(["6531501235", "", "2569/1 · Section 1", "Withdrawn", 6, "Not taken", null]);
    expect(JSON.stringify(all)).not.toContain("@");
  });
  it("summary + helpers", () => {
    const s = buildSummarySheet(results, { classLabel: "X", includeWithdrawn: false });
    expect(s.some((r) => r[0] === "Mean gain" && r[1] === 4)).toBe(true);
    expect(rowChange(results.rows[1], 1, 2)).toBeNull();
    expect(resultsFileName("2569/1 · Section 1", new Date(2026, 9, 1))).toBe("digital-muscle-results-2569-1-section-1-2026-10-01.xlsx");
    const t = (id: number, kind: "pretest" | "posttest" | "other", updatedAt: string) =>
      ({ id, kind, updatedAt }) as Parameters<typeof defaultTestIds>[0][number];
    expect(defaultTestIds([t(1, "pretest", "2026-01-01"), t(2, "pretest", "2026-02-01"), t(3, "posttest", "2026-01-15"), t(4, "other", "2026-03-01")])).toEqual([2, 3]);
    expect(defaultTestIds([t(4, "other", "2026-03-01")])).toEqual([4]);
  });
});
