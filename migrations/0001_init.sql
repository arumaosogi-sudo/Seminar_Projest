-- Digital Muscle — initial schema (Cloudflare D1 / SQLite)
-- Timestamps are ISO-8601 UTC strings (e.g. 2026-10-01T09:00:00.000Z).
-- JSON columns are TEXT holding JSON.

PRAGMA foreign_keys = ON;

-- Instructors / admins (login with Google; must be listed here or in the ADMIN_EMAILS var)
CREATE TABLE admins (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  name        TEXT,
  created_at  TEXT    NOT NULL
);

-- Students (PDPA: only student ID, first name and university e-mail are stored)
CREATE TABLE students (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  student_code   TEXT    UNIQUE,                    -- e.g. 6531501234 (NULL once anonymized)
  email          TEXT    UNIQUE COLLATE NOCASE,     -- 6531501234@lamduan.mfu.ac.th (NULL once anonymized)
  first_name     TEXT,
  created_at     TEXT    NOT NULL,
  last_login_at  TEXT,
  anonymized_at  TEXT
);

-- A class = academic year + semester + section. One QR / join code per class.
CREATE TABLE classes (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  academic_year       INTEGER NOT NULL,             -- Buddhist year, e.g. 2569
  semester            INTEGER NOT NULL CHECK (semester IN (1, 2, 3)),
  section             INTEGER NOT NULL,
  name                TEXT    NOT NULL,             -- display, e.g. "2569/1 · Section 1"
  join_code           TEXT    NOT NULL UNIQUE,      -- e.g. MUS-4K7P
  restrict_to_roster  INTEGER NOT NULL DEFAULT 0,   -- 1 = only student codes in class_roster may join
  status              TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at          TEXT    NOT NULL,
  archived_at         TEXT,
  UNIQUE (academic_year, semester, section)
);

-- Optional roster imported by the instructor (student codes expected in a class)
CREATE TABLE class_roster (
  class_id      INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_code  TEXT    NOT NULL,
  first_name    TEXT,
  PRIMARY KEY (class_id, student_code)
);

CREATE TABLE enrollments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id      INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  status        TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn')),
  joined_at     TEXT    NOT NULL,
  withdrawn_at  TEXT,
  UNIQUE (student_id, class_id)
);
CREATE INDEX idx_enrollments_class ON enrollments(class_id, status);

-- Tests (question bank). Editing after students have started creates a new version.
CREATE TABLE tests (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  title            TEXT    NOT NULL,
  description      TEXT    NOT NULL DEFAULT '',
  kind             TEXT    NOT NULL DEFAULT 'other' CHECK (kind IN ('pretest', 'posttest', 'other')),
  current_version  INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT    NOT NULL,
  updated_at       TEXT    NOT NULL
);

CREATE TABLE questions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id    INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  type       TEXT    NOT NULL CHECK (type IN ('single', 'multi', 'truefalse', 'short')),
  prompt     TEXT    NOT NULL,
  image_url  TEXT,
  options    TEXT    NOT NULL DEFAULT '[]',   -- JSON: [{ "id": "a", "text": "Actin" }, ...]
  answer     TEXT    NOT NULL,                -- JSON: "a" | ["a","b"] | true | ["accepted", "answers"]  (NEVER sent to students)
  points     INTEGER NOT NULL DEFAULT 1,
  required   INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_questions_test ON questions(test_id, position);

-- Frozen copy of a test (questions + answers) used by attempts, so later edits never change old scores.
CREATE TABLE test_versions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id     INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  version_no  INTEGER NOT NULL,
  snapshot    TEXT    NOT NULL,               -- JSON: { title, questions: [...with answers] }
  created_at  TEXT    NOT NULL,
  UNIQUE (test_id, version_no)
);

-- Per-class settings for a test
CREATE TABLE test_assignments (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id           INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  class_id          INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  time_limit_min    INTEGER,                  -- NULL = no time limit
  max_attempts      INTEGER,                  -- NULL = unlimited, 1 = once
  score_policy      TEXT    NOT NULL DEFAULT 'highest' CHECK (score_policy IN ('highest', 'latest', 'first')),
  availability      TEXT    NOT NULL DEFAULT 'manual' CHECK (availability IN ('manual', 'scheduled')),
  is_open           INTEGER NOT NULL DEFAULT 0,   -- used when availability = 'manual'
  opens_at          TEXT,                         -- used when availability = 'scheduled'
  closes_at         TEXT,
  show_answers      INTEGER NOT NULL DEFAULT 0,
  required_first    INTEGER NOT NULL DEFAULT 0,   -- 1 = must be submitted before Games / 3D unlock
  created_at        TEXT    NOT NULL,
  updated_at        TEXT    NOT NULL,
  UNIQUE (test_id, class_id)
);

CREATE TABLE attempts (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id    INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  assignment_id    INTEGER NOT NULL REFERENCES test_assignments(id) ON DELETE CASCADE,
  test_version_id  INTEGER NOT NULL REFERENCES test_versions(id),
  started_at       TEXT    NOT NULL,
  deadline_at      TEXT,                      -- NULL when no time limit
  submitted_at     TEXT,
  answers          TEXT    NOT NULL DEFAULT '{}',   -- JSON: { "<questionId>": value }
  score            REAL,
  max_score        REAL
);
CREATE INDEX idx_attempts_assignment ON attempts(assignment_id, enrollment_id);

CREATE TABLE audit_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_email  TEXT    NOT NULL,
  action       TEXT    NOT NULL,              -- e.g. student.withdraw, class.archive, student.anonymize
  target_type  TEXT    NOT NULL,
  target_id    TEXT,
  detail       TEXT    NOT NULL DEFAULT '{}',
  created_at   TEXT    NOT NULL
);
