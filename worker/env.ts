import type { Role } from "../shared/contract";
import { HttpError } from "./http";
import { isLocalHostname, parseAdminEmails } from "./identity";

/*
 * `wrangler types` already generates SESSION_SECRET / DEV_LOGIN / ADMIN_EMAILS / GOOGLE_CLIENT_ID
 * from .dev.vars + wrangler.jsonc (worker/worker-configuration.d.ts). In production DEV_LOGIN is
 * normally absent, so every reader below tolerates `undefined` even though the type says string.
 */

export const SESSION_COOKIE = "dm_session";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const MIN_SECRET_LENGTH = 32;

export interface SessionPayload {
  sub: string; // student id, or admin e-mail
  role: Role;
  email: string;
}

export interface StudentContext {
  id: number;
  studentCode: string;
  email: string;
  firstName: string | null;
  enrollment: {
    id: number;
    classId: number;
    className: string;
    academicYear: number;
    semester: number;
    classStatus: "active" | "archived";
  } | null;
}

export interface AdminContext {
  id: number | null;
  email: string;
  name: string | null;
}

export type AppEnv = {
  Bindings: Env;
  Variables: {
    student: StudentContext;
    admin: AdminContext;
  };
};

/**
 * Dev login needs DEV_LOGIN=true AND a loopback request host (defence in depth: a DEV_LOGIN var accidentally
 * deployed to production still cannot be used from a real domain).
 */
export function isDevLoginEnabled(env: Env, requestUrl: string): boolean {
  if ((env.DEV_LOGIN as string | undefined) !== "true") return false;
  try {
    return isLocalHostname(new URL(requestUrl).hostname);
  } catch {
    return false;
  }
}

export function studentDomain(env: Env): string {
  return ((env.ALLOWED_STUDENT_DOMAIN as string | undefined) || "lamduan.mfu.ac.th").trim().toLowerCase();
}

export function googleClientId(env: Env): string {
  return ((env.GOOGLE_CLIENT_ID as string | undefined) ?? "").trim();
}

export function envAdminEmails(env: Env): string[] {
  return parseAdminEmails(env.ADMIN_EMAILS as string | undefined);
}

/** Refuses to issue / read sessions without a strong secret. */
export function sessionKey(env: Env): Uint8Array {
  const secret = env.SESSION_SECRET as string | undefined;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new HttpError(
      500,
      "server_misconfigured",
      `SESSION_SECRET is missing or shorter than ${MIN_SECRET_LENGTH} characters. Set it in .dev.vars (local) or with \`wrangler secret put SESSION_SECRET\`.`,
    );
  }
  return new TextEncoder().encode(secret);
}
