import { Hono } from "hono";
import { addAdminBody, type AdminUser, type AuditEntry } from "../../../shared/contract";
import { auditStmt, auditStmtForLastInsert, nowIso, parseJson, queryAll, queryFirst, stmt } from "../../db";
import { envAdminEmails, type AppEnv } from "../../env";
import { conflict, idParam, notFound, readBody } from "../../http";

export const adminUserRoutes = new Hono<AppEnv>();

async function listAdmins(db: D1Database, env: Env): Promise<AdminUser[]> {
  const rows = await queryAll<{ id: number; email: string; name: string | null }>(
    db,
    "SELECT id, email, name FROM admins ORDER BY email",
  );
  const inDb = new Set(rows.map((r) => r.email.toLowerCase()));
  return [
    ...envAdminEmails(env)
      .filter((e) => !inDb.has(e))
      .map<AdminUser>((email) => ({ id: null, email, name: null, source: "env" })),
    ...rows.map<AdminUser>((r) => ({ id: r.id, email: r.email.toLowerCase(), name: r.name, source: "database" })),
  ];
}

adminUserRoutes.get("/admins", async (c) => c.json(await listAdmins(c.env.DB, c.env)));

adminUserRoutes.post("/admins", async (c) => {
  const body = await readBody(c, addAdminBody);
  const db = c.env.DB;
  if (await queryFirst(db, "SELECT 1 AS one FROM admins WHERE email = ?", body.email)) {
    throw conflict(`${body.email} is already an instructor.`);
  }
  const name = body.name?.trim() || null;
  await db.batch([
    stmt(db, "INSERT INTO admins (email, name, created_at) VALUES (?, ?, ?)", body.email, name, nowIso()),
    auditStmtForLastInsert(db, c.get("admin").email, "admin.add", "admin", { email: body.email }),
  ]);
  const row = await queryFirst<{ id: number; email: string; name: string | null }>(
    db,
    "SELECT id, email, name FROM admins WHERE email = ?",
    body.email,
  );
  if (!row) throw new Error("Admin insert failed");
  return c.json<AdminUser>({ id: row.id, email: row.email.toLowerCase(), name: row.name, source: "database" }, 201);
});

/** Removes a database admin. ENV admins have no id and cannot be removed here; you cannot remove yourself. */
adminUserRoutes.delete("/admins/:id", async (c) => {
  const id = idParam(c);
  const db = c.env.DB;
  const me = c.get("admin");
  const row = await queryFirst<{ email: string }>(db, "SELECT email FROM admins WHERE id = ?", id);
  if (!row) throw notFound("Instructor not found.");
  if (row.email.toLowerCase() === me.email) throw conflict("You cannot remove your own instructor access.");
  await db.batch([
    stmt(db, "DELETE FROM admins WHERE id = ?", id),
    auditStmt(db, me.email, "admin.remove", "admin", id, { email: row.email.toLowerCase() }),
  ]);
  return c.json({ ok: true as const });
});

adminUserRoutes.get("/audit", async (c) => {
  const raw = Number(c.req.query("limit") ?? 50);
  const limit = Number.isFinite(raw) ? Math.min(200, Math.max(1, Math.floor(raw))) : 50;
  const rows = await queryAll<{
    id: number;
    admin_email: string;
    action: string;
    target_type: string;
    target_id: string | null;
    detail: string;
    created_at: string;
  }>(c.env.DB, "SELECT id, admin_email, action, target_type, target_id, detail, created_at FROM audit_log ORDER BY id DESC LIMIT ?", limit);
  return c.json<AuditEntry[]>(
    rows.map((r) => ({
      id: r.id,
      adminEmail: r.admin_email,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      detail: parseJson<Record<string, unknown>>(r.detail, {}),
      createdAt: r.created_at,
    })),
  );
});
