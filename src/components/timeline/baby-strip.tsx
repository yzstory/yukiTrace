"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { BABY_LOG_TYPES } from "@/components/quick-add/baby-log-form";
import { deleteBabyLog } from "@/app/(app)/trips/[tripId]/actions";
import { fmt } from "@/lib/date";
import type { TBabyLog } from "./types";
import { cn } from "@/lib/utils";

export function BabyStrip({ logs, tripId, canEdit, babyName, tz }: { logs: TBabyLog[]; tripId: string; canEdit: boolean; babyName: string | null; tz?: string | null }) {
  const [pending, start] = useTransition();
  if (logs.length === 0) return null;
  const sleeps = logs.filter((l) => l.type === "SLEEP").length;
  const feeds = logs.filter((l) => l.type === "FEED").length;
  return (
    <div className="mb-3 rounded-2xl bg-ios-teal/10 px-3 py-2.5">
      <p className="mb-1.5 px-1 text-caption font-semibold text-ios-teal">
        {babyName ?? "宝宝"} · {feeds ? `喂 ${feeds} 次` : ""}
        {feeds && sleeps ? " · " : ""}
        {sleeps ? `睡 ${sleeps} 次` : ""}
      </p>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {logs.map((l) => {
          const c = BABY_LOG_TYPES[l.type];
          const Icon = c.icon;
          return (
            <span key={l.id} className={cn("group inline-flex shrink-0 items-center gap-1 rounded-full bg-card px-2 py-1 text-caption", pending && "opacity-60")}>
              <Icon className={cn("size-3", c.color)} />
              {fmt.time(l.at, tz)} {c.label}
              {l.note && <span className="text-muted-foreground">· {l.note}</span>}
              {canEdit && (
                <button type="button" aria-label="删除" onClick={() => start(() => deleteBabyLog(tripId, l.id))} className="ml-0.5 rounded-full p-0.5 text-label-tertiary hover:bg-fill">
                  <X className="size-3" />
                </button>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
