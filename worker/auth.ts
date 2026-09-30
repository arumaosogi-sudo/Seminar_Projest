/**
 * Sessions (HS256 JWT in the `dm_session` cookie), Google ID-token verification and role guards.
 * Rules: docs/ARCHITECTURE.md §3. Never log tokens or cookies.
 */
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { SignJWT, createRemoteJWKSet, errors as joseErrors, jwtVerify } from "jose";
import type { AdminMe, StudentMe } from "../shared/contract";
import { queryAll, queryFirst } from "./db";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  envAdminEmails,
  googleClientId,
  sessionKey,
  type AdminContext,
  type AppEnv,
  type SessionPayload,
  type StudentContext,
} from "./env";
import { HttpError, forbidden, unauthenticated } from "./http";
import { isLocalHostname } from "./identity";

const ISSUER = "dm";

/* ───────────── session token + cookie ───────────── */

export async function signSession(env: Env, payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role, email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(sessionKey(env));
}

export async function readSession(c: Context<AppEnv>): Promise<SessionPayload | null> {
  const key = sessionKey(c.env); // throws 500 when misconfigured (even for anonymous reads)
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key, { issuer: ISSUER, algorithms: ["HS256"] });
    const role = payload.role;
    if (typeof payload.sub !== "string" || typeof payload.email !== "string" || (role !== "student" && role !== "admin")) {
      return null;
    }
    return { sub: payload.sub, role, email: payload.email };
  } catch {
    return null;
  }
}

function cookieIsSecure(c: Context): boolean {
  return !isLocalHostname(new URL(c.req.url).hostname);
}

export async function startSession(c: Context<AppEnv>, payload: SessionPayload): Promise<void> {
  const token = await signSession(c.env, payload);
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
    secure: cookieIsSecure(c),
  });
}

export function endSession(c: Context): void {
  deleteCookie(c, SESSION_COOKIE, { path: "/", secure: cookieIsSecure(c), httpOnly: true, sameSite: "Lax" });
}

/* ───────────── Google ID token ───────────── */

// Module-level so the JWKS cache survives between requests in the same isolate.
const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export interface GoogleIdentity {
  email: string;
  emailVerified: boolean;
  hd: string | null;
  name: string | null;
}

export async function verifyGoogleCredential(env: Env, credential: string): Promise<GoogleIdentity> {
  const audience = googleClientId(env);
  if (!audience) {
    throw new HttpError(503, "google_not_configured", "Google sign-in is not configured yet (GOOGLE_CLIENT_ID is empty).");
  }
  try {
    const { payload } = await jwtVerify(credential, googleJwks, {
      issuer: ["accounts.google.com", "https://accounts.google.com"],
      audience,
      algorithms: ["RS256"],
    });
    if (typeof payload.email !== "string") throw new HttpError(401, "invalid_token", "Google account has no e-mail address.");
    return {
      email: payload.email.trim().toLowerCase(),
      emailVerified: payload.email_verified === true || payload.email_verified === "true",
      hd: typeof payload.hd === "string" ? payload.hd.toLowerCase() : null,
      name: typeof payload.given_name === "string" ? payload.given_name : null,
    };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err instanceof joseErrors.JOSEError) throw new HttpError(401, "invalid_token", "Google sign-in could not be verified. Please try again.");
    throw err;
  }
}

/* ───────────── admins ───────────── */

export async function findAdmin(db: D1Database, env: Env, email: string): Promise<AdminContext | null> {
  const e = email.trim().toLowerCase();
  const row = await queryFirst<{ id: number; email: string; name: string | null }>(
    db,
    "SELECT id, email, name FROM admins WHERE email = ?",
    e,
  );
  if (row) return { id: row.id, email: row.email.toLowerCase(), name: row.name };
  if (envAdminEmails(env).includes(e)) return { id: null, email: e, name: null };
  return null;
}

export function toAdminMe(a: AdminContext): AdminMe {
  return { role: "admin", admin: { id: a.id, email: a.email, name: a.name } };
}

/* ───────────── students ───────────── */

