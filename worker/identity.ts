/** Pure identity helpers (no Cloudflare imports) — unit-tested. Rules: docs/ARCHITECTURE.md §3. */

export const STUDENT_CODE_RE = /^\d{8,12}$/;

export type StudentEmailCheck =
  | { ok: true; studentCode: string; email: string }
  | { ok: false; code: "domain_not_allowed" | "not_student_account"; error: string };

/** Student e-mail = `<8–12 digit student code>@<allowed domain>` (case-insensitive). */
export function parseStudentEmail(rawEmail: string, allowedDomain: string): StudentEmailCheck {
  const email = rawEmail.trim().toLowerCase();
  const domain = allowedDomain.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at <= 0 || email.slice(at + 1) !== domain) {
    return { ok: false, code: "domain_not_allowed", error: `Please sign in with your @${domain} account.` };
  }
  const local = email.slice(0, at);
  if (!STUDENT_CODE_RE.test(local)) {
    return {
      ok: false,
      code: "not_student_account",
      error: "This account is not a student account (the e-mail must start with your student ID).",
    };
  }
  return { ok: true, studentCode: local, email };
}

/** Comma-separated ADMIN_EMAILS → lower-cased unique list. */
export function parseAdminEmails(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const e = part.trim().toLowerCase();
    if (e && e.includes("@")) seen.add(e);
  }
  return [...seen];
}

/** Cookies are `Secure` everywhere except plain-HTTP local development hosts. */
export function isLocalHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
}

export function className(academicYear: number, semester: number, section: number): string {
  return `${academicYear}/${semester} · Section ${section}`;
}
