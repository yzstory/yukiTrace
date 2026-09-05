import { Footprints } from "lucide-react";
import { formatMoney } from "@/lib/currency";
import { fmt } from "@/lib/date";
import { StopCard } from "./stop-card";
import { EntryRow } from "./entry-row";
import { LegDivider } from "./leg-divider";
import { DailyNote } from "./daily-note";
import { BabyStrip } from "./baby-strip";
import { ExpenseChip } from "./expense-chip";
import { PhotoStrip } from "./photo-strip";
import type { TDay, TTrip } from "./types";

export function Timeline({ days, trip }: { days: TDay[]; trip: TTrip }) {
  const hasContent = days.some((d) => d.stops.length || d.looseEntries.length || d.looseExpenses.length || d.loosePhotos.length || d.note || d.babyLogs.length);
  if (!hasContent) {
    return (
      <div className="flex flex-col items-center rounded-3xl bg-card px-6 py-14 text-center card-shadow">
        <span className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Footprints className="size-8" />
        </span>
        <h2 className="text-title-2">开始记录第一站</h2>
        <p className="mt-1 max-w-xs text-subhead text-muted-foreground">点右下角的 + ，添加地点、航班、餐食或一笔花费。</p>
      </div>
    );
  }

  let stopCounter = 0;
  const stopOptions = days.flatMap((d) => d.stops.map((s) => ({ id: s.id, name: s.name, arriveAt: s.arriveAt })));
  return (
    <div className="flex flex-col gap-8">
      {days.map((day) => {
        const empty = !day.stops.length && !day.looseEntries.length && !day.looseExpenses.length && !day.loosePhotos.length && !day.note && !day.babyLogs.length;
        if (empty && !trip.canEdit) return null;
        return (
          <section key={day.index} id={`day-${day.index}`}>
            <header className="mb-3 flex items-baseline justify-between">
              <h2 className="text-title-2">
                Day {day.index}
                <span className="ml-2 text-subhead font-normal text-muted-foreground">
                  {fmt.date(day.date, trip.timezone)} {fmt.weekday(day.date, trip.timezone)}
                </span>
              </h2>
              {day.totalHomeMinor > 0 && (
                <span className="text-footnote tabular-nums text-muted-foreground">{formatMoney(day.totalHomeMinor, trip.homeCurrency)}</span>
              )}
            </header>

            <DailyNote tripId={trip.id} date={day.date} note={day.note} aiDraft={day.aiDraft} canEdit={trip.canEdit} aiConfigured={trip.aiConfigured} hasContent={!empty} tz={trip.timezone} multiMember={trip.multiMember} />
            <BabyStrip logs={day.babyLogs} tripId={trip.id} canEdit={trip.canEdit} babyName={trip.babyName} tz={trip.timezone} />

            {empty ? (
              <p className="rounded-2xl border border-dashed border-border px-4 py-5 text-center text-footnote text-label-tertiary">这一天还没有记录</p>
            ) : (
              <div className="flex flex-col">
                {day.stops.map((stop, i) => (
                  <div key={stop.id}>
                    {stop.legFromPrev && <LegDivider leg={stop.legFromPrev} />}
                    {!stop.legFromPrev && i > 0 && <div className="h-3" />}
                    <StopCard stop={stop} trip={trip} index={stopCounter++} stopOptions={stopOptions} />
                  </div>
                ))}
                {day.looseEntries.length > 0 && (
                  <div className={day.stops.length ? "mt-3 flex flex-col gap-3" : "flex flex-col gap-3"}>
                    {day.looseEntries.map((e) => (
                      <EntryRow key={e.id} entry={e} tripId={trip.id} homeCurrency={trip.homeCurrency} canEdit={trip.canEdit} stops={stopOptions} tz={trip.timezone} />
                    ))}
                  </div>
                )}
                {(day.looseExpenses.length > 0 || day.loosePhotos.length > 0) && (
                  <div className="mt-3 rounded-2xl bg-card p-4 card-shadow">
                    {day.looseExpenses.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {day.looseExpenses.map((e) => (
                          <ExpenseChip key={e.id} expense={e} homeCurrency={trip.homeCurrency} />
                        ))}
                      </div>
                    )}
                    <PhotoStrip photos={day.loosePhotos} />
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
