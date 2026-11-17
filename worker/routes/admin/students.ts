import { Hono } from "hono";
import {
  enrollStudentBody,
  moveEnrollmentBody,
  setEnrollmentStatusBody,
  type AdminStudentRow,
  type UnassignedStudent,
} from "../../../shared/contract";
import { auditStmt, nowIso, queryAll, queryFirst, stmt, type SqlValue } from "../../db";
import { envAdminEmails, sessionKey, type AppEnv } from "../../env";
import { anonymizedIdentityHashes } from "../../identityHash";
import { badRequest, conflict, forbidden, idParam, notFound, readBody } from "../../http";
import {
  ENROLLMENT_ROW_SELECT,
  assertOwner,
  assertVisibleClass,
  assertWritable,
  loadClassBasics,
  ownedClasses,
  loadStudentRow,
  toStudentRow,
  type EnrollmentRowFull,
  isEmergencyAdmin,
} from "./common";

export const studentAdminRoutes = new Hono<AppEnv>();

const STATUSES = ["active", "withdrawn", "all"] as const;

function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

/**
 * Students of a class (or of all non-archived classes). Roster codes that never joined appear as `not_joined`.
 * Filters: status (default all), q = student code / first name / e-mail substring.
 */
studentAdminRoutes.get("/students", async (c) => {
  const db = c.env.DB;
  const classIdRaw = c.req.query("classId");
  const status = (c.req.query("status") ?? "all") as (typeof STATUSES)[number];
  if (!STATUSES.includes(status)) throw badRequest("status must be active, withdrawn or all.");
  const q = (c.req.query("q") ?? "").trim().slice(0, 100);

  let classId: number | null = null;
  if (classIdRaw) {
    if (!/^\d+$/.test(classIdRaw)) throw badRequest("classId must be a number.");
    classId = Number(classIdRaw);
    assertVisibleClass(await loadClassBasics(db, classId), c.get("admin"));
  }
  const own = ownedClasses(c.get("admin"));

  const rows: AdminStudentRow[] = [];

  {
    const where: string[] = [];
    const params: SqlValue[] = [];
    if (classId !== null) {
      where.push("c.id = ?");
      params.push(classId);
    } else {
      where.push("c.status = 'active'", own.sql);
      params.push(...own.params);
    }
    if (status === "active" || status === "withdrawn") {
      where.push("e.status = ?");
      params.push(status);
    }
    if (q) {
      where.push("(s.student_code LIKE ? ESCAPE '\\' OR s.first_name LIKE ? ESCAPE '\\' OR s.email LIKE ? ESCAPE '\\')");
      const p = likePattern(q);
      params.push(p, p, p);
    }
    const found = await queryAll<EnrollmentRowFull>(
      db,
      `${ENROLLMENT_ROW_SELECT} WHERE ${where.join(" AND ")} ORDER BY c.academic_year DESC, c.semester DESC, c.section, s.student_code`,
      ...params,
    );
    rows.push(...found.map(toStudentRow));
  }

  return c.json(rows);
});

/**
 * Students who signed in but are in no class at all (opened the site without scanning a section QR).
 * Students with only withdrawn enrollments are not listed — they can't sign in until reactivated.
 */
studentAdminRoutes.get("/students/unassigned", async (c) => {
  // Students in no section belong to nobody yet, so only the username (emergency) account sees and places them.
  if (!isEmergencyAdmin(c.get("admin"))) throw forbidden("Only the admin username account can see students who are in no class.", "not_manager");
  const rows = await queryAll<{
    id: number;
    student_code: string;
    first_name: string | null;
    email: string;
    created_at: string;
    last_login_at: string | null;
  }>(
    c.env.DB,
    `SELECT s.id, s.student_code, s.first_name, s.email, s.created_at, s.last_login_at
       FROM students s
      WHERE s.anonymized_at IS NULL AND s.student_code IS NOT NULL AND s.email IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.student_id = s.id)
      ORDER BY COALESCE(s.last_login_at, s.created_at) DESC
      LIMIT 500`,
  );
  // Instructors who opened the student view (student sign-in with their own e-mail) are not students to place.
  const instructors = new Set(envAdminEmails(c.env));
  const adminRows = await queryAll<{ email: string }>(c.env.DB, "SELECT email FROM admins");
  adminRows.forEach((a) => instructors.add(a.email.toLowerCase()));
  return c.json(
    rows.filter((r) => !instructors.has(r.email.toLowerCase())).map<UnassignedStudent>((r) => ({
      studentId: r.id,
      studentCode: r.student_code,
      firstName: r.first_name,
      email: r.email,
      createdAt: r.created_at,
      lastLoginAt: r.last_login_at,
    })),
  );
});

