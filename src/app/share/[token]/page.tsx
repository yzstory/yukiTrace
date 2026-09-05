import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { Footprints, Baby, Route, MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { imageUrl } from "@/lib/storage";
import { fmt, tripDays, dayIndex, dayDate, babyAge } from "@/lib/date";
import { formatDistance, haversine, dayColor } from "@/lib/geo";
import { ENTRY_TYPES, STOP_TYPES } from "@/lib/entry-types";
import { RouteSketch } from "@/components/map/route-sketch";
import { PhotoStrip } from "@/components/timeline/photo-strip";
import { formatMoney } from "@/lib/currency";

async function loadShare(token: string) {
  const link = await db.shareLink.findUnique({ where: { token }, include: { trip: { include: { stops: { orderBy: [{ arriveAt: "asc" }, { order: "asc" }], include: { entries: { orderBy: { startAt: "asc" } }, photos: { orderBy: { takenAt: "asc" } }, expenses: true } }, dailyNotes: true, expenses: { select: { amountHomeMinor: true } } } } } });
  if (!link || (link.expiresAt && link.expiresAt < new Date())) return null;
  return link;
}

export async function generateMetadata(props: PageProps<"/share/[token]">): Promise<Metadata> {
  const { token } = await props.params;
  const link = await loadShare(token);
  return { title: link ? `${link.trip.title} · 分享` : "分享", robots: { index: false } };
}

export default async function SharePage(props: PageProps<"/share/[token]">) {
  const { token } = await props.params;
  const link = await loadShare(token);
  if (!link) notFound();
  const trip = link.trip;
  const withToken = (key: string, w: number) => `${imageUrl(key, { w })}${imageUrl(key).startsWith("/api/") ? `&t=${token}` : ""}`;
  const n = tripDays(trip.startDate, trip.endDate);
  let totalM = 0;
  for (let i = 1; i < trip.stops.length; i++) totalM += haversine(trip.stops[i - 1], trip.stops[i]);
  const total = trip.expenses.reduce((a, e) => a + e.amountHomeMinor, 0);
  const points = trip.stops.map((s, i) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, index: i + 1, group: dayIndex(trip.startDate, s.arriveAt, trip.timezone), color: dayColor(Math.min(Math.max(dayIndex(trip.startDate, s.arriveAt, trip.timezone), 1), n)) }));

  return (
    <main className="mx-auto max-w-2xl px-5 py-6 safe-top safe-bottom">
      <div className="overflow-hidden rounded-3xl bg-card card-shadow">
        <div className="relative aspect-[16/9] bg-gradient-to-br from-ios-blue/80 to-ios-indigo/80">
          {trip.coverKey ? <Image src={withToken(trip.coverKey, 1600)} alt="" fill sizes="100vw" className="object-cover" unoptimized priority /> : <Footprints className="absolute right-6 top-6 size-20 text-white/25" />}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-5 pt-20 text-white">
            <p className="text-footnote text-white/80">
              {fmt.dateFull(trip.startDate, trip.timezone)} – {fmt.date(trip.endDate, trip.timezone)} · {n} 天
            </p>
            <h1 className="text-large-title text-white">{trip.title}</h1>
            {trip.description && <p className="mt-1 text-subhead text-white/85">{trip.description}</p>}
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border/60 py-3 text-center">
          <Stat icon={Footprints} value={`${trip.stops.length}`} label="站" />
          <Stat icon={Route} value={totalM ? formatDistance(totalM) : "—"} label="里程" />
          {link.hideExpense ? <Stat icon={Baby} value={trip.babyBirthDate ? babyAge(trip.babyBirthDate, trip.startDate) : "—"} label={trip.babyName ?? "宝宝"} /> : <Stat icon={Footprints} value={formatMoney(total, trip.homeCurrency, { compact: true })} label="花费" />}
        </div>
      </div>

      {points.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-3xl bg-card text-foreground card-shadow">
          <RouteSketch points={points} className="aspect-[16/10] w-full" />
        </div>
      )}

      <div className="mt-8 flex flex-col gap-8">
        {Array.from({ length: n }, (_, i) => i + 1).map((di) => {
          const date = dayDate(trip.startDate, di);
          const stops = trip.stops.filter((s) => Math.min(Math.max(dayIndex(trip.startDate, s.arriveAt, trip.timezone), 1), n) === di);
          const note = trip.dailyNotes.find((d) => dayIndex(trip.startDate, d.date) === di)?.content;
          if (!stops.length && !note) return null;
          return (
            <section key={di}>
              <h2 className="mb-3 text-title-2">
                Day {di} <span className="text-subhead font-normal text-muted-foreground">{fmt.date(date, trip.timezone)} {fmt.weekday(date, trip.timezone)}</span>
              </h2>
              {note && <p className="mb-3 rounded-2xl bg-ios-yellow/15 px-4 py-3 text-subhead">{note}</p>}
              <div className="flex flex-col gap-3">
                {stops.map((s) => {
                  const Icon = STOP_TYPES[s.type].icon;
                  return (
                    <article key={s.id} className="rounded-2xl bg-card p-4 card-shadow">
                      <div className="flex items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Icon className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-headline">{s.name}</h3>
                          <p className="text-caption text-muted-foreground">
                            {fmt.time(s.arriveAt, s.timezone ?? trip.timezone)}
                            {s.city ? ` · ${s.city}` : ""}
                          </p>
                          {s.address && (
                            <p className="mt-1 flex items-center gap-1 text-caption text-label-tertiary">
                              <MapPin className="size-3" /> {s.address}
                            </p>
                          )}
                          {s.note && <p className="mt-2 text-subhead">{s.note}</p>}
                          {s.entries.length > 0 && (
                            <ul className="mt-2 flex flex-wrap gap-1.5">
                              {s.entries.map((e) => {
                                const EIcon = ENTRY_TYPES[e.type].icon;
                                return (
                                  <li key={e.id} className="inline-flex items-center gap-1 rounded-full bg-fill px-2.5 py-1 text-footnote">
                                    <EIcon className={`size-3 ${ENTRY_TYPES[e.type].color}`} /> {e.title}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                          {!link.hideExpense && s.expenses.length > 0 && (
                            <p className="mt-2 text-caption text-muted-foreground">花费 {formatMoney(s.expenses.reduce((a, e) => a + e.amountHomeMinor, 0), trip.homeCurrency)}</p>
                          )}
                          <PhotoStrip photos={s.photos.map((p) => ({ id: p.id, url: withToken(p.ossKey, 1600), thumbUrl: withToken(p.ossKey, 300), width: p.width, height: p.height, caption: p.caption, takenAt: p.takenAt }))} />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <p className="mt-12 text-center text-caption text-label-tertiary">由 Trace 记录 · 只读分享</p>
    </main>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof Footprints; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2">
      <Icon className="size-4 text-label-tertiary" />
      <span className="text-headline">{value}</span>
      <span className="text-caption text-muted-foreground">{label}</span>
    </div>
  );
}
