import { Hono } from "hono";
import { GAME_IDS, GAME_LABELS, GAME_MAX_SCORE, type AdminGameResults, type EnrollmentStatus, type GameId } from "../../../shared/contract";
import { queryAll, type SqlValue } from "../../db";
import type { AppEnv } from "../../env";
import { round2 } from "../../grading";
import { badRequest } from "../../http";
import { ANONYMIZED_LABEL, assertVisibleClass, loadClassBasics, ownedClasses } from "./common";

export const gameResultRoutes = new Hono<AppEnv>();

interface BestRow {
  enrollment_id: number;
  game_id: GameId;
  best: number;
  plays: number;
  last_played_at: string;
}

/**
 * GET /api/admin/game-results?classId=&status=all
 * Collected game score (GAME-7): each student's best run out of 10 per game (any mode), number of plays and the total.
 * Withdrawn enrollments are excluded unless status=all.
 */
gameResultRoutes.get("/game-results", async (c) => {
  const db = c.env.DB;
  const classIdRaw = c.req.query("classId");
  const includeWithdrawn = c.req.query("status") === "all";
  let classId: number | null = null;
  if (classIdRaw) {
    if (!/^\d+$/.test(classIdRaw)) throw badRequest("classId must be a number.");
    classId = Number(classIdRaw);
    assertVisibleClass(await loadClassBasics(db, classId), c.get("admin"));
  }
  // private by owner, like Results: an instructor sees only their own sections (the emergency account sees all)
  const own = ownedClasses(c.get("admin"));
  const classWhere = classId === null ? `c.status = 'active' AND ${own.sql}` : "c.id = ?";
  const classParams: SqlValue[] = classId === null ? own.params : [classId];
  const statusWhere = includeWithdrawn ? "" : "AND e.status = 'active'";

  const enrollments = await queryAll<{
    id: number;
    status: EnrollmentStatus;
    class_name: string;
    student_code: string | null;
    first_name: string | null;
  }>(
    db,
    `SELECT e.id, e.status, c.name AS class_name, s.student_code, s.first_name
       FROM enrollments e JOIN students s ON s.id = e.student_id JOIN classes c ON c.id = e.class_id
      WHERE ${classWhere} ${statusWhere}
      ORDER BY c.academic_year DESC, c.semester DESC, c.section, s.student_code`,
    ...classParams,
  );

  const best = await queryAll<BestRow>(
    db,
    `SELECT g.enrollment_id, g.game_id, MAX(g.score) AS best, COUNT(*) AS plays, MAX(g.updated_at) AS last_played_at
       FROM game_runs g JOIN enrollments e ON e.id = g.enrollment_id JOIN classes c ON c.id = e.class_id
      WHERE ${classWhere} ${statusWhere}
      GROUP BY g.enrollment_id, g.game_id`,
    ...classParams,
  );

  const byEnrollment = new Map<number, BestRow[]>();
  for (const b of best) byEnrollment.set(b.enrollment_id, [...(byEnrollment.get(b.enrollment_id) ?? []), b]);

  const rows: AdminGameResults["rows"] = enrollments.map((e) => {
    const games = Object.fromEntries(GAME_IDS.map((id) => [id, null])) as AdminGameResults["rows"][number]["games"];
    for (const b of byEnrollment.get(e.id) ?? []) {
      games[b.game_id] = { best: b.best, plays: b.plays, lastPlayedAt: b.last_played_at };
    }
    return {
      studentCode: e.student_code ?? ANONYMIZED_LABEL,
      firstName: e.first_name,
      className: e.class_name,
      enrollmentStatus: e.status,
      games,
      total: round2(GAME_IDS.reduce((n, id) => n + (games[id]?.best ?? 0), 0)),
    };
  });

  const games: AdminGameResults["games"] = GAME_IDS.map((id) => {
    const played = rows.map((r) => r.games[id]).filter((g) => g !== null);
    return {
      gameId: id,
      label: GAME_LABELS[id],
      players: played.length,
      plays: played.reduce((n, g) => n + g.plays, 0),
      meanBest: played.length ? round2(played.reduce((n, g) => n + g.best, 0) / played.length) : null,
    };
  });

  return c.json<AdminGameResults>({ classId, maxScore: GAME_MAX_SCORE, games, rows });
});