/** The instructor adds a signed-in student to a section (same rules as joining with the QR code, minus the roster check). */
studentAdminRoutes.post("/students/:id/enroll", async (c) => {
  const id = idParam(c);
  const body = await readBody(c, enrollStudentBody);
  const db = c.env.DB;
  const student = await queryFirst<{ id: number; anonymized_at: string | null }>(db, "SELECT id, anonymized_at FROM students WHERE id = ?", id);
  if (!student) throw notFound("Student not found.");
  if (student.anonymized_at) throw conflict("This student has been anonymized.");
  const cls = await loadClassBasics(db, body.classId);
  assertOwner(cls.owner_email, c.get("admin"));
  assertWritable(cls);
  const existing = await queryFirst(db, "SELECT 1 AS one FROM enrollments WHERE student_id = ? AND class_id = ?", id, cls.id);
  if (existing) throw conflict(`The student is already enrolled in ${cls.name}.`);
  const other = await queryFirst<{ name: string }>(
    db,
    `SELECT c.name FROM enrollments e JOIN classes c ON c.id = e.class_id
      WHERE e.student_id = ? AND e.status = 'active' AND c.academic_year = ? AND c.semester = ?`,
    id,
    cls.academic_year,
    cls.semester,
  );
  if (other) throw conflict(`The student is already in ${other.name} this semester. Use “Move to section” there instead.`);
  await db.batch([
    stmt(db, "INSERT INTO enrollments (student_id, class_id, status, joined_at) VALUES (?, ?, 'active', ?)", id, cls.id, nowIso()),
    auditStmt(db, c.get("admin").email, "student.enroll", "student", id, { classId: cls.id }),
  ]);
  const enr = await queryFirst<{ id: number }>(db, "SELECT id FROM enrollments WHERE student_id = ? AND class_id = ?", id, cls.id);
  if (!enr) throw new Error("Failed to enroll the student");
  return c.json(await loadStudentRow(db, enr.id));
});

/** Every enrollment of one student in any class (archived included) — used before a hard delete. */
studentAdminRoutes.get("/students/:id/enrollments", async (c) => {
  const id = idParam(c);
  const own = ownedClasses(c.get("admin"));
  const rows = await queryAll<EnrollmentRowFull>(c.env.DB, `${ENROLLMENT_ROW_SELECT} WHERE s.id = ? AND ${own.sql} ORDER BY e.id`, id, ...own.params);
  return c.json(rows.map(toStudentRow));
});

interface EnrollmentCore {
  id: number;
  student_id: number;
  class_id: number;
  status: "active" | "withdrawn";
}

async function loadEnrollment(db: D1Database, id: number): Promise<EnrollmentCore> {
  const row = await queryFirst<EnrollmentCore>(db, "SELECT id, student_id, class_id, status FROM enrollments WHERE id = ?", id);
  if (!row) throw notFound("Enrollment not found.");
  return row;
}

/** Withdraw / reactivate. Reactivation is refused if the student is already active in another section that semester. */
studentAdminRoutes.patch("/enrollments/:id", async (c) => {
  const id = idParam(c);
  const body = await readBody(c, setEnrollmentStatusBody);
  const db = c.env.DB;
  const enr = await loadEnrollment(db, id);
  const cls = await loadClassBasics(db, enr.class_id);
  assertOwner(cls.owner_email, c.get("admin"));
  assertWritable(cls);
  if (enr.status !== body.status) {
    if (body.status === "active") {
      const other = await queryFirst<{ name: string }>(
        db,
        `SELECT c.name FROM enrollments e JOIN classes c ON c.id = e.class_id
          WHERE e.student_id = ? AND e.status = 'active' AND c.academic_year = ? AND c.semester = ? AND e.id <> ?`,
        enr.student_id,
        cls.academic_year,
        cls.semester,
        id,
      );
      if (other) throw conflict(`The student is already active in ${other.name} this semester.`);
    }
    await db.batch([
      stmt(
        db,
        "UPDATE enrollments SET status = ?, withdrawn_at = ? WHERE id = ?",
        body.status,
        body.status === "withdrawn" ? nowIso() : null,
        id,
      ),
      auditStmt(db, c.get("admin").email, body.status === "withdrawn" ? "student.withdraw" : "student.reactivate", "enrollment", id, {
        studentId: enr.student_id,
        classId: enr.class_id,
      }),
    ]);
  }
  return c.json(await loadStudentRow(db, id));
});

