import type { ApiError } from "@shared/contract";

/** Error thrown for non-2xx responses. `status` is the HTTP status, `code` the optional machine code from the API. */
export class ApiRequestError extends Error {
  status: number;
  code?: string;
  constructor(status: number, body: ApiError) {
    super(body.error || `Request failed (${status})`);
    this.status = status;
    this.code = body.code;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiRequestError(res.status, (data ?? { error: res.statusText }) as ApiError);
  return data as T;
}

/**
 * Tiny JSON client for the Worker API. Paths are relative to /api.
 *   api.get<Me>("/me")
 *   api.post<AttemptInProgress>("/attempts", { assignmentId })
 */
export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body ?? {}),
  del: <T>(path: string) => request<T>("DELETE", path),
};
