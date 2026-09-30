import { Placeholder } from "@/components/student/Placeholder";

/** 🧩 Teammate page — replace this file (route: /games/diameter). */
export default function Diameter() {
  return (
    <Placeholder
      title="Diameter"
      description="Order the structures from the smallest to the largest diameter."
      figmaFrame="Game – Diameter"
      accent="games"
      file="src/pages/games/Diameter.tsx"
      requirementIds={["GAME-3", "GAME-4", "GAME-5", "GAME-6", "OL3"]}
      checklist={[
        "Drag to order the structures by diameter, from 5–6 nm (thin filament) up to ~100 µm (muscle fiber) — sizes from the Key Point Book",
        "Each card shows a circle whose size hints the scale (log scale so the smallest one is still visible) + the structure name",
        "A ruler / axis from “5–6 nm” to “~100 µm” under the drop row",
        "Same @dnd-kit engine as Group Sort (GAME-4) — sortable list, keyboard accessible",
        "“Reset” and “Check answers”; wrong positions highlighted with the correct size shown",
        "Finish → /games/result with score + review (WHY for each size)",
      ]}
      links={[
        { to: "/", label: "Back to Home" },
        { to: "/games", label: "All games" },
      ]}
    />
  );
}
