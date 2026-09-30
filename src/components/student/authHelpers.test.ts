import { describe, expect, it } from "vitest";
import { ApiRequestError } from "@/lib/api";
import { describeAuthError, safeRedirect } from "./authHelpers";
import { classLabel, normalizeJoinCode } from "./useClassByCode";

describe("safeRedirect", () => {
  it("keeps in-app paths", () => {
    expect(safeRedirect("/games")).toBe("/games");
    expect(safeRedirect("/tests?x=1")).toBe("/tests?x=1");
  });
  it("rejects open redirects and non-strings", () => {
    expect(safeRedirect("//evil.com")).toBe("/");
    expect(safeRedirect("/\\evil.com")).toBe("/");
    expect(safeRedirect("https://evil.com")).toBe("/");
    expect(safeRedirect(undefined)).toBe("/");
    expect(safeRedirect(42)).toBe("/");
  });
  it("never loops back into auth screens", () => {
    expect(safeRedirect("/login")).toBe("/");
    expect(safeRedirect("/onboarding")).toBe("/");
    expect(safeRedirect("/join/MUS-AB12")).toBe("/");
  });
});

describe("describeAuthError", () => {
  it("maps known API codes to friendly copy", () => {
    const e = new ApiRequestError(403, { error: "hd mismatch", code: "domain_not_allowed" });
    expect(describeAuthError(e)).toBe("Please use your @lamduan.mfu.ac.th account.");
    expect(describeAuthError(new ApiRequestError(403, { error: "x", code: "withdrawn" }))).toMatch(/withdrawn by your instructor/);
  });
  it("falls back to server message, 5xx and network copy", () => {
    expect(describeAuthError(new ApiRequestError(400, { error: "Bad e-mail" }))).toBe("Bad e-mail");
    expect(describeAuthError(new ApiRequestError(500, { error: "boom" }))).toMatch(/server had a problem/);
    expect(describeAuthError(new TypeError("Failed to fetch"))).toMatch(/Can't reach the server/);
  });
});

describe("join code helpers", () => {
  it("normalizes and validates codes", () => {
    expect(normalizeJoinCode(" mus-ab12 ")).toBe("MUS-AB12");
    expect(normalizeJoinCode("<script>")).toBe("");
    expect(normalizeJoinCode(undefined)).toBe("");
  });
  it("formats the class label", () => {
    expect(classLabel({ section: 1, academicYear: 2569, semester: 1 })).toBe("Section 1 · 2569/1");
  });
});
