#!/usr/bin/env node
/**
 * DEV ONLY — wipes the LOCAL D1 database, re-applies all migrations and loads scripts/seed.dev.sql.
 * Usage: npm run db:reset   (stop `npm run dev` first so the SQLite file is not locked)
 * Never touches the remote (production) database: every wrangler call uses --local.
 */
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const d1Dir = resolve(root, ".wrangler", "state", "v3", "d1");

function run(args) {
  console.log(`\n> npx ${args.join(" ")}`);
  // One command string + shell: npx is npx.cmd on Windows. Arguments are fixed constants (no user input).
  const res = spawnSync(`npx ${args.join(" ")}`, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, CI: "true" }, // non-interactive: skip wrangler's confirmation prompt
  });
  if (res.status !== 0) {
    console.error(`\nFailed: npx ${args.join(" ")}`);
    process.exit(res.status ?? 1);
  }
}

if (existsSync(d1Dir)) {
  try {
    rmSync(d1Dir, { recursive: true, force: true });
    console.log(`Deleted ${d1Dir}`);
  } catch (err) {
    console.error(`Could not delete ${d1Dir} — is the dev server still running? (${err.message})`);
    process.exit(1);
  }
}

run(["wrangler", "d1", "migrations", "apply", "DB", "--local"]);
run(["wrangler", "d1", "execute", "DB", "--local", "--file=./scripts/seed.dev.sql"]);
console.log("\nLocal database reset and seeded. Dev logins: instructor@mfu.ac.th (admin), 6531501011@lamduan.mfu.ac.th (student).");
