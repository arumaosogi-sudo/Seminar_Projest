import { useCallback } from "react";
import { useMatch } from "react-router";
import type { GameRunBody } from "@shared/contract";
import { api } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { useDocumentTitle } from "@/components/student/useDocumentTitle";
import { StudentPageHeader } from "@/components/student/StudentPageHeader";
import { GAMES, MuscleGames, type MuscleGameRun } from "@/muscle-games";
// Cover-title fonts, self-hosted: the CSP blocks Google Fonts. Text and heading fonts come from index.css.
import "@fontsource/bungee/latin-400.css";
import "@fontsource/black-ops-one/latin-400.css";
import "@fontsource/cinzel-decorative/latin-700.css";
import "@fontsource/cinzel-decorative/latin-900.css";

/** /games/* — the Muscle Games module. Every finished (or left) run, scored out of 10, is saved to the student's record (GAME-7). */
export default function MuscleGamesPage() {
  useDocumentTitle("Games");
  const saveRun = useCallback(async (run: MuscleGameRun) => {
    const body: GameRunBody = {
      runId: run.runId,
      scoreKey: run.scoreKey as GameRunBody["scoreKey"],
      score: run.score,
      completed: run.completed,
      summary: run.summary,
      mistakes: run.mistakes,
    };
    await api.post("/me/game-runs", body);
  }, []);
  // The hub and every game get the same page header as the other student pages (breadcrumb, phone back button).
  const onHub = useMatch("/games") !== null;
  const gameMatch = useMatch("/games/:gameId");
  const gameIndex = GAMES.findIndex((g) => g.id === gameMatch?.params.gameId);
  const game = GAMES[gameIndex];
  // Runs that fail to save (Wi-Fi drop) wait in this browser and are re-sent only for this same student.
  const me = useMe().data;
  const playerId = me?.role === "student" ? String(me.student.id) : null;
  // coast-sans: the same Nunito Sans text font as Lessons and 3D Explore.
  return (
    <div className="coast-sans">
      {onHub && (
        <StudentPageHeader
          title="Games"
          subtitle="3 Muscular Games"
          crumbs={[{ to: "/", label: "Home" }, { label: "Games" }]}
          back="/"
        />
      )}
      {game && (
        <StudentPageHeader
          title={game.title}
          subtitle={`Game ${gameIndex + 1} · ${game.goal}`}
          crumbs={[{ to: "/", label: "Home" }, { to: "/games", label: "Games" }, { label: game.title }]}
          back="/games"
        />
      )}
      {/* On phones the games keep their sticky piece tray above the fixed bottom tab bar (StudentLayout BottomTabs),
          and size the Balloon Pop sky to fit under the 64 px header bar. */}
      <MuscleGames
        onGameFinish={saveRun}
        hubTitle={!onHub}
        gameHeader={!game}
        playerId={playerId}
        className="[--mg-bottom-inset:calc(76px+env(safe-area-inset-bottom))] [--mg-top-inset:80px] md:[--mg-bottom-inset:0px] md:[--mg-top-inset:0px]"
      />
    </div>
  );
}
