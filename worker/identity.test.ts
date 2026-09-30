import { describe, expect, it } from "vitest";
import { isLocalHostname, parseAdminEmails, parseStudentEmail } from "./identity";

const DOMAIN = "lamduan.mfu.ac.th";

describe("student e-mail parsing", () => {
  it("extracts an 8–12 digit student code from the allowed domain", () => {
    expect(parseStudentEmail("6531501234@lamduan.mfu.ac.th", DOMAIN)).toEqual({
      ok: true,
      studentCode: "6531501234",
      email: "6531501234@lamduan.mfu.ac.th",
    });
    expect(parseStudentEmail("  65315012@LAMDUAN.MFU.AC.TH ", DOMAIN)).toMatchObject({ ok: true, studentCode: "65315012" });
  });

  it("rejects other domains", () => {
    expect(parseStudentEmail("6531501234@gmail.com", DOMAIN)).toMatchObject({ ok: false, code: "domain_not_allowed" });
    expect(parseStudentEmail("6531501234@mfu.ac.th", DOMAIN)).toMatchObject({ ok: false, code: "domain_not_allowed" });
    expect(parseStudentEmail("6531501234@evil.lamduan.mfu.ac.th", DOMAIN)).toMatchObject({ ok: false, code: "domain_not_allowed" });
  });

  it("rejects non-student local parts", () => {
    expect(parseStudentEmail("somchai.k@lamduan.mfu.ac.th", DOMAIN)).toMatchObject({ ok: false, code: "not_student_account" });
    expect(parseStudentEmail("1234567@lamduan.mfu.ac.th", DOMAIN)).toMatchObject({ ok: false, code: "not_student_account" });
    expect(parseStudentEmail("1234567890123@lamduan.mfu.ac.th", DOMAIN)).toMatchObject({ ok: false, code: "not_student_account" });
  });
});

describe("admin e-mails", () => {
  it("parses a comma list case-insensitively and drops junk", () => {
    expect(parseAdminEmails(" Instructor@MFU.ac.th, ,foo, b@x.org,b@x.org")).toEqual(["instructor@mfu.ac.th", "b@x.org"]);
    expect(parseAdminEmails(undefined)).toEqual([]);
  });
});

describe("local hosts", () => {
  it("treats only loopback hosts as local", () => {
    expect(isLocalHostname("localhost")).toBe(true);
    expect(isLocalHostname("127.0.0.1")).toBe(true);
    expect(isLocalHostname("digital-muscle.workers.dev")).toBe(false);
  });
});
