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
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON body (e.g. an HTML error page from the edge). Keep the status; use a generic message.
    if (res.ok) throw new ApiRequestError(res.status, { error: "Unexpected response from the server.", code: "bad_response" });
  }
  if (!res.ok) {
    const fallback: ApiError =
      res.status === 413
        ? { error: "That's too large to send. Try fewer or shorter items.", code: "payload_too_large" }
        : res.status === 429
          ? { error: "Too many requests — please wait a moment and try again.", code: "rate_limited" }
          : { error: `The server couldn't complete the request (${res.status}). Please try again.` };
    const body = data && typeof data === "object" && "error" in data ? (data as ApiError) : fallback;
    throw new ApiRequestError(res.status, body);
  }
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
