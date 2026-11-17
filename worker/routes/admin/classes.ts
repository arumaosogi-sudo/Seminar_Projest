import { Hono } from "hono";
import { createClassBody, setOwnerBody, updateClassBody, type AdminClass } from "../../../shared/contract";
import { auditStmt, auditStmtForLastInsert, isConstraintError, nowIso, queryAll, queryFirst, stmt } from "../../db";
import type { AppEnv } from "../../env";
import { generateJoinCode } from "../../grading";
import { badRequest, conflict, forbidden, idParam, notFound, readBody } from "../../http";
import { className } from "../../identity";
import { ADMIN_CLASS_SELECT, assertWritable, loadAdminClass, loadClassBasics, toAdminClass, type AdminClassRow, ownedClasses, assertOwner, ownerLabel, isEmergencyAdmin } from "./common";
import { findAdmin } from "../../auth";

export const classRoutes = new Hono<AppEnv>();

const JOIN_CODE_ATTEMPTS = 8;

async function joinCodeTaken(db: D1Database, code: string): Promise<boolean> {
  return (await queryFirst(db, "SELECT 1 AS one FROM classes WHERE join_code = ?", code)) !== null;
}

/** New unused MUS-XXXX code (retries on collision; 32^4 ≈ 1M codes). */
async function freshJoinCode(db: D1Database): Promise<string> {
  for (let i = 0; i < JOIN_CODE_ATTEMPTS; i++) {
    const code = generateJoinCode();
    if (!(await joinCodeTaken(db, code))) return code;
  }
  throw new Error("Could not generate a unique join code");
}

classRoutes.get("/classes", async (c) => {
  const status = c.req.query("status") ?? "active";
  if (!["active", "archived", "all"].includes(status)) throw badRequest("status must be active, archived or all.");
  const own = ownedClasses(c.get("admin"));
  const where = status === "all" ? `WHERE ${own.sql}` : `WHERE c.status = ? AND ${own.sql}`;
  const params = status === "all" ? own.params : [status, ...own.params];
  const rows = await queryAll<AdminClassRow>(
    c.env.DB,
    `${ADMIN_CLASS_SELECT} ${where} ORDER BY c.academic_year DESC, c.semester DESC, c.section ASC`,
    ...params,
  );
  return c.json<AdminClass[]>(rows.map(toAdminClass));
});

classRoutes.post("/classes", async (c) => {
  const body = await readBody(c, createClassBody);
  const db = c.env.DB;
  const admin = c.get("admin");
  // Decision B: section numbers may repeat across instructors, so duplicates are checked per owner.
  const dup = await queryFirst(
    db,
    "SELECT 1 AS one FROM classes WHERE owner_email = ? AND academic_year = ? AND semester = ? AND section = ?",
    admin.email,
    body.academicYear,
    body.semester,
    body.section,
  );
  const name = `${className(body.academicYear, body.semester, body.section)} · ${ownerLabel(admin)}`;
  if (dup) throw conflict(`${name} already exists.`);

  for (let i = 0; i < JOIN_CODE_ATTEMPTS; i++) {
    const code = await freshJoinCode(db);
    try {
      const [ins] = await db.batch([
        stmt(
          db,
          `INSERT INTO classes (academic_year, semester, section, name, join_code, restrict_to_roster, status, created_at, owner_email)
           VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?) RETURNING id`,
          body.academicYear,
          body.semester,
          body.section,
          name,
          code,
          body.restrictToRoster ? 1 : 0,
          nowIso(),
          admin.email,
        ),
        auditStmtForLastInsert(db, admin.email, "class.create", "class", { name, joinCode: code }),
      ]);
      const id = (ins.results[0] as { id: number } | undefined)?.id;
      if (!id) throw new Error("Class insert returned no id");
      return c.json(await loadAdminClass(db, id), 201);
    } catch (err) {
      if (!isConstraintError(err)) throw err;
      // Either the section was created concurrently or the join code collided — re-check and retry.
      if (
        await queryFirst(
          db,
          "SELECT 1 AS one FROM classes WHERE owner_email = ? AND academic_year = ? AND semester = ? AND section = ?",
          admin.email,
          body.academicYear,
          body.semester,
          body.section,
        )
      ) {
        throw conflict(`${name} already exists.`);
      }
    }
  }
  throw new Error("Could not create class");
});

classRoutes.patch("/classes/:id", async (c) => {
  const id = idParam(c);
  const body = await readBody(c, updateClassBody);
  const db = c.env.DB;
  const cls = await loadClassBasics(db, id);
  assertOwner(cls.owner_email, c.get("admin"));
  assertWritable(cls);
  const admin = c.get("admin");
  const statements: D1PreparedStatement[] = [];
  const detail: Record<string, unknown> = {};
  if (body.restrictToRoster !== undefined) {
    statements.push(stmt(db, "UPDATE classes SET restrict_to_roster = ? WHERE id = ?", body.restrictToRoster ? 1 : 0, id));
    detail.restrictToRoster = body.restrictToRoster;
  }
  if (body.regenerateJoinCode) {
    const code = await freshJoinCode(db);
    statements.push(stmt(db, "UPDATE classes SET join_code = ? WHERE id = ?", code, id));
    detail.joinCode = code;
  }
  if (statements.length > 0) {
    statements.push(auditStmt(db, admin.email, "class.update", "class", id, detail));
    await db.batch(statements);
  }
  return c.json(await loadAdminClass(db, id));
});

