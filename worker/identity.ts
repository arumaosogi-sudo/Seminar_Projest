/** Pure identity helpers (no Cloudflare imports) — unit-tested. Rules: docs/ARCHITECTURE.md §3. */

export const STUDENT_CODE_RE = /^\d{8,12}$/;

export type StudentEmailCheck =
  | { ok: true; studentCode: string; email: string }
  | { ok: false; code: "domain_not_allowed" | "not_student_account"; error: string };

/** Domain whose accounts are `<student code>@…` (the student code is required there). */
export const STUDENT_ID_DOMAIN = "lamduan.mfu.ac.th";
/** Local part accepted for other allowed domains (e.g. staff `name.s@mfu.ac.th`), used as the "student code". */
const OTHER_LOCAL_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;

/** "lamduan.mfu.ac.th, mfu.ac.th" → ["lamduan.mfu.ac.th", "mfu.ac.th"] (lower-cased, unique, order kept). */
export function parseDomains(raw: string | undefined | null, fallback = STUDENT_ID_DOMAIN): string[] {
  const out: string[] = [];
  for (const part of (raw || fallback).split(",")) {
    const d = part.trim().toLowerCase().replace(/^@/, "");
    if (d && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) && !out.includes(d)) out.push(d);
  }
  return out.length ? out : [fallback];
}

export function domainsLabel(domains: string[]): string {
  return domains.map((d) => `@${d}`).join(" or ");
}

/**
 * Student e-mail rules:
 *   `<8–12 digit student code>@lamduan.mfu.ac.th` → student code = the digits
 *   `<name>@<other allowed domain>` (e.g. mfu.ac.th staff/TA accounts) → student code = the local part
 * The domain must match exactly (sub-domains are rejected).
 */
export function parseStudentEmail(rawEmail: string, allowedDomains: string | string[]): StudentEmailCheck {
  const email = rawEmail.trim().toLowerCase();
  const domains = Array.isArray(allowedDomains) ? allowedDomains.map((d) => d.trim().toLowerCase()) : parseDomains(allowedDomains);
  const at = email.lastIndexOf("@");
  const domain = at > 0 ? email.slice(at + 1) : "";
  if (!domains.includes(domain)) {
    return { ok: false, code: "domain_not_allowed", error: `Please sign in with your ${domainsLabel(domains)} account.` };
  }
  const local = email.slice(0, at);
  if (domain === STUDENT_ID_DOMAIN) {
    if (!STUDENT_CODE_RE.test(local)) {
      return {
        ok: false,
        code: "not_student_account",
        error: "This account is not a student account (the e-mail must start with your student ID).",
      };
    }
  } else if (!OTHER_LOCAL_RE.test(local)) {
    return { ok: false, code: "not_student_account", error: "This e-mail address can't be used to sign in." };
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
