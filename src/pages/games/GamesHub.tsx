import { Placeholder } from "@/components/student/Placeholder";

/** 🧩 Teammate page — replace this file (route: /games). */
export default function GamesHub() {
  return (
    <Placeholder
      title="Games"
      description="Practice the muscular system with three quick 2D games."
      figmaFrame="Games – Hub"
      accent="games"
      file="src/pages/games/GamesHub.tsx"
      requirementIds={["GAME-1", "GAME-2", "GAME-3", "GAME-5"]}
      checklist={[
        "Three game cards (Balloon Pop · Group Sort · Diameter) in the Home card style: violet soft cover, title, one-line goal, LO tag (OL1 / OL2 / OL3), “Play” button",
        "Cards link to /games/balloon-pop, /games/group-sort and /games/diameter",
        "Optional: best score of this session per game (local state only — saving to the DB is GAME-7, Future)",
        "Responsive: 3 columns ≥1024px, 1 column on phones (≥360px); touch targets ≥44px",
        "Respect the Home lock: if GET /api/me/status says menusLocked, show a notice + link to /tests instead of the games",
        "Keep the DRAFT badge top-right while the design is a draft",
      ]}
      apiReady={["GET /api/me/status → StudentStatus (menusLocked)"]}
      links={[
        { to: "/", label: "Back to Home" },
        { to: "/games/balloon-pop", label: "Balloon Pop" },
        { to: "/games/group-sort", label: "Group Sort" },
        { to: "/games/diameter", label: "Diameter" },
      ]}
    />
  );
}
