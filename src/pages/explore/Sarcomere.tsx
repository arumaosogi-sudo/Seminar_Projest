import { Placeholder } from "@/components/student/Placeholder";

/** 🧩 Teammate page — replace this file (route: /explore/sarcomere). */
export default function Sarcomere() {
  return (
    <Placeholder
      title="Sarcomere"
      description="Contract a sarcomere and see what changes — and what doesn't."
      figmaFrame="3D Explore – Sarcomere"
      accent="explore"
      file="src/pages/explore/Sarcomere.tsx"
      requirementIds={["3D-5", "3D-6", "3D-7", "3D-8", "3D-9", "3D-12"]}
      checklist={[
        "Sarcomere built in code (instancing): Z-discs, M-line, thin filaments (actin + tropomyosin + troponin), thick filaments (myosin) (3D-5)",
        "Slider “Relaxed → Contracted” — a native <input type=\"range\"> with a visible label (3D-6)",
        "Result cards that react to the slider: Sarcomere — shorter · I-band — shorter · H-zone — narrower · A-band — no change · Filament length — no change",
        "A-band / I-band / H-zone label bars over the model, updating with the slider (3D-8)",
        "Click a part → label + info panel (name, function) for actin, myosin, tropomyosin, troponin, Z-disc, M-line, A/I/H (3D-7)",
        "Colour legend (thin filament, thick filament, Z-disc, M-line)",
        "Warning callout: “Myosin is NOT part of the thin filament”",
        "Embedded motion video for the Ca²⁺ sequence: https://youtu.be/ousflrOzQHc — youtube-nocookie.com embed, loading=\"lazy\", with a title (3D-9)",
        "Ca²⁺ release from the SR animated in 3D is Future (3D-12)",
      ]}
      links={[
        { to: "/", label: "Back to Home" },
        { to: "/explore", label: "3D Explore" },
      ]}
    />
  );
}
