/**
 * Helpers shared by the student auth screens (Login, Join, Onboarding) and reusable by the admin login.
 * Kept free of React so they are trivially testable.
 */
import { ApiRequestError } from "@/lib/api";

/** Friendly copy for the machine `code` returned by /api/auth/* (see docs/ARCHITECTURE.md §3). */
const AUTH_ERROR_COPY: Record<string, string> = {
  domain_not_allowed: "Please use your @lamduan.mfu.ac.th account.",
  not_student_account: "This account isn't a student account. Sign in with your @lamduan.mfu.ac.th e-mail (student ID + domain).",
  withdrawn: "Your access was withdrawn by your instructor. Please contact them if you think this is a mistake.",
  anonymized: "This account has been removed from the system. Please contact your instructor.",
  class_archived: "This class has ended and is no longer accepting students. Ask your instructor for the current QR code.",
  not_in_roster: "Your student ID isn't on this section's class list. Please check with your instructor.",
  invalid_join_code: "This join code isn't valid. Scan your section's QR code again.",
  invalid_token: "Google sign-in couldn't be verified. Please try again.",
  email_not_verified: "Your Google e-mail address isn't verified yet.",
  not_admin: "This account doesn't have instructor access.",
  dev_login_disabled: "Developer sign-in is turned off on this server.",
};

export function describeAuthError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.code && AUTH_ERROR_COPY[error.code]) return AUTH_ERROR_COPY[error.code];
    if (error.status === 429) return "Too many attempts. Please wait a moment and try again.";
    if (error.status >= 500) return "The server had a problem. Please try again in a moment.";
    return error.message || "Sign-in failed. Please try again.";
  }
  if (error instanceof TypeError) return "Can't reach the server. Check your internet connection and try again.";
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}

/**
 * Only allow in-app redirects ("/games", "/tests?x=1"). Rejects protocol-relative ("//evil.com")
 * and absolute URLs so `state.from` can never become an open redirect.
 */
export function safeRedirect(from: unknown, fallback = "/"): string {
  if (typeof from !== "string") return fallback;
  if (!from.startsWith("/") || from.startsWith("//") || from.startsWith("/\\")) return fallback;
  if (from.startsWith("/login") || from.startsWith("/onboarding") || from.startsWith("/join/")) return fallback;
  return from;
}

const NOTICE_KEY = "dm_join_notice";

/** One-shot notice from the login response (e.g. "already in Section 2 this semester"), shown once on Home. */
export const joinNoticeStore = {
  get: (): string | undefined => {
    try {
      return sessionStorage.getItem(NOTICE_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  },
  set: (notice: string) => {
    try {
      sessionStorage.setItem(NOTICE_KEY, notice);
    } catch {
      /* storage unavailable — notice is simply not shown */
    }
  },
  clear: () => {
    try {
      sessionStorage.removeItem(NOTICE_KEY);
    } catch {
      /* ignore */
    }
  },
};
