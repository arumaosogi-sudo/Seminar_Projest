-- 0002 — attempt integrity (added by the backend; 0001 is never edited)
--
-- 1. attempts.auto_submitted: the API contract (AttemptResult.autoSubmitted) must tell the student whether the
--    server submitted the attempt because time ran out. 0001 had no column to remember that.
-- 2. One in-progress attempt per enrollment + assignment: a double-click / two open tabs on "Start" must resume
--    the same attempt instead of creating two (enforced by the database, not just by application code).
-- 3. Indexes for the lookups the API does on every student request.
--
-- Rollback (manual): DROP INDEX ux_attempts_one_in_progress; DROP INDEX idx_attempts_enrollment;
-- DROP INDEX idx_test_assignments_class; the column can stay (SQLite DROP COLUMN is only needed if you insist).

ALTER TABLE attempts ADD COLUMN auto_submitted INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX ux_attempts_one_in_progress
  ON attempts (enrollment_id, assignment_id)
  WHERE submitted_at IS NULL;

CREATE INDEX idx_attempts_enrollment ON attempts (enrollment_id, submitted_at);
CREATE INDEX idx_test_assignments_class ON test_assignments (class_id);
CREATE INDEX idx_audit_log_created ON audit_log (created_at);
