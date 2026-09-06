import Link from "next/link";
import { Stamp as StampIcon, ChevronRight } from "lucide-react";

/** 旅程页：这趟有新城市还没盖章 */
export function StampNudge({ cities }: { cities: string[] }) {
  if (cities.length === 0) return null;
  return (
    <Link href="/passport" className="pressable mb-5 flex items-center gap-3 rounded-2xl bg-brand-soft px-4 py-3 text-brand">
      <StampIcon className="size-5 shrink-0" />
      <span className="min-w-0 flex-1 text-callout">
        新城市 <span className="font-semibold">{cities.slice(0, 3).join("、")}</span>
        {cities.length > 3 ? ` 等 ${cities.length} 座` : ""}，去护照盖章
      </span>
      <ChevronRight className="size-4 shrink-0" />
    </Link>
  );
}
