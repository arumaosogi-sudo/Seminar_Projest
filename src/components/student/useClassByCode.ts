import { useQuery } from "@tanstack/react-query";
import type { PublicClassInfo } from "@shared/contract";
import { api, ApiRequestError } from "@/lib/api";

/** Normalise a join code from a URL/QR ("mus-ab12 " → "MUS-AB12"). Returns "" when it can't be valid. */
export function normalizeJoinCode(raw: string | undefined | null): string {
  const code = (raw ?? "").trim().toUpperCase();
  return /^[A-Z0-9-]{3,32}$/.test(code) ? code : "";
}

/** "Section 1 · 2569/1" */
export function classLabel(c: Pick<PublicClassInfo, "section" | "academicYear" | "semester">): string {
  return `Section ${c.section} · ${c.academicYear}/${c.semester}`;
}

/** Public class lookup for a join code (404 = unknown or archived → `data` stays undefined, `notFound` true). */
export function useClassByCode(code: string | undefined) {
  const query = useQuery({
    queryKey: ["class-by-code", code],
    queryFn: () => api.get<PublicClassInfo>(`/classes/by-code/${encodeURIComponent(code ?? "")}`),
    enabled: !!code,
    staleTime: 5 * 60_000,
    retry: (count, e) => !(e instanceof ApiRequestError && e.status < 500) && count < 1,
  });
  const notFound = query.error instanceof ApiRequestError && (query.error.status === 404 || query.error.status === 410);
  return { ...query, notFound };
}
