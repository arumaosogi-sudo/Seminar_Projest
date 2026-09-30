/** Thin D1 helpers. Every value is bound as a parameter — never concatenated into SQL. */

export type SqlValue = string | number | null;

export const nowIso = (d: Date = new Date()): string => d.toISOString();

export function stmt(db: D1Database, sql: string, ...params: SqlValue[]): D1PreparedStatement {
  return db.prepare(sql).bind(...params);
}

export async function queryFirst<T>(db: D1Database, sql: string, ...params: SqlValue[]): Promise<T | null> {
  return (await stmt(db, sql, ...params).first<T>()) ?? null;
}

export async function queryAll<T>(db: D1Database, sql: string, ...params: SqlValue[]): Promise<T[]> {
  const res = await stmt(db, sql, ...params).all<T>();
  return res.results ?? [];
}

export async function execute(db: D1Database, sql: string, ...params: SqlValue[]): Promise<D1Result> {
  return stmt(db, sql, ...params).run();
}

/** Builds `?, ?, ?` for an IN list (the values themselves are still bound). Callers keep lists ≤ 90 items. */
export function placeholders(n: number): string {
  return Array.from({ length: n }, () => "?").join(", ");
}

/** Audit-log insert statement, meant to be added to the same `db.batch` as the mutation it describes. */
export function auditStmt(
  db: D1Database,
  adminEmail: string,
  action: string,
  targetType: string,
  targetId: string | number | null,
  detail: Record<string, unknown> = {},
): D1PreparedStatement {
  return stmt(
    db,
    "INSERT INTO audit_log (admin_email, action, target_type, target_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    adminEmail,
    action,
    targetType,
    targetId === null ? null : String(targetId),
    JSON.stringify(detail),
    nowIso(),
  );
}

/** Audit insert for a row created earlier in the same batch (target id = last_insert_rowid()). */
export function auditStmtForLastInsert(
  db: D1Database,
  adminEmail: string,
  action: string,
  targetType: string,
  detail: Record<string, unknown> = {},
): D1PreparedStatement {
  return stmt(
    db,
    `INSERT INTO audit_log (admin_email, action, target_type, target_id, detail, created_at)
     VALUES (?, ?, ?, CAST(last_insert_rowid() AS TEXT), ?, ?)`,
    adminEmail,
    action,
    targetType,
    JSON.stringify(detail),
    nowIso(),
  );
}

export function parseJson<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/** SQLite "constraint failed" errors (UNIQUE etc.) surfaced by D1. */
export function isConstraintError(err: unknown): boolean {
  return err instanceof Error && /constraint/i.test(err.message);
}
