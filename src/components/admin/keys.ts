/**
 * TanStack Query keys for the admin area. Everything lives under ["admin", …] so a sign-out
 * (queryClient.clear) or a broad invalidation (["admin"]) catches it all.
 */
export const adminKeys = {
  all: ["admin"] as const,
  classes: (status: "active" | "archived" | "all") => ["admin", "classes", status] as const,
  classesRoot: ["admin", "classes"] as const,
  students: (classId: number, status: string) => ["admin", "students", classId, status] as const,
  studentsRoot: ["admin", "students"] as const,
  tests: ["admin", "tests"] as const,
  test: (id: number) => ["admin", "test", id] as const,
  assignments: (testId: number) => ["admin", "assignments", testId] as const,
  results: (classId: number | null, testIds: number[], status: "active" | "all") => ["admin", "results", classId ?? "all", testIds.join(","), status] as const,
  resultsRoot: ["admin", "results"] as const,
  admins: ["admin", "admins"] as const,
  audit: ["admin", "audit"] as const,
};
