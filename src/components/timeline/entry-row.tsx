"use client";

import { ENTRY_TYPES } from "@/lib/entry-types";
import { fmt } from "@/lib/date";
import { cn } from "@/lib/utils";
import { deleteEntry } from "@/app/(app)/trips/[tripId]/actions";
import { ExpenseChip } from "./expense-chip";
import { PhotoStrip } from "./photo-strip";
import { ItemMenu } from "./item-menu";
import type { TEntry } from "./types";

export function EntryRow({ entry, tripId, homeCurrency, canEdit, nested }: { entry: TEntry; tripId: string; homeCurrency: string; canEdit: boolean; nested?: boolean }) {
  const cfg = ENTRY_TYPES[entry.type];
  const Icon = cfg.icon;
  const metaLine = summarizeMeta(entry);
  return (
    <div className={cn("flex gap-3", nested ? "py-2.5" : "rounded-2xl bg-card p-4 card-shadow")}>
      <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl", cfg.bg, cfg.color)}>
        <Icon className="size-[18px]" strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-callout font-medium">{entry.title}</p>
            <p className="text-caption text-muted-foreground">
              {cfg.label} · {fmt.time(entry.startAt)}
              {entry.endAt ? ` – ${fmt.time(entry.endAt)}` : ""}
              {metaLine ? ` · ${metaLine}` : ""}
            </p>
          </div>
          {canEdit && <ItemMenu label="条目" onDelete={() => deleteEntry(tripId, entry.id)} />}
        </div>
        {entry.note && <p className="mt-1.5 whitespace-pre-wrap text-subhead text-foreground/85">{entry.note}</p>}
        {entry.expenses.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {entry.expenses.map((e) => (
              <ExpenseChip key={e.id} expense={e} homeCurrency={homeCurrency} />
            ))}
          </div>
        )}
        <PhotoStrip photos={entry.photos} />
      </div>
    </div>
  );
}

function summarizeMeta(entry: TEntry): string {
  const m = entry.meta ?? {};
  const s = (k: string) => (typeof m[k] === "string" && m[k] ? (m[k] as string) : "");
  switch (entry.type) {
    case "FLIGHT":
      return [s("flightNo"), s("from") && s("to") ? `${s("from")} → ${s("to")}` : "", s("seat") && `座位 ${s("seat")}`].filter(Boolean).join(" · ");
    case "CAR_RENTAL": {
      const km = m.startKm && m.endKm ? `${Number(m.endKm) - Number(m.startKm)} km` : "";
      return [s("company"), s("carModel"), km].filter(Boolean).join(" · ");
    }
    case "TRAIN":
      return [s("trainNo"), s("from") && s("to") ? `${s("from")} → ${s("to")}` : ""].filter(Boolean).join(" · ");
    case "TAXI":
      return s("from") && s("to") ? `${s("from")} → ${s("to")}` : "";
    case "HOTEL":
      return [s("roomType"), s("hasCrib") && `婴儿床 ${s("hasCrib")}`].filter(Boolean).join(" · ");
    case "MEAL":
      return s("dishes");
    case "SHOPPING":
      return s("items");
    default:
      return "";
  }
}
