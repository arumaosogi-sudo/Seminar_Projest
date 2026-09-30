import type { AdminClass, AdminStudentRow, EnrollmentStatus } from "../../../shared/contract";
import { queryFirst } from "../../db";
import { conflict, notFound } from "../../http";

export const ANONYMIZED_LABEL = "(anonymized)";

export interface AdminClassRow {
  id: number;
  name: string;
  academic_year: number;
  semester: number;
  section: number;
  join_code: string;
  status: "active" | "archived";
  restrict_to_roster: number;
  created_at: string;
  archived_at: string | null;
  student_count: number;
  roster_count: number;
  pretest_submitted: number;
  posttest_submitted: number;
}

const submittedOfKind = (kind: "pretest" | "posttest") => `
  (SELECT COUNT(DISTINCT a.enrollment_id)
     FROM attempts a
     JOIN enrollments e ON e.id = a.enrollment_id
     JOIN test_assignments ta ON ta.id = a.assignment_id
     JOIN tests t ON t.id = ta.test_id
    WHERE e.class_id = c.id AND e.status = 'active' AND a.submitted_at IS NOT NULL AND t.kind = '${kind}')`;

export const ADMIN_CLASS_SELECT = `
  SELECT c.id, c.name, c.academic_year, c.semester, c.section, c.join_code, c.status, c.restrict_to_roster,
         c.created_at, c.archived_at,
         (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = c.id AND e.status = 'active') AS student_count,
         (SELECT COUNT(*) FROM class_roster r WHERE r.class_id = c.id) AS roster_count,
         ${submittedOfKind("pretest")} AS pretest_submitted,
         ${submittedOfKind("posttest")} AS posttest_submitted
    FROM classes c`;

export function toAdminClass(r: AdminClassRow): AdminClass {
  return {
    id: r.id,
    name: r.name,
    academicYear: r.academic_year,
    semester: r.semester,
    section: r.section,
    joinCode: r.join_code,
    status: r.status,
    restrictToRoster: r.restrict_to_roster === 1,
    studentCount: r.student_count,
    rosterCount: r.roster_count,
    pretestSubmitted: r.pretest_submitted,
    posttestSubmitted: r.posttest_submitted,
    createdAt: r.created_at,
    archivedAt: r.archived_at,
  };
}

export async function loadAdminClass(db: D1Database, id: number): Promise<AdminClass> {
  const row = await queryFirst<AdminClassRow>(db, `${ADMIN_CLASS_SELECT} WHERE c.id = ?`, id);
  if (!row) throw notFound("Class not found.");
  return toAdminClass(row);
}

export interface ClassBasics {
  id: number;
  name: string;
  academic_year: number;
  semester: number;
  status: "active" | "archived";
}

export async function loadClassBasics(db: D1Database, id: number): Promise<ClassBasics> {
  const row = await queryFirst<ClassBasics>(
    db,
    "SELECT id, name, academic_year, semester, status FROM classes WHERE id = ?",
    id,
  );
  if (!row) throw notFound("Class not found.");
  return row;
}

/** Archived classes are read-only (docs/plan/02 §8 level 2). */
export function assertWritable(cls: { status: string; name: string }): void {
  if (cls.status === "archived") throw conflict(`${cls.name} is archived (read-only). Unarchive it first.`, "class_archived");
}

export interface EnrollmentRowFull {
  enrollment_id: number;
  student_id: number;
  student_code: string | null;
  first_name: string | null;
  email: string | null;
  class_id: number;
  class_name: string;
  status: EnrollmentStatus;
  joined_at: string;
  last_login_at: string | null;
}

export const ENROLLMENT_ROW_SELECT = `
  SELECT e.id AS enrollment_id, s.id AS student_id, s.student_code, s.first_name, s.email,
         c.id AS class_id, c.name AS class_name, e.status, e.joined_at, s.last_login_at
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    JOIN classes c ON c.id = e.class_id`;

export function toStudentRow(r: EnrollmentRowFull): AdminStudentRow {
  return {
    enrollmentId: r.enrollment_id,
    studentId: r.student_id,
    studentCode: r.student_code ?? ANONYMIZED_LABEL,
    firstName: r.first_name,
    email: r.email,
    classId: r.class_id,
    className: r.class_name,
    status: r.status,
    joinedAt: r.joined_at,
    lastLoginAt: r.last_login_at,
  };
}

export async function loadStudentRow(db: D1Database, enrollmentId: number): Promise<AdminStudentRow> {
  const row = await queryFirst<EnrollmentRowFull>(db, `${ENROLLMENT_ROW_SELECT} WHERE e.id = ?`, enrollmentId);
  if (!row) throw notFound("Enrollment not found.");
  return toStudentRow(row);
}
