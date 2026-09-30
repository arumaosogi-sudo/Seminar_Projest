import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { z } from "zod";

/** Thrown anywhere in a handler; rendered by the app error handler as `{ error, code }`. */
export class HttpError extends Error {
  readonly status: ContentfulStatusCode;
  readonly code: string;
  constructor(status: ContentfulStatusCode, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message: string) => new HttpError(400, "validation", message);
export const unauthenticated = (message = "Please sign in.") => new HttpError(401, "unauthenticated", message);
export const forbidden = (message = "You do not have access to this.", code = "forbidden") => new HttpError(403, code, message);
export const notFound = (message = "Not found.") => new HttpError(404, "not_found", message);
export const conflict = (message: string, code = "conflict") => new HttpError(409, code, message);

/** Human-readable summary of zod issues: "questions.0.prompt: Too small; title: Required". */
export function formatZodError(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
    .join("; ");
}

/** Parses the JSON body and validates it with a contract schema (400 `validation` on failure). */
export async function readBody<S extends z.ZodType>(c: Context, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    const text = await c.req.text();
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw badRequest("Request body must be valid JSON.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw badRequest(formatZodError(parsed.error));
  return parsed.data;
}

/** Positive integer path parameter or 404. */
export function idParam(c: Context, name = "id"): number {
  const raw = c.req.param(name) ?? "";
  if (!/^\d{1,12}$/.test(raw)) throw notFound();
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n <= 0) throw notFound();
  return n;
}
