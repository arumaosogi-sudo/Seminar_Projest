import { Hono } from "hono";
import { createClassBody, rosterBody, updateClassBody, type AdminClass } from "../../../shared/contract";
import { auditStmt, auditStmtForLastInsert, isConstraintError, nowIso, queryAll, queryFirst, stmt } from "../../db";
import type { AppEnv } from "../../env";
import { generateJoinCode } from "../../grading";
import { badRequest, conflict, idParam, readBody } from "../../http";
import { className } from "../../identity";
import { ADMIN_CLASS_SELECT, assertWritable, loadAdminClass, loadClassBasics, toAdminClass, type AdminClassRow } from "./common";

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
  const where = status === "all" ? "" : "WHERE c.status = ?";
  const params = status === "all" ? [] : [status];
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
  const dup = await queryFirst(
    db,
    "SELECT 1 AS one FROM classes WHERE academic_year = ? AND semester = ? AND section = ?",
    body.academicYear,
    body.semester,
    body.section,
  );
  const name = className(body.academicYear, body.semester, body.section);
  if (dup) throw conflict(`${name} already exists.`);

  for (let i = 0; i < JOIN_CODE_ATTEMPTS; i++) {
    const code = await freshJoinCode(db);
    try {
      const [ins] = await db.batch([
        stmt(
          db,
          `INSERT INTO classes (academic_year, semester, section, name, join_code, restrict_to_roster, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'active', ?) RETURNING id`,
          body.academicYear,
          body.semester,
          body.section,
          name,
          code,
          body.restrictToRoster ? 1 : 0,
          nowIso(),
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
          "SELECT 1 AS one FROM classes WHERE academic_year = ? AND semester = ? AND section = ?",
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

classRoutes.get("/classes/:id", async (c) => c.json(await loadAdminClass(c.env.DB, idParam(c))));

classRoutes.patch("/classes/:id", async (c) => {
  const id = idParam(c);
  const body = await readBody(c, updateClassBody);
  const db = c.env.DB;
  const cls = await loadClassBasics(db, id);
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

classRoutes.post("/classes/:id/archive", async (c) => {
  const id = idParam(c);
  const db = c.env.DB;
  const cls = await loadClassBasics(db, id);
  if (cls.status !== "archived") {
    await db.batch([
      stmt(db, "UPDATE classes SET status = 'archived', archived_at = ? WHERE id = ?", nowIso(), id),
      auditStmt(db, c.get("admin").email, "class.archive", "class", id, { name: cls.name }),
    ]);
  }
  return c.json(await loadAdminClass(db, id));
});

classRoutes.post("/classes/:id/unarchive", async (c) => {
  const id = idParam(c);
  const db = c.env.DB;
  const cls = await loadClassBasics(db, id);
  if (cls.status === "archived") {
    await db.batch([
      stmt(db, "UPDATE classes SET status = 'active', archived_at = NULL WHERE id = ?", id),
      auditStmt(db, c.get("admin").email, "class.unarchive", "class", id, { name: cls.name }),
    ]);
  }
  return c.json(await loadAdminClass(db, id));
});

/**
 * Permanently deletes a section: its enrollments, every attempt (score) in it, its roster and its test assignments.
 * Students who are left without any section are deleted too (we don't keep data for people who left).
 * The audit log keeps a record of the deletion (name, join code, counts) but no student data.
 */
classRoutes.delete("/classes/:id", async (c) => {
  const id = idParam(c);
  const db = c.env.DB;
  const cls = await loadClassBasics(db, id);
  const counts = await queryFirst<{ students: number; attempts: number }>(
    db,
    `SELECT (SELECT COUNT(*) FROM enrollments WHERE class_id = ?1) AS students,
            (SELECT COUNT(*) FROM attempts a
              WHERE a.enrollment_id IN (SELECT id FROM enrollments WHERE class_id = ?1)
                 OR a.assignment_id IN (SELECT id FROM test_assignments WHERE class_id = ?1)) AS attempts`,
    id,
  );
  // One transaction (db.batch). Order matters: attempts → students who are only in this class (while their
  // enrollment still identifies them) → remaining enrollments → assignments → roster → the class itself.
  await db.batch([
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

/* ───────────── roster ───────────── */

export interface RosterEntry {
  studentCode: string;
  firstName: string | null;
  joined: boolean;
}

async function listRoster(db: D1Database, classId: number): Promise<RosterEntry[]> {
  const rows = await queryAll<{ student_code: string; first_name: string | null; joined: number }>(
    db,
    `SELECT r.student_code, r.first_name,
            EXISTS (SELECT 1 FROM enrollments e JOIN students s ON s.id = e.student_id
                     WHERE e.class_id = r.class_id AND s.student_code = r.student_code) AS joined
       FROM class_roster r WHERE r.class_id = ? ORDER BY r.student_code`,
    classId,
  );
  return rows.map((r) => ({ studentCode: r.student_code, firstName: r.first_name, joined: r.joined === 1 }));
}

classRoutes.get("/classes/:id/roster", async (c) => {
  const id = idParam(c);
  await loadClassBasics(c.env.DB, id);
  return c.json(await listRoster(c.env.DB, id));
});

classRoutes.post("/classes/:id/roster", async (c) => {
  const id = idParam(c);
  const body = await readBody(c, rosterBody);
  const db = c.env.DB;
  const cls = await loadClassBasics(db, id);
  assertWritable(cls);

  // De-duplicate by student code (last entry wins).
  const byCode = new Map<string, string | null>();
  for (const e of body.entries) byCode.set(e.studentCode, e.firstName?.trim() || null);

  const statements: D1PreparedStatement[] = [];
  if (body.mode === "replace") statements.push(stmt(db, "DELETE FROM class_roster WHERE class_id = ?", id));
  for (const [code, firstName] of byCode) {
    statements.push(
      stmt(
        db,
        `INSERT INTO class_roster (class_id, student_code, first_name) VALUES (?, ?, ?)
         ON CONFLICT (class_id, student_code) DO UPDATE SET first_name = COALESCE(excluded.first_name, class_roster.first_name)`,
        id,
        code,
        firstName,
      ),
    );
  }
  statements.push(auditStmt(db, c.get("admin").email, "roster.import", "class", id, { mode: body.mode, count: byCode.size }));
  await db.batch(statements);
  return c.json(await listRoster(db, id));
});

classRoutes.delete("/classes/:id/roster", async (c) => {
  const id = idParam(c);
  const db = c.env.DB;
  const cls = await loadClassBasics(db, id);
  assertWritable(cls);
  const [del] = await db.batch([
    stmt(db, "DELETE FROM class_roster WHERE class_id = ?", id),
    auditStmt(db, c.get("admin").email, "roster.clear", "class", id, {}),
  ]);
  return c.json({ ok: true as const, removed: del.meta.changes ?? 0 });
});
