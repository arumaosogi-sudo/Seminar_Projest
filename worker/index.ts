/**
 * Digital Muscle API (Cloudflare Worker + Hono). Contract: docs/ARCHITECTURE.md §5 and shared/contract.ts.
 * Static SPA assets are served by Workers Static Assets; only /api/* reaches this Worker.
 */
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { AppEnv } from "./env";
import { HttpError } from "./http";
import { adminRoutes } from "./routes/admin";
import { attemptRoutes } from "./routes/attempts";
import { publicRoutes } from "./routes/public";
import { studentRoutes } from "./routes/student";

const app = new Hono<AppEnv>().basePath("/api");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// API responses are per-user JSON: never cache, never sniff.
app.use("*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
});

/** Body size guard: 64 KB by default, 1 MB for the test builder and roster import. */
const tooLarge = (c: Context) => c.json({ error: "The request is too large.", code: "payload_too_large" }, 413);
const smallBody = bodyLimit({ maxSize: 64 * 1024, onError: tooLarge });
const largeBody = bodyLimit({ maxSize: 1024 * 1024, onError: tooLarge });
const LARGE_BODY_PATHS = [/^\/api\/admin\/tests(\/\d+)?$/, /^\/api\/admin\/classes\/\d+\/roster$/];
app.use("*", async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) return next();
  const large = LARGE_BODY_PATHS.some((re) => re.test(c.req.path));
  return (large ? largeBody : smallBody)(c, next);
});

/**
 * CSRF defence (SameSite=Lax cookie + these checks):
 *  - an Origin header, when present, must equal this request's origin;
 *  - requests with a body must be `application/json` (HTML forms cannot send that cross-site without a CORS preflight).
 *    Body-less DELETEs are exempt: DELETE is never a CORS "simple" request, so the browser preflights it anyway.
 */
app.use("*", async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) return next();
  const origin = c.req.header("Origin");
  if (origin && origin !== new URL(c.req.url).origin) {
    throw new HttpError(403, "forbidden", "Cross-origin request blocked.");
  }
  const contentType = (c.req.header("Content-Type") ?? "").toLowerCase();
  const hasBody = c.req.method !== "DELETE" || Number(c.req.header("Content-Length") ?? "0") > 0;
  if (hasBody && !contentType.startsWith("application/json")) {
    throw new HttpError(415, "unsupported_media_type", "Requests must be sent as application/json.");
  }
  return next();
});

app.route("/", publicRoutes);
app.route("/", studentRoutes);
app.route("/", attemptRoutes);
app.route("/admin", adminRoutes);

app.notFound((c) => c.json({ error: "Not found.", code: "not_found" }, 404));

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message, code: err.code }, err.status);
  // Log only the message/stack — never request headers, cookies or tokens.
  console.error("Unhandled API error:", err instanceof Error ? (err.stack ?? err.message) : String(err));
  return c.json({ error: "Something went wrong. Please try again.", code: "internal" }, 500);
});

export default app;
