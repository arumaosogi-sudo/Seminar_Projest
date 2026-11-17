import { Hono } from "hono";
import { gameRunBody, type GameBest, type GameId } from "../../shared/contract";
import { execute, nowIso, queryAll } from "../db";
import type { AppEnv } from "../env";
import { readBody } from "../http";
import { requireStudent } from "../auth";

/** Game scores (GAME-7): the games module posts every finished (or left) run here, scored out of 10. */
export const gameRoutes = new Hono<AppEnv>();

gameRoutes.use("/me/game-runs", requireStudent);

/**
 * POST /api/me/game-runs — saves one run. The same runId sent again (a resumed Diameter run) updates that row,
 * so a run is never counted twice.
 */
gameRoutes.post("/me/game-runs", async (c) => {
  const s = c.get("student");
  const body = await readBody(c, gameRunBody);
  const now = nowIso();
  await execute(
    c.env.DB,
    `INSERT INTO game_runs (student_id, enrollment_id, class_id, run_id, game_id, score_key, score, completed,
                            summary, mistakes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (student_id, run_id) DO UPDATE SET
       score = excluded.score, completed = excluded.completed, summary = excluded.summary,
       mistakes = excluded.mistakes, updated_at = excluded.updated_at`,
    s.id,
    s.enrollment?.id ?? null,
    s.enrollment?.classId ?? null,
    body.runId,
    body.scoreKey.split(":")[0],
    body.scoreKey,
    Math.round(body.score * 10) / 10, // one decimal, e.g. 8.3
    body.completed ? 1 : 0,
    body.summary,
    JSON.stringify(body.mistakes),
    now,
    now,
  );
  return c.json({ ok: true }, 201);
});

/** GET /api/me/game-runs — the signed-in student's best score (out of 10) per game, any mode. */
gameRoutes.get("/me/game-runs", async (c) => {
  const s = c.get("student");
  const rows = await queryAll<{ game_id: GameId; best: number; plays: number; last_played_at: string }>(
    c.env.DB,
    `SELECT game_id, MAX(score) AS best, COUNT(*) AS plays, MAX(updated_at) AS last_played_at
       FROM game_runs WHERE student_id = ? GROUP BY game_id`,
    s.id,
  );
  return c.json<GameBest[]>(rows.map((r) => ({ gameId: r.game_id, best: r.best, plays: r.plays, lastPlayedAt: r.last_played_at })));
});
