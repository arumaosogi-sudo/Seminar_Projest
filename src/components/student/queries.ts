import { useQuery } from "@tanstack/react-query";
import type { StudentStatus, StudentTestItem } from "@shared/contract";
import { api } from "@/lib/api";

/* Keys live under ["me", …] so invalidating `meKey` (sign-in / onboarding) refreshes them too. */
export const studentStatusKey = ["me", "status"] as const;
export const studentTestsKey = ["me", "tests"] as const;

/** GET /api/me/status — drives Home (menu lock, pretest/posttest chips). */
export function useStudentStatus(enabled = true) {
  return useQuery({
    queryKey: studentStatusKey,
    queryFn: () => api.get<StudentStatus>("/me/status"),
    enabled,
    staleTime: 30_000,
  });
}

/** GET /api/me/tests — tests assigned to the student's class. */
export function useStudentTests(enabled = true) {
  return useQuery({
    queryKey: studentTestsKey,
    queryFn: () => api.get<StudentTestItem[]>("/me/tests"),
    enabled,
    staleTime: 15_000,
  });
}
