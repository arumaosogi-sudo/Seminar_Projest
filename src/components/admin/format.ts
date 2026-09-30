import type { TestKind } from "@shared/contract";
import { ApiRequestError } from "@/lib/api";

/** Human-readable message for any thrown value (API errors carry the server's message). */
export function errorMessage(e: unknown, fallback = "Something went wrong. Please try again."): string {
  if (e instanceof ApiRequestError) return e.message || fallback;
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

export function isApiStatus(e: unknown, status: number): e is ApiRequestError {
  return e instanceof ApiRequestError && e.status === status;
}

export const kindLabel: Record<TestKind, string> = { pretest: "Pretest", posttest: "Posttest", other: "Other" };

const rtf = typeof Intl !== "undefined" ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }) : null;

/** "3 minutes ago", "yesterday", … — falls back to the date for anything older than ~30 days. */
export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const diffSec = Math.round((t - now) / 1000);
  const abs = Math.abs(diffSec);
  if (!rtf) return formatDateTime(iso);
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), "day");
  return formatDate(iso);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO (UTC) → value for <input type="datetime-local"> in the browser's local time zone. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value (local time) → ISO UTC string, or null when empty/invalid. */
export function localInputToIso(value: string): string | null {
  if (!value) return null;
  // "YYYY-MM-DDTHH:mm" without an offset is parsed as local time by the Date constructor.
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function todayStamp(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "2569/1 · Section 1" → "2569-1-section-1" (safe for file names). */
export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "class"
  );
}

export function fmtNum(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toFixed(digits).replace(/\.0+$/, "");
}

export function signed(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const s = fmtNum(Math.abs(n), digits);
  if (n > 0) return `+${s}`;
  if (n < 0) return `−${s}`;
  return "0";
}

/** Copy to clipboard with a fallback for non-secure contexts. Resolves false when both fail. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Minimal localStorage wrapper — storage may be blocked (private mode, policies). */
export const safeStorage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
};
