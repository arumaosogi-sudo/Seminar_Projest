import { describe, expect, it } from "vitest";
import { hashPassword, isPasswordHash, timingSafeEqual, verifyPassword } from "./password";

describe("admin password hashing", () => {
  it("verifies the right password and rejects others", async () => {
    const h = await hashPassword("correct horse battery", 2_000);
    expect(isPasswordHash(h)).toBe(true);
    expect(h.startsWith("pbkdf2_sha256$2000$")).toBe(true);
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("correct horse batterY", h)).toBe(false);
    expect(await verifyPassword("", h)).toBe(false);
  });

  it("uses a random salt (same password → different hashes)", async () => {
    const a = await hashPassword("same-password", 2_000);
    const b = await hashPassword("same-password", 2_000);
    expect(a).not.toBe(b);
  });

  it("rejects malformed or out-of-range hashes", async () => {
    for (const bad of ["", "plain-text", "pbkdf2_sha256$10$AAAA$BBBB", "md5$1000$a$b", "pbkdf2_sha256$999999$c2FsdHNhbHQ=$" + "A".repeat(44)]) {
      expect(isPasswordHash(bad)).toBe(false);
      expect(await verifyPassword("x", bad)).toBe(false);
    }
  });

  it("compares bytes in constant time", () => {
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
    expect(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false);
  });
});
