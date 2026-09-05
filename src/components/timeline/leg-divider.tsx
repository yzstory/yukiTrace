import { Car, Footprints, Plane, MoveRight } from "lucide-react";
import { formatDistance, formatDuration } from "@/lib/geo";
import type { TLeg } from "./types";

export function LegDivider({ leg }: { leg: TLeg }) {
  const Icon = leg.mode === "WALKING" ? Footprints : leg.mode === "DRIVING" ? Car : leg.distanceM > 500000 ? Plane : MoveRight;
  const modeLabel = leg.mode === "WALKING" ? "步行" : leg.mode === "DRIVING" ? "驾车" : "直线";
  return (
    <div className="flex items-center gap-2 py-2 pl-[1.125rem] text-caption text-label-tertiary">
      <span className="h-6 w-px border-l border-dashed border-label-tertiary/60" />
      <Icon className="size-3.5" />
      <span>
        {modeLabel} {formatDistance(leg.distanceM)}
        {leg.durationS ? ` · 约 ${formatDuration(leg.durationS)}` : ""}
      </span>
    </div>
  );
}