interface StudentRow {
  id: number;
  student_code: string | null;
  email: string | null;
  first_name: string | null;
  anonymized_at: string | null;
}

interface EnrollmentRow {
  id: number;
  class_id: number;
  status: "active" | "withdrawn";
  joined_at: string;
  name: string;
  academic_year: number;
  semester: number;
  class_status: "active" | "archived";
}

export type StudentLoad =
  | { kind: "ok"; student: StudentContext }
  | { kind: "missing" }
  | { kind: "anonymized" }
  | { kind: "withdrawn" };

/**
 * Loads a student with their current enrollment: the newest active enrollment, preferring non-archived classes.
 * A student whose enrollments are all withdrawn is reported as `withdrawn`.
 */
export async function loadStudent(db: D1Database, studentId: number): Promise<StudentLoad> {
  const s = await queryFirst<StudentRow>(
    db,
    "SELECT id, student_code, email, first_name, anonymized_at FROM students WHERE id = ?",
    studentId,
  );
  if (!s) return { kind: "missing" };
  if (s.anonymized_at || !s.student_code || !s.email) return { kind: "anonymized" };
  const enrollments = await queryAll<EnrollmentRow>(
    db,
    `SELECT e.id, e.class_id, e.status, e.joined_at, c.name, c.academic_year, c.semester, c.status AS class_status
       FROM enrollments e JOIN classes c ON c.id = e.class_id
      WHERE e.student_id = ?
      ORDER BY (c.status = 'active') DESC, e.joined_at DESC, e.id DESC`,
    studentId,
  );
  const active = enrollments.filter((e) => e.status === "active");
  if (enrollments.length > 0 && active.length === 0) return { kind: "withdrawn" };
  const cur = active[0];
  return {
    kind: "ok",
    student: {
      id: s.id,
      studentCode: s.student_code,
      email: s.email,
      firstName: s.first_name,
      enrollment: cur
        ? {
            id: cur.id,
            classId: cur.class_id,
            className: cur.name,
            academicYear: cur.academic_year,
            semester: cur.semester,
            classStatus: cur.class_status,
          }
        : null,
    },
  };
}

export function toStudentMe(s: StudentContext, joinNotice?: string): StudentMe {
  const me: StudentMe = {
    role: "student",
    student: {
      id: s.id,
      studentCode: s.studentCode,
      email: s.email,
      firstName: s.firstName,
      needsOnboarding: !s.firstName || s.firstName.trim() === "",
    },
    enrollment: s.enrollment
      ? { id: s.enrollment.id, classId: s.enrollment.classId, className: s.enrollment.className, status: "active" }
      : null,
  };
  if (joinNotice) me.joinNotice = joinNotice;
  return me;
}

export const WITHDRAWN_MESSAGE =
  "Your enrollment has been withdrawn. Please contact your instructor if you think this is a mistake.";

export const ANONYMIZED_MESSAGE = "This account's data has been removed and it can no longer sign in.";

/* ───────────── guards ───────────── */

export const requireStudent = createMiddleware<AppEnv>(async (c, next) => {
  const session = await readSession(c);
  if (!session || session.role !== "student") throw unauthenticated();
  const id = Number(session.sub);
  if (!Number.isSafeInteger(id)) throw unauthenticated();
  const load = await loadStudent(c.env.DB, id);
  if (load.kind === "missing") {
    endSession(c);
    throw unauthenticated();
  }
  if (load.kind === "anonymized") {
    endSession(c);
    throw forbidden(ANONYMIZED_MESSAGE, "anonymized");
  }
  if (load.kind === "withdrawn") throw forbidden(WITHDRAWN_MESSAGE, "withdrawn");
  c.set("student", load.student);
  await next();
});

/** Re-checks the admin list on every request (removing an admin takes effect immediately). */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const session = await readSession(c);
  if (!session) throw unauthenticated();
  if (session.role !== "admin") throw forbidden("Instructor access only.");
  const admin = await findAdmin(c.env.DB, c.env, session.email);
  if (!admin) throw forbidden("Your account is no longer an instructor account.", "not_admin");
  c.set("admin", admin);
  await next();
});
