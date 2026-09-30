import { Hono, type Context } from "hono";
import {
  devLoginBody,
  googleLoginBody,
  updateMeBody,
  type AppConfig,
  type Me,
  type PublicClassInfo,
} from "../../shared/contract";
import {
  ANONYMIZED_MESSAGE,
  WITHDRAWN_MESSAGE,
  endSession,
  findAdmin,
  loadStudent,
  readSession,
  requireStudent,
  startSession,
  toAdminMe,
  toStudentMe,
  verifyGoogleCredential,
} from "../auth";
import { execute, nowIso, placeholders, queryFirst } from "../db";
import { anonymizedIdentityHashes } from "../identityHash";
import { googleClientId, isDevLoginEnabled, sessionKey, studentDomain, type AppEnv } from "../env";
import { normalizeJoinCode } from "../grading";
import { HttpError, forbidden, readBody, unauthenticated } from "../http";
import { parseStudentEmail } from "../identity";

export const publicRoutes = new Hono<AppEnv>();

publicRoutes.get("/health", (c) => c.json({ ok: true }));

publicRoutes.get("/config", (c) => {
  const cfg: AppConfig = {
    googleClientId: googleClientId(c.env),
    devLogin: isDevLoginEnabled(c.env, c.req.url),
    allowedStudentDomain: studentDomain(c.env),
  };
  return c.json(cfg);
});

interface ClassRow {
  id: number;
  name: string;
  academic_year: number;
  semester: number;
  section: number;
  status: "active" | "archived";
  restrict_to_roster: number;
}

publicRoutes.get("/classes/by-code/:code", async (c) => {
  const code = normalizeJoinCode(c.req.param("code"));
  const unknown = new HttpError(404, "invalid_join_code", "Unknown join code.");
  if (!/^[A-Z0-9-]{4,16}$/.test(code)) throw unknown;
  const row = await queryFirst<ClassRow>(
    c.env.DB,
    "SELECT id, name, academic_year, semester, section, status, restrict_to_roster FROM classes WHERE join_code = ?",
    code,
  );
  if (!row) throw unknown;
  if (row.status === "archived") throw new HttpError(410, "class_archived", `${row.name} is archived and no longer accepts students.`);
  const info: PublicClassInfo = {
    id: row.id,
    name: row.name,
    academicYear: row.academic_year,
    semester: row.semester,
    section: row.section,
    status: row.status,
  };
  return c.json(info);
});

/* ───────────── login ───────────── */

/**
 * Applies a join code (docs/ARCHITECTURE.md §3). Returns a notice when the code was ignored.
 * Never re-activates a withdrawn enrollment and never enrolls a student withdrawn this semester elsewhere.
 */
async function applyJoinCode(db: D1Database, studentId: number, studentCode: string, rawCode: string): Promise<string | undefined> {
  const code = normalizeJoinCode(rawCode);
  const cls = await queryFirst<ClassRow>(
    db,
    "SELECT id, name, academic_year, semester, section, status, restrict_to_roster FROM classes WHERE join_code = ?",
    code,
  );
  if (!cls) return `The join code ${code} was not found. Please check the QR code with your instructor.`;
  if (cls.status === "archived") return `${cls.name} is archived and no longer accepts students.`;

  const existing = await queryFirst<{ status: string }>(
    db,
    "SELECT status FROM enrollments WHERE student_id = ? AND class_id = ?",
    studentId,
    cls.id,
  );
  if (existing?.status === "active") return undefined;
  if (existing) return `You were withdrawn from ${cls.name}. Please contact your instructor.`;

  if (cls.restrict_to_roster === 1) {
    const listed = await queryFirst<{ one: number }>(
      db,
      "SELECT 1 AS one FROM class_roster WHERE class_id = ? AND student_code = ?",
      cls.id,
      studentCode,
    );
    if (!listed) return `Your student ID is not on the roster of ${cls.name}. Please contact your instructor.`;
  }

  const sameTerm = await queryFirst<{ name: string; status: string }>(
    db,
    `SELECT c.name, e.status FROM enrollments e JOIN classes c ON c.id = e.class_id
      WHERE e.student_id = ? AND c.academic_year = ? AND c.semester = ? AND c.id <> ?
      ORDER BY (e.status = 'active') DESC LIMIT 1`,
    studentId,
    cls.academic_year,
    cls.semester,
    cls.id,
  );
  if (sameTerm?.status === "active") {
    return `You are already in ${sameTerm.name} this semester, so you stayed there. Ask your instructor to move you if this is wrong.`;
  }
  if (sameTerm) return `You were withdrawn from ${sameTerm.name} this semester. Please contact your instructor.`;

  await execute(
    db,
    "INSERT OR IGNORE INTO enrollments (student_id, class_id, status, joined_at) VALUES (?, ?, 'active', ?)",
    studentId,
    cls.id,
    nowIso(),
  );
  return undefined;
}

