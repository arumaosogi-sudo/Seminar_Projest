import type { AdminClass, AdminStudentRow } from "@shared/contract";
import { api } from "@/lib/api";

/** Enrollment rows of `studentId` in classes other than `classId` (pure — unit tested). */
export function otherEnrollments(rows: AdminStudentRow[], studentId: number, classId: number): AdminStudentRow[] {
  return rows.filter((r) => r.studentId === studentId && r.classId !== classId && r.enrollmentId !== null);
}

/**
 * Hard delete removes the student's attempts in EVERY section, but "Export this class first" only exports
 * the current one. Look the student up in every other class (archived included — `/admin/students`
 * without classId only covers active classes) so the caller can block the delete.
 */
export async function findOtherEnrollments(student: { studentId: number; studentCode: string }, classId: number): Promise<AdminStudentRow[]> {
  const classes = await api.get<AdminClass[]>("/admin/classes?status=all");
  const others = classes.filter((c) => c.id !== classId);
  const lists = await Promise.all(
    others.map((c) => api.get<AdminStudentRow[]>(`/admin/students?${new URLSearchParams({ classId: String(c.id), status: "all", q: student.studentCode })}`)),
  );
  return otherEnrollments(lists.flat(), student.studentId, classId);
}
