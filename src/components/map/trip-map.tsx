"use client";

import { useCallback, useMemo, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Play, MapPin, ChevronRight } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { AMapView, type AMapViewHandle } from "./amap-view";
import type { MapPoint, MapPath } from "./types";
import { formatDistance, formatDuration } from "@/lib/geo";
import { fmt } from "@/lib/date";
import { cn } from "@/lib/utils";

export type TripMapStop = MapPoint & {
  dayIndex: number;
  arriveAt: Date;
  address: string | null;
  photos: Array<{ id: string; thumbUrl: string }>;
  entryTitles: string[];
  legFromPrev: { distanceM: number; durationS: number | null; mode: string } | null;
};

export function TripMap({ tripId, stops, days, homeLabel, timezone }: { tripId: string; stops: TripMapStop[]; days: Array<{ index: number; date: Date; color: string }>; homeLabel: string; timezone: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [dayFilter, setDayFilter] = useState<number | null>(null);
  const handle = useRef<AMapViewHandle | null>(null);

  const visible = useMemo(() => (dayFilter ? stops.filter((s) => s.dayIndex === dayFilter) : stops), [stops, dayFilter]);
  const paths: MapPath[] = useMemo(() => {
    const out: MapPath[] = [];
    // 每天一条线，并把前一天的最后一站连到当天第一站（用当天颜色）
    for (const d of days) {
      const ds = stops.filter((s) => s.dayIndex === d.index);
      if (ds.length === 0) continue;
      const pts: Array<[number, number]> = ds.map((s) => [s.lng, s.lat]);
      const firstIdx = stops.indexOf(ds[0]);
      if (firstIdx > 0 && !dayFilter) pts.unshift([stops[firstIdx - 1].lng, stops[firstIdx - 1].lat]);
      if (!dayFilter || dayFilter === d.index) out.push({ group: d.index, color: d.color, points: pts });
    }
    return out;
  }, [stops, days, dayFilter]);

  const onReady = useCallback((h: AMapViewHandle) => {
    handle.current = h;
  }, []);
  const onSelect = useCallback((id: string) => {
    setSelected(id);
    handle.current?.focus(id);
  }, []);

  const sel = stops.find((s) => s.id === selected) ?? null;

  return (
    <div className="relative -mx-5 -mt-6 h-[calc(100dvh-4.5rem-env(safe-area-inset-bottom))] md:-mx-8 md:-mt-10 md:h-dvh">
      <AMapView points={visible} paths={paths} selectedId={selected} onSelect={onSelect} onReady={onReady} className="h-full w-full" />

      {/* 顶部：返回 + 天数筛选 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3 safe-top">
        <div className="pointer-events-auto flex items-center gap-2">
          <Link href={`/trips/${tripId}`} className="glass flex h-9 items-center gap-1 rounded-full pl-2 pr-3 text-callout font-medium">
            <ChevronRight className="size-4 rotate-180" /> {homeLabel}
          </Link>
          <button type="button" onClick={() => handle.current?.replay()} className="glass ml-auto flex h-9 items-center gap-1.5 rounded-full px-3 text-callout font-medium text-primary" disabled={stops.length < 2}>
            <Play className="size-4 fill-current" /> 回放
          </button>
        </div>
        <div className="pointer-events-auto no-scrollbar flex gap-1.5 overflow-x-auto">
          <Chip active={dayFilter === null} onClick={() => setDayFilter(null)} label="全部" />
          {days.map((d) => (
            <Chip key={d.index} active={dayFilter === d.index} onClick={() => setDayFilter(d.index)} label={`Day ${d.index}`} color={d.color} />
          ))}
        </div>
      </div>

      {/* 底部：站点横向卡片 */}
      <div className="absolute inset-x-0 bottom-0 z-10 pb-3">
        <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-4">
          {visible.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              className={cn("pressable glass flex w-64 shrink-0 snap-center items-center gap-3 rounded-2xl p-3 text-left", selected === s.id && "ring-2 ring-primary")}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full text-subhead font-bold text-white" style={{ background: s.color }}>
                {s.index}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-callout font-medium">{s.name}</span>
                <span className="block truncate text-caption text-muted-foreground">
                  Day {s.dayIndex} · {fmt.time(s.arriveAt, timezone)}
                  {s.legFromPrev ? ` · ${formatDistance(s.legFromPrev.distanceM)}` : ""}
                </span>
              </span>
              {s.photos[0] && (
                <span className="relative size-11 shrink-0 overflow-hidden rounded-lg">
                  <Image src={s.photos[0].thumbUrl} alt="" fill sizes="44px" className="object-cover" unoptimized />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <Drawer open={!!sel} onOpenChange={(o) => !o && setSelected(null)} modal={false}>
        <DrawerContent className="rounded-t-3xl bg-background">
          {sel && (
            <>
              <DrawerHeader className="text-left">
                <DrawerTitle className="flex items-center gap-2 text-headline">
                  <span className="flex size-7 items-center justify-center rounded-full text-caption font-bold text-white" style={{ background: sel.color }}>
                    {sel.index}
                  </span>
                  {sel.name}
                </DrawerTitle>
                <DrawerDescription className="text-footnote">
                  Day {sel.dayIndex} · {fmt.dateTime(sel.arriveAt, timezone)}
                  {sel.legFromPrev ? ` · 距上一站 ${formatDistance(sel.legFromPrev.distanceM)}${sel.legFromPrev.durationS ? `，约 ${formatDuration(sel.legFromPrev.durationS)}` : ""}` : ""}
                </DrawerDescription>
              </DrawerHeader>
              <div className="px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                {sel.address && (
                  <p className="mb-3 flex items-start gap-1 text-footnote text-muted-foreground">
                    <MapPin className="mt-0.5 size-3.5 shrink-0" /> {sel.address}
                  </p>
                )}
                {sel.entryTitles.length > 0 && (
                  <ul className="mb-3 flex flex-wrap gap-1.5">
                    {sel.entryTitles.map((t, i) => (
                      <li key={i} className="rounded-full bg-fill px-2.5 py-1 text-footnote">
                        {t}
                      </li>
                    ))}
                  </ul>
                )}
                {sel.photos.length > 0 && (
                  <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                    {sel.photos.map((p) => (
                      <span key={p.id} className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-fill">
                        <Image src={p.thumbUrl} alt="" fill sizes="96px" className="object-cover" unoptimized />
                      </span>
                    ))}
                  </div>
                )}
                <Link href={`/trips/${tripId}#day-${sel.dayIndex}`} className="mt-4 flex h-11 items-center justify-center rounded-xl bg-fill text-callout font-medium">
                  在时间线中查看
                </Link>
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function Chip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("glass flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-footnote font-medium", active ? "text-foreground ring-2 ring-primary/60" : "text-muted-foreground")}>
      {color && <span className="size-2.5 rounded-full" style={{ background: color }} />}
      {label}
    </button>
  );
}
