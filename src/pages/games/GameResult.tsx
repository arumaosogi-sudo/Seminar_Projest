import { Placeholder } from "@/components/student/Placeholder";

/** 🧩 Teammate page — replace this file (route: /games/result). */
export default function GameResult() {
  return (
    <Placeholder
      title="Game result"
      description="Your score and a review of every answer."
      figmaFrame="Game – Result"
      accent="games"
      file="src/pages/games/GameResult.tsx"
      requirementIds={["GAME-6"]}
      checklist={[
        "Read the result from router state (useLocation().state) — if it is missing (page refreshed), show an empty state + “Play again” link",
        "Score ring (SVG circle, violet) with “x / y” and the percentage in the middle",
        "Answer review list: your answer, correct answer, ✓ / ✕ and a WHY sentence from the Key Point Book",
        "Buttons: “Play again” (same game), “All games” (/games), “Back to Home”",
        "No API call — game scores are not stored yet (GAME-7 is Future)",
      ]}
      links={[
        { to: "/", label: "Back to Home" },
        { to: "/games", label: "All games" },
      ]}
    />
  );
}
