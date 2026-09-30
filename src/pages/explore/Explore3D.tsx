import { Placeholder } from "@/components/student/Placeholder";

/** 🧩 Teammate page — replace this file (route: /explore). */
export default function Explore3D() {
  return (
    <Placeholder
      title="3D Explore"
      description="Zoom from the whole muscle down to the sarcomere."
      figmaFrame="3D Explore – Topics & levels"
      accent="explore"
      file="src/pages/explore/Explore3D.tsx"
      requirementIds={["3D-1", "3D-2", "3D-3", "3D-4", "3D-7", "3D-10", "3D-11", "3D-13", "3D-14"]}
      checklist={[
        "Topic picker: Skeletal (open) · Cardiac (“Coming soon”, 3D-10 Should) · Smooth (“Future”, 3D-11) — disabled topics must look intentional",
        "5-level breadcrumb for Skeletal: Arm · Biceps → Fascicle → Muscle fiber → Myofibril → Sarcomere (3D-2); each crumb goes back up a level",
        "Level change = camera fly-to + fade between scenes (3D-3), e.g. drei CameraControls",
        "Rotate / zoom / pan with fingers and mouse (3D-4)",
        "Hotspots on each level (drei <Html>) → click opens the info panel: name, function, Key Point Book text (3D-7)",
        "Info panel on the right on desktop, bottom sheet on phones",
        "The last level links to /explore/sarcomere (the interactive sarcomere)",
        "@react-three/fiber + @react-three/drei imported ONLY inside src/pages/explore/** · glTF models ≤ 3–5 MB per scene · frameloop=\"demand\"",
        "Loading progress and a WebGL-unavailable fallback (static image + text)",
        "List every model's licence on /credits (3D-14)",
      ]}
      links={[
        { to: "/", label: "Back to Home" },
        { to: "/explore/sarcomere", label: "Sarcomere" },
      ]}
    />
  );
}
