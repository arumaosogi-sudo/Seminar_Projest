import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppConfig, Me } from "@shared/contract";
import { api, ApiRequestError } from "./api";

export const meKey = ["me"] as const;

/** Current session. `data` is null when logged out (401). */
export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: async (): Promise<Me | null> => {
      try {
        return await api.get<Me>("/me");
      } catch (e) {
        if (e instanceof ApiRequestError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 60_000,
  });
}

export function useAppConfig() {
  return useQuery({ queryKey: ["config"], queryFn: () => api.get<AppConfig>("/config"), staleTime: Infinity });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ ok: true }>("/auth/logout"),
    onSuccess: () => {
      qc.clear();
      qc.setQueryData(meKey, null);
    },
  });
}

const JOIN_KEY = "dm_join_code";

/** Join code from a section QR (/join/:code) is kept until login succeeds. */
export const joinCodeStore = {
  get: (): string | undefined => {
    try {
      return sessionStorage.getItem(JOIN_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  },
  set: (code: string) => {
    try {
      sessionStorage.setItem(JOIN_KEY, code.toUpperCase());
    } catch {
      /* storage unavailable — the code is still passed in the URL */
    }
  },
  clear: () => {
    try {
      sessionStorage.removeItem(JOIN_KEY);
    } catch {
      /* ignore */
    }
  },
};
