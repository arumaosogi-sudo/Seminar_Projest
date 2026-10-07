-- Throttle for the username/password admin sign-in (POST /api/auth/admin-password).
-- One row per attempt; failures in the last 15 minutes per IP are counted. Old rows are pruned on each attempt.
CREATE TABLE admin_login_attempts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ip            TEXT    NOT NULL,
  success       INTEGER NOT NULL DEFAULT 0,
  attempted_at  TEXT    NOT NULL
);
CREATE INDEX idx_admin_login_attempts_ip ON admin_login_attempts(ip, attempted_at);
