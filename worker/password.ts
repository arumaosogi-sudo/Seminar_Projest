/**
 * Password hashing for the local admin account (username + password, used until instructors sign in with Google).
 * Stored format: `pbkdf2_sha256$<iterations>$<saltBase64>$<hashBase64>` — generate one with `npm run admin:hash`.
 * The plain password is never stored or logged; only the hash lives in `.dev.vars` / `wrangler secret`.
 */

const PREFIX = "pbkdf2_sha256";
const KEY_BITS = 256;
/** Workers' free plan allows ~10 ms CPU per request, so keep PBKDF2 moderate; login attempts are rate-limited too. */
export const DEFAULT_ITERATIONS = 20_000;
const MAX_ITERATIONS = 100_000; // Workers' WebCrypto limit

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, KEY_BITS);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string, iterations = DEFAULT_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, iterations);
  return `${PREFIX}$${iterations}$${toB64(salt)}$${toB64(hash)}`;
}

/** True when `stored` is a well-formed hash string (used to decide whether password login is offered). */
export function isPasswordHash(stored: string | undefined): stored is string {
  return typeof stored === "string" && parse(stored) !== null;
}

function parse(stored: string): { iterations: number; salt: Uint8Array; hash: Uint8Array } | null {
  const parts = stored.trim().split("$");
  if (parts.length !== 4 || parts[0] !== PREFIX) return null;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1_000 || iterations > MAX_ITERATIONS) return null;
  try {
    const salt = fromB64(parts[2]);
    const hash = fromB64(parts[3]);
    if (salt.length < 8 || hash.length !== KEY_BITS / 8) return null;
    return { iterations, salt, hash };
  } catch {
    return null;
  }
}

/** Constant-time comparison of two byte arrays (lengths are not secret). */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const p = parse(stored);
  if (!p) return false;
  const candidate = await derive(password, p.salt, p.iterations);
  return timingSafeEqual(candidate, p.hash);
}