async function loginStudent(c: Context<AppEnv>, email: string, joinCode: string | undefined) {
  const check = parseStudentEmail(email, studentDomain(c.env));
  if (!check.ok) throw forbidden(check.error, check.code);
  const db = c.env.DB;
  const now = nowIso();

  // Anonymized students cannot sign in again (not even as a "new" student) — migration 0003.
  const hashes = await anonymizedIdentityHashes(sessionKey(c.env), { email: check.email, studentCode: check.studentCode });
  const blocked = await queryFirst(
    db,
    `SELECT 1 AS one FROM anonymized_identities WHERE hash IN (${placeholders(hashes.length)}) LIMIT 1`,
    ...hashes,
  );
  if (blocked) throw forbidden(ANONYMIZED_MESSAGE, "anonymized");

  let student = await queryFirst<{ id: number }>(
    db,
    "SELECT id FROM students WHERE email = ? OR student_code = ? LIMIT 1",
    check.email,
    check.studentCode,
  );
  if (!student) {
    await execute(
      db,
      "INSERT OR IGNORE INTO students (student_code, email, created_at) VALUES (?, ?, ?)",
      check.studentCode,
      check.email,
      now,
    );
    student = await queryFirst<{ id: number }>(db, "SELECT id FROM students WHERE student_code = ?", check.studentCode);
    if (!student) throw new Error("Failed to create student");
  }

  const joinNotice = joinCode ? await applyJoinCode(db, student.id, check.studentCode, joinCode) : undefined;

  const load = await loadStudent(db, student.id);
  if (load.kind === "withdrawn") throw forbidden(WITHDRAWN_MESSAGE, "withdrawn");
  if (load.kind === "anonymized") throw forbidden(ANONYMIZED_MESSAGE, "anonymized");
  if (load.kind === "missing") throw unauthenticated("This account can no longer sign in.");

  await execute(db, "UPDATE students SET last_login_at = ? WHERE id = ?", now, student.id);
  await startSession(c, { sub: String(student.id), role: "student", email: check.email });
  return c.json<Me>(toStudentMe(load.student, joinNotice));
}

async function loginAdmin(c: Context<AppEnv>, email: string) {
  const admin = await findAdmin(c.env.DB, c.env, email);
  if (!admin) throw forbidden("This account is not an instructor account.", "not_admin");
  await startSession(c, { sub: admin.email, role: "admin", email: admin.email });
  return c.json<Me>(toAdminMe(admin));
}

publicRoutes.post("/auth/google", async (c) => {
  const body = await readBody(c, googleLoginBody);
  const id = await verifyGoogleCredential(c.env, body.credential);
  if (!id.emailVerified) throw forbidden("Your Google e-mail address is not verified.", "email_not_verified");
  if (body.as === "admin") return loginAdmin(c, id.email);
  const domain = studentDomain(c.env);
  if (id.hd !== domain) throw forbidden(`Please sign in with your @${domain} account.`, "domain_not_allowed");
  return loginStudent(c, id.email, body.joinCode);
});

publicRoutes.post("/auth/dev", async (c) => {
  if (!isDevLoginEnabled(c.env, c.req.url)) throw new HttpError(404, "dev_login_disabled", "Dev login is disabled.");
  const body = await readBody(c, devLoginBody);
  if (body.as === "admin") return loginAdmin(c, body.email);
  return loginStudent(c, body.email, body.joinCode);
});

publicRoutes.post("/auth/logout", (c) => {
  endSession(c);
  return c.json({ ok: true as const });
});

/* ───────────── me ───────────── */

publicRoutes.get("/me", async (c) => {
  const session = await readSession(c);
  if (!session) throw unauthenticated();
  if (session.role === "admin") {
    const admin = await findAdmin(c.env.DB, c.env, session.email);
    if (!admin) throw forbidden("Your account is no longer an instructor account.", "not_admin");
    return c.json<Me>(toAdminMe(admin));
  }
  const id = Number(session.sub);
  const load = Number.isSafeInteger(id) ? await loadStudent(c.env.DB, id) : ({ kind: "missing" } as const);
  if (load.kind === "missing") {
    endSession(c);
    throw unauthenticated();
  }
  if (load.kind === "anonymized") {
    endSession(c);
    throw forbidden(ANONYMIZED_MESSAGE, "anonymized");
  }
  if (load.kind === "withdrawn") throw forbidden(WITHDRAWN_MESSAGE, "withdrawn");
  return c.json<Me>(toStudentMe(load.student));
});

publicRoutes.patch("/me", requireStudent, async (c) => {
  const body = await readBody(c, updateMeBody);
  const s = c.get("student");
  await execute(c.env.DB, "UPDATE students SET first_name = ? WHERE id = ?", body.firstName, s.id);
  return c.json<Me>(toStudentMe({ ...s, firstName: body.firstName }));
});

