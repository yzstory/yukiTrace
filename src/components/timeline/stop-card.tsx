"use client";

import { useState } from "react";
import { MapPin, Baby, CloudSun } from "lucide-react";
import { STOP_TYPES, BABY_TAGS } from "@/lib/entry-types";
import { fmt, babyAge } from "@/lib/date";
import { deleteStop } from "@/app/(app)/trips/[tripId]/actions";
import { EntryRow } from "./entry-row";
import { ExpenseChip } from "./expense-chip";
import { PhotoStrip } from "./photo-strip";
import { ItemMenu } from "./item-menu";
import { EditDrawer } from "./edit-drawer";
import { StopForm } from "@/components/quick-add/stop-form";
import type { TStop, TTrip } from "./types";

export function StopCard({ stop, trip, stopOptions = [] }: { stop: TStop; trip: TTrip; index: number; stopOptions?: Array<{ id: string; name: string; arriveAt: Date }> }) {
  const cfg = STOP_TYPES[stop.type];
  const Icon = cfg.icon;
  const [editing, setEditing] = useState(false);
  return (
    <article className="relative rounded-2xl bg-card p-4 card-shadow">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-headline">{stop.name}</h3>
              <p className="text-caption text-muted-foreground">
                {fmt.time(stop.arriveAt)}
                {stop.leaveAt ? ` – ${fmt.time(stop.leaveAt)}` : ""}
                {stop.city ? ` · ${stop.city}` : ""}
                {stop.weather?.weather ? (
                  <span className="ml-1 inline-flex items-center gap-0.5">
                    <CloudSun className="size-3" /> {stop.weather.weather} {stop.weather.temperature}°
                  </span>
                ) : null}
              </p>
            </div>
            {trip.canEdit && <ItemMenu label="站点" onDelete={() => deleteStop(trip.id, stop.id)} onEdit={() => setEditing(true)} />}
          </div>
          {stop.address && (
            <p className="mt-1 flex items-start gap-1 text-caption text-label-tertiary">
              <MapPin className="mt-0.5 size-3 shrink-0" /> <span className="truncate">{stop.address}</span>
            </p>
          )}
          {(stop.babyTags.length > 0 || trip.babyBirthDate) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {trip.babyBirthDate && (
                <span className="inline-flex items-center gap-1 rounded-full bg-ios-teal/15 px-2 py-0.5 text-caption font-medium text-ios-teal">
                  <Baby className="size-3" /> {trip.babyName ?? "宝宝"} {babyAge(trip.babyBirthDate, stop.arriveAt)}
                </span>
              )}
              {stop.babyTags.map((t) => (
                <span key={t} className="rounded-full bg-fill px-2 py-0.5 text-caption text-muted-foreground">
                  {BABY_TAGS[t] ?? t}
                </span>
              ))}
            </div>
          )}
          {stop.note && <p className="mt-2 whitespace-pre-wrap text-subhead text-foreground/85">{stop.note}</p>}
          {stop.expenses.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {stop.expenses.map((e) => (
                <ExpenseChip key={e.id} expense={e} homeCurrency={trip.homeCurrency} />
              ))}
            </div>
          )}
          <PhotoStrip photos={stop.photos} />
        </div>
      </div>

      {stop.entries.length > 0 && (
        <div className="mt-3 divide-y divide-border/60 border-t border-border/60">
          {stop.entries.map((e) => (
            <EntryRow key={e.id} entry={e} tripId={trip.id} homeCurrency={trip.homeCurrency} canEdit={trip.canEdit} nested stops={stopOptions} stopId={stop.id} />
          ))}
        </div>
      )}
      {trip.canEdit && (
        <EditDrawer open={editing} onOpenChange={setEditing} title="编辑站点">
          <StopForm tripId={trip.id} defaultTime={stop.arriveAt} initial={stop} onDone={() => setEditing(false)} />
        </EditDrawer>
      )}
    </article>
  );
}
