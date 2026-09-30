import { Hono } from "hono";
import { moveEnrollmentBody, setEnrollmentStatusBody, type AdminStudentRow } from "../../../shared/contract";
import { auditStmt, nowIso, queryAll, queryFirst, stmt, type SqlValue } from "../../db";
import { sessionKey, type AppEnv } from "../../env";
import { anonymizedIdentityHashes } from "../../identityHash";
import { badRequest, conflict, idParam, notFound, readBody } from "../../http";
import {
  ENROLLMENT_ROW_SELECT,
  assertWritable,
  loadClassBasics,
  loadStudentRow,
  toStudentRow,
  type EnrollmentRowFull,
} from "./common";

export const studentAdminRoutes = new Hono<AppEnv>();

const STATUSES = ["active", "withdrawn", "not_joined", "all"] as const;

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
  if (!STATUSES.includes(status)) throw badRequest("status must be active, withdrawn, not_joined or all.");
  const q = (c.req.query("q") ?? "").trim().slice(0, 100);

  let classId: number | null = null;
  if (classIdRaw) {
    if (!/^\d+$/.test(classIdRaw)) throw badRequest("classId must be a number.");
    classId = Number(classIdRaw);
    await loadClassBasics(db, classId);
  }

  const rows: AdminStudentRow[] = [];

  if (status !== "not_joined") {
    const where: string[] = [];
    const params: SqlValue[] = [];
    if (classId !== null) {
      where.push("c.id = ?");
      params.push(classId);
    } else where.push("c.status = 'active'");
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

  if (status === "not_joined" || status === "all") {
    const where: string[] = [
      `NOT EXISTS (SELECT 1 FROM enrollments e JOIN students s ON s.id = e.student_id
                    WHERE e.class_id = r.class_id AND s.student_code = r.student_code)`,
    ];
    const params: SqlValue[] = [];
    if (classId !== null) {
      where.push("c.id = ?");
      params.push(classId);
    } else where.push("c.status = 'active'");
    if (q) {
      where.push("(r.student_code LIKE ? ESCAPE '\\' OR r.first_name LIKE ? ESCAPE '\\')");
      const p = likePattern(q);
      params.push(p, p);
    }
    const rosterOnly = await queryAll<{ student_code: string; first_name: string | null; class_id: number; class_name: string }>(
      db,
      `SELECT r.student_code, r.first_name, c.id AS class_id, c.name AS class_name
         FROM class_roster r JOIN classes c ON c.id = r.class_id
        WHERE ${where.join(" AND ")}
        ORDER BY c.academic_year DESC, c.semester DESC, c.section, r.student_code`,
      ...params,
    );
    rows.push(
      ...rosterOnly.map<AdminStudentRow>((r) => ({
        enrollmentId: null,
        studentId: null,
        studentCode: r.student_code,
        firstName: r.first_name,
        email: null,
        classId: r.class_id,
        className: r.class_name,
        status: "not_joined",
        joinedAt: null,
        lastLoginAt: null,
      })),
    );
  }

  return c.json(rows);
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
  assertWritable(from);
  const to = await loadClassBasics(db, body.classId);
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
studentAdminRoutes.post("/students/:id/anonymize", async (c) => {
  const id = idParam(c);
  const db = c.env.DB;
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

/** Hard delete: student, enrollments, attempts and roster entries with the same code. */
studentAdminRoutes.delete("/students/:id", async (c) => {
  const id = idParam(c);
  const db = c.env.DB;
  const s = await queryFirst<{ student_code: string | null }>(db, "SELECT student_code FROM students WHERE id = ?", id);
  if (!s) throw notFound("Student not found.");
  const statements: D1PreparedStatement[] = [
    stmt(db, "DELETE FROM attempts WHERE enrollment_id IN (SELECT id FROM enrollments WHERE student_id = ?)", id),
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
