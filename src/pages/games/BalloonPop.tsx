import { Placeholder } from "@/components/student/Placeholder";

/** 🧩 Teammate page — replace this file (route: /games/balloon-pop). */
export default function BalloonPop() {
  return (
    <Placeholder
      title="Balloon Pop"
      description="Pop the balloons that match the target muscle type."
      figmaFrame="Game – Balloon Pop"
      accent="games"
      file="src/pages/games/BalloonPop.tsx"
      requirementIds={["GAME-1", "GAME-5", "GAME-6", "OL1"]}
      checklist={[
        "Balloons float up carrying a word (location / function / structure / control) — tap the ones that match the target muscle type",
        "The target type (Skeletal / Cardiac / Smooth) changes every 5 balloons; show it large at the top",
        "HUD: progress (e.g. 12/30), countdown timer and score",
        "Instant feedback on every tap: “+1” (green) when correct, “✕” (red) when wrong — also announced in an aria-live region",
        "CSS animations (transform only) + Pointer Events — no game engine or canvas library (≤ 30 KB gzip)",
        "Works with touch and mouse (GAME-5); pause when the tab is hidden (visibilitychange)",
        "Questions come from a static JSON file inside src/pages/games/ (no API)",
        "End of game → navigate to /games/result with the score + answer list in router state (GAME-6)",
        "Respect prefers-reduced-motion (slower balloons, no bounce)",
      ]}
      links={[
        { to: "/", label: "Back to Home" },
        { to: "/games", label: "All games" },
      ]}
    />
  );
}
