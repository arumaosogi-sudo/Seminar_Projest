/**
 * Keyed hashes of anonymized identities (pure WebCrypto — works in Workers and Node, unit-tested).
 * We keep HMAC-SHA256(identity, SESSION_SECRET) so an anonymized student cannot sign up again,
 * without storing the e-mail or student code itself. Without the secret the hash cannot be reversed
 * by brute-forcing the small student-code space.
 */

const encoder = new TextEncoder();

export async function hmacSha256Hex(secret: string | Uint8Array, message: string): Promise<string> {
  const keyBytes = typeof secret === "string" ? encoder.encode(secret) : secret;
  const key = await crypto.subtle.importKey("raw", keyBytes as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
  let hex = "";
  for (const b of sig) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** Hashes stored for one anonymized student: lower-cased e-mail and student code (domain-separated). */
export async function anonymizedIdentityHashes(
  secret: string | Uint8Array,
  identity: { email?: string | null; studentCode?: string | null },
): Promise<string[]> {
  const out: string[] = [];
  if (identity.email) out.push(await hmacSha256Hex(secret, `email:${identity.email.trim().toLowerCase()}`));
  if (identity.studentCode) out.push(await hmacSha256Hex(secret, `code:${identity.studentCode.trim()}`));
  return out;
}