/** Move an enrollment to another section; attempts reference the enrollment, so scores move with it. */
studentAdminRoutes.post("/enrollments/:id/move", async (c) => {
  const id = idParam(c);
  const body = await readBody(c, moveEnrollmentBody);
  const db = c.env.DB;
  const enr = await loadEnrollment(db, id);
  if (enr.class_id === body.classId) throw badRequest("The student is already in that section.");
  const from = await loadClassBasics(db, enr.class_id);
  assertOwner(from.owner_email, c.get("admin"));
  assertWritable(from);
  const to = await loadClassBasics(db, body.classId);
  assertOwner(to.owner_email, c.get("admin"));
  if (to.status === "archived") throw conflict(`${to.name} is archived.`, "class_archived");
  const already = await queryFirst(
    db,
    "SELECT 1 AS one FROM enrollments WHERE student_id = ? AND class_id = ?",
    enr.student_id,
    to.id,
  );
  if (already) throw conflict(`The student is already enrolled in ${to.name}.`);
  await db.batch([
    stmt(db, "UPDATE enrollments SET class_id = ? WHERE id = ?", to.id, id),
    auditStmt(db, c.get("admin").email, "student.move", "enrollment", id, {
      studentId: enr.student_id,
      fromClassId: from.id,
      toClassId: to.id,
    }),
  ]);
  return c.json(await loadStudentRow(db, id));
});

/** PDPA: remove student code / e-mail / name (and roster entries with that code) but keep scores. */
/** Anonymize / delete touch every section of the student, so the admin must own all of them. */
async function assertOwnsAllSections(db: D1Database, studentId: number, admin: { email: string }) {
  const owners = await queryAll<{ owner_email: string | null }>(
    db,
    "SELECT DISTINCT c.owner_email FROM enrollments e JOIN classes c ON c.id = e.class_id WHERE e.student_id = ?",
    studentId,
  );
  for (const o of owners) assertOwner(o.owner_email, admin, "student's section");
}

studentAdminRoutes.post("/students/:id/anonymize", async (c) => {
  const id = idParam(c);
  const db = c.env.DB;
  await assertOwnsAllSections(db, id, c.get("admin"));
  const s = await queryFirst<{ student_code: string | null; email: string | null; anonymized_at: string | null }>(
    db,
    "SELECT student_code, email, anonymized_at FROM students WHERE id = ?",
    id,
  );
  if (!s) throw notFound("Student not found.");
  if (!s.anonymized_at) {
    const now = nowIso();
    // Keyed hashes (no personal data) so this person cannot sign up again — see migration 0003.
    const hashes = await anonymizedIdentityHashes(sessionKey(c.env), { email: s.email, studentCode: s.student_code });
    const statements: D1PreparedStatement[] = hashes.map((h) =>
      stmt(db, "INSERT OR IGNORE INTO anonymized_identities (hash, created_at) VALUES (?, ?)", h, now),
    );
    if (s.student_code) statements.push(stmt(db, "DELETE FROM class_roster WHERE student_code = ?", s.student_code));
    statements.push(
      stmt(
        db,
        "UPDATE students SET student_code = NULL, email = NULL, first_name = NULL, anonymized_at = ? WHERE id = ?",
        nowIso(),
        id,
      ),
      // No personal data in the audit detail — that would defeat the anonymization.
      auditStmt(db, c.get("admin").email, "student.anonymize", "student", id, {}),
    );
    await db.batch(statements);
  }
  return c.json({ ok: true as const });
});

/** Hard delete: student, enrollments, attempts, game runs and roster entries with the same code. */
studentAdminRoutes.delete("/students/:id", async (c) => {
  const id = idParam(c);
  const db = c.env.DB;
  await assertOwnsAllSections(db, id, c.get("admin"));
  const s = await queryFirst<{ student_code: string | null }>(db, "SELECT student_code FROM students WHERE id = ?", id);
  if (!s) throw notFound("Student not found.");
  const statements: D1PreparedStatement[] = [
    stmt(db, "DELETE FROM game_runs WHERE student_id = ?", id),
    stmt(db, "DELETE FROM attempts WHERE enrollment_id IN (SELECT id FROM enrollments WHERE student_id = ?)", id),
    stmt(db, "DELETE FROM enrollment_progress WHERE enrollment_id IN (SELECT id FROM enrollments WHERE student_id = ?)", id),
    stmt(db, "DELETE FROM enrollments WHERE student_id = ?", id),
  ];
  if (s.student_code) statements.push(stmt(db, "DELETE FROM class_roster WHERE student_code = ?", s.student_code));
  statements.push(
    stmt(db, "DELETE FROM students WHERE id = ?", id),
    auditStmt(db, c.get("admin").email, "student.delete", "student", id, {}),
  );
  await db.batch(statements);
  return c.json({ ok: true as const });
});
