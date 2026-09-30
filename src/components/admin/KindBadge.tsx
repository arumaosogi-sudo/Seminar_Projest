import type { TestKind } from "@shared/contract";
import { Badge } from "@/components/ui";
import { kindLabel } from "./format";

export function KindBadge({ kind }: { kind: TestKind }) {
  const tone = kind === "pretest" ? "neutral" : kind === "posttest" ? "tests" : "games";
  return (
    <Badge tone={tone} className="tracking-wide uppercase">
      {kindLabel[kind]}
    </Badge>
  );
}
