import { TrendingUp, TrendingDown, TriangleAlert, Info } from "lucide-react";
import type { Insight } from "@/lib/ai/insights";

const ICONS = { up: TrendingUp, down: TrendingDown, warn: TriangleAlert, neutral: Info } as const;
const COLORS = { up: "text-ios-orange", down: "text-ios-green", warn: "text-ios-red", neutral: "text-primary" } as const;

export function InsightsRow({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;
  return (
    <section className="rounded-2xl bg-card p-4 card-shadow">
      <h2 className="mb-2.5 text-footnote font-semibold uppercase tracking-wide text-muted-foreground">洞察</h2>
      <ul className="flex flex-col gap-2">
        {insights.map((i, idx) => {
          const Icon = ICONS[i.tone];
          return (
            <li key={idx} className="flex items-start gap-2 text-subhead">
              <Icon className={`mt-0.5 size-4 shrink-0 ${COLORS[i.tone]}`} />
              <span>{i.text}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
