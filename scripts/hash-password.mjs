#!/usr/bin/env node
/**
 * Creates ADMIN_PASSWORD_HASH for the username/password instructor sign-in.
 *
 *   npm run admin:hash                 → asks for the password (input hidden), prints the hash
 *   echo <password> | npm run admin:hash   (password from stdin, e.g. in scripts)
 *
 * Put the result in .dev.vars (local) as ADMIN_PASSWORD_HASH=..., together with ADMIN_USERNAME=...
 * In production:  npx wrangler secret put ADMIN_PASSWORD_HASH   (and set ADMIN_USERNAME in wrangler.jsonc vars)
 * The format must match worker/password.ts.
 */
import { stdin, stdout, stderr } from "node:process";

const ITERATIONS = 20_000; // keep in sync with DEFAULT_ITERATIONS in worker/password.ts

async function readPassword() {
  if (!stdin.isTTY) {
    let data = "";
    for await (const chunk of stdin) data += chunk;
    return data.replace(/\r?\n$/, "");
  }
  stderr.write("Admin password (input hidden): ");
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve) => {
    let pw = "";
    stdin.on("data", (ch) => {
      if (ch === "\r" || ch === "\n" || ch === "\u0004") {
        stdin.setRawMode(false);
        stdin.pause();
        stderr.write("\n");
        resolve(pw);
      } else if (ch === "\u0003") {
        process.exit(130);
      } else if (ch === "\u007f" || ch === "\b") {
        pw = pw.slice(0, -1);
      } else {
        pw += ch;
      }
    });
  });
}

const password = await readPassword();
if (password.length < 8) {
  stderr.write("Password must be at least 8 characters.\n");
  process.exit(1);
}

const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS }, key, 256));
const b64 = (u8) => Buffer.from(u8).toString("base64");
stdout.write(`pbkdf2_sha256$${ITERATIONS}$${b64(salt)}$${b64(bits)}\n`);