/**
 * Permanently deletes a section: its enrollments, every attempt (score) in it, its roster and its test assignments.
 * Students who are left without any section are deleted too (we don't keep data for people who left).
 * The audit log keeps a record of the deletion (name, join code, counts) but no student data.
 */
/**
 * Username account only: hand a section to an instructor (e.g. one made before owners were recorded). The section is
 * renamed with the new owner's short name, as if they had created it.
 */
classRoutes.post("/classes/:id/owner", async (c) => {
  const id = idParam(c);
  const db = c.env.DB;
  if (!isEmergencyAdmin(c.get("admin"))) throw forbidden("Only the admin username account can change owners.", "not_manager");
  const body = await readBody(c, setOwnerBody);
  const to = await findAdmin(db, c.env, body.email);
  if (!to || isEmergencyAdmin(to)) throw badRequest(`${body.email} is not an instructor.`);
  const cls = await queryFirst<{ academic_year: number; semester: number; section: number }>(
    db,
    "SELECT academic_year, semester, section FROM classes WHERE id = ?",
    id,
  );
  if (!cls) throw notFound("Class not found.");
  const name = `${className(cls.academic_year, cls.semester, cls.section)} · ${ownerLabel(to)}`;
  const dup = await queryFirst(
    db,
    "SELECT 1 AS one FROM classes WHERE owner_email = ? AND academic_year = ? AND semester = ? AND section = ? AND id <> ?",
    to.email,
    cls.academic_year,
    cls.semester,
    cls.section,
    id,
  );
  if (dup) throw conflict(`${to.email} already has ${name}.`);
  await db.batch([
    stmt(db, "UPDATE classes SET owner_email = ?, name = ? WHERE id = ?", to.email, name, id),
    auditStmt(db, c.get("admin").email, "class.owner", "class", id, { name, owner: to.email }),
  ]);
  return c.json(await loadAdminClass(db, id));
});

classRoutes.delete("/classes/:id", async (c) => {
  const id = idParam(c);
  const db = c.env.DB;
  const cls = await loadClassBasics(db, id);
  assertOwner(cls.owner_email, c.get("admin"));
  const counts = await queryFirst<{ students: number; attempts: number }>(
    db,
    `SELECT (SELECT COUNT(*) FROM enrollments WHERE class_id = ?1) AS students,
            (SELECT COUNT(*) FROM attempts a
              WHERE a.enrollment_id IN (SELECT id FROM enrollments WHERE class_id = ?1)
                 OR a.assignment_id IN (SELECT id FROM test_assignments WHERE class_id = ?1)) AS attempts`,
    id,
  );
  // One transaction (db.batch). Order matters: game runs → attempts → students who are only in this class (while their
  // enrollment still identifies them) → remaining enrollments → assignments → roster → the class itself.
  await db.batch([
    stmt(db, "DELETE FROM game_runs WHERE class_id = ?1 OR enrollment_id IN (SELECT id FROM enrollments WHERE class_id = ?1)", id),
    stmt(
      db,
      `DELETE FROM attempts WHERE enrollment_id IN (SELECT id FROM enrollments WHERE class_id = ?1)
          OR assignment_id IN (SELECT id FROM test_assignments WHERE class_id = ?1)`,
      id,
    ),
    stmt(
      db,
      `DELETE FROM students WHERE id IN (
         SELECT e.student_id FROM enrollments e WHERE e.class_id = ?1
            AND NOT EXISTS (SELECT 1 FROM enrollments o WHERE o.student_id = e.student_id AND o.class_id <> ?1))`,
      id,
    ),
    stmt(db, "DELETE FROM enrollment_progress WHERE enrollment_id IN (SELECT id FROM enrollments WHERE class_id = ?)", id),
    stmt(db, "DELETE FROM enrollments WHERE class_id = ?", id),
    stmt(db, "DELETE FROM test_assignments WHERE class_id = ?", id),
    stmt(db, "DELETE FROM class_roster WHERE class_id = ?", id),
    stmt(db, "DELETE FROM classes WHERE id = ?", id),
    auditStmt(db, c.get("admin").email, "class.delete", "class", id, {
      name: cls.name,
      students: counts?.students ?? 0,
      attempts: counts?.attempts ?? 0,
    }),
  ]);
  return c.json({ ok: true as const, deleted: { students: counts?.students ?? 0, attempts: counts?.attempts ?? 0 } });
});

