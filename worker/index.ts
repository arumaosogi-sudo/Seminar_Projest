import { Hono } from "hono";

// Skeleton — the backend agent replaces this with the full API (see docs/ARCHITECTURE.md §5).
const app = new Hono<{ Bindings: Env }>().basePath("/api");

app.get("/health", (c) => c.json({ ok: true }));

export default app;
