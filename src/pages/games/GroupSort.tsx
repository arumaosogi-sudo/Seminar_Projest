import { Placeholder } from "@/components/student/Placeholder";

/** 🧩 Teammate page — replace this file (route: /games/group-sort). */
export default function GroupSort() {
  return (
    <Placeholder
      title="Group Sort"
      description="Match each muscle structure with the connective tissue that wraps it."
      figmaFrame="Game – Group Sort"
      accent="games"
      file="src/pages/games/GroupSort.tsx"
      requirementIds={["GAME-2", "GAME-4", "GAME-5", "GAME-6", "OL2"]}
      checklist={[
        "Match structure ↔ connective tissue: Muscle ↔ Epimysium · Fascicle ↔ Perimysium · Muscle fiber ↔ Endomysium; also sort items into “structure” vs “connective tissue”",
        "Card pool at the bottom, drop zones (pairs / groups) above — drag with @dnd-kit (pointer, touch and keyboard sensors)",
        "Buttons: “Reset” (outline) and “Check answers” (violet, disabled until every card is placed)",
        "After checking: correct slots green, wrong slots red, with a short WHY per item",
        "Key point panel (Key Point Book text) beside the board on desktop, collapsible under it on phones",
        "Share ONE drag-and-drop engine with Diameter (GAME-4), e.g. src/pages/games/dnd/, reading each puzzle from JSON",
        "Import @dnd-kit only inside src/pages/games/** (keeps it out of the Home bundle)",
        "Finish → /games/result with score + review",
      ]}
      links={[
        { to: "/", label: "Back to Home" },
        { to: "/games", label: "All games" },
      ]}
    />
  );
}
