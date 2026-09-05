import { notFound } from "next/navigation";
import { BackButton } from "@/components/layout/back-button";
import { SummarySlides, type SummaryData } from "@/components/summary/summary-slides";
import { requireTripAccess } from "@/lib/dal";
import { db } from "@/lib/db";
import { imageUrl } from "@/lib/storage";
import { fmt, tripDays, babyAge, dayIndex, dayDate } from "@/lib/date";
import { formatDistance, haversine } from "@/lib/geo";
import { formatMoney } from "@/lib/currency";
import { EXPENSE_CATEGORIES } from "@/lib/entry-types";
import type { ExpenseCategory } from "@/generated/prisma/enums";

export const metadata = { title: "旅程总结" };

export default async function SummaryPage(props: PageProps<"/trips/[tripId]/summary">) {
  const { tripId } = await props.params;
  await requireTripAccess(tripId);
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    include: {
      stops: { orderBy: [{ arriveAt: "asc" }, { order: "asc" }], include: { legsTo: true, _count: { select: { entries: true, photos: true } } } },
      entries: true,
      expenses: true,
      photos: { orderBy: [{ isFavorite: "desc" }, { takenAt: "asc" }], take: 6, select: { ossKey: true } },
      _count: { select: { photos: true } },
      dailyNotes: true,
    },
  });
  if (!trip) notFound();

  const n = tripDays(trip.startDate, trip.endDate);
  let distance = 0;
  trip.stops.forEach((s, i) => {
    const prev = trip.stops[i - 1];
    if (!prev) return;
    const leg = s.legsTo.find((l) => l.fromStopId === prev.id && l.mode === "DRIVING") ?? s.legsTo.find((l) => l.fromStopId === prev.id);
    distance += leg?.distanceM ?? haversine(prev, s);
  });
  const flights = trip.entries.filter((e) => e.type === "FLIGHT");
  const flightHours = Math.round(flights.reduce((a, f) => a + (f.endAt ? (f.endAt.getTime() - f.startAt.getTime()) / 3600000 : 0), 0));
  const total = trip.expenses.reduce((a, e) => a + e.amountHomeMinor, 0);
  const byCat = new Map<ExpenseCategory, number>();
  trip.expenses.forEach((e) => byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amountHomeMinor));
  const top = Array.from(byCat.entries()).sort((a, b) => b[1] - a[1])[0];
  const babyTotal = trip.expenses.filter((e) => e.isBaby).reduce((a, e) => a + e.amountHomeMinor, 0);

  // 「第一次」：从条目 / 站点备注 / 日记里找含「第一次」的句子
  const firsts = [
    ...trip.entries.map((e) => [e.title, e.note].filter(Boolean).join(" ")),
    ...trip.stops.map((s) => s.note ?? ""),
    ...trip.dailyNotes.map((d) => d.content),
    trip.description ?? "",
  ]
    .flatMap((t) => t.split(/[。！\n]/))
    .map((s) => s.trim())
    .filter((s) => s.includes("第一次") && s.length <= 40)
    .slice(0, 4);

  // 最丰富的一天：站点 + 条目 + 照片数最多
  const dayScore = new Map<number, number>();
  trip.stops.forEach((s) => {
    const di = Math.min(Math.max(dayIndex(trip.startDate, s.arriveAt, trip.timezone), 1), n);
    dayScore.set(di, (dayScore.get(di) ?? 0) + 2 + s._count.entries + s._count.photos * 0.5);
  });
  const bestIdx = Array.from(dayScore.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  const bestStops = bestIdx ? trip.stops.filter((s) => Math.min(Math.max(dayIndex(trip.startDate, s.arriveAt), 1), n) === bestIdx) : [];
  const bestNote = bestIdx ? trip.dailyNotes.find((d) => dayIndex(trip.startDate, d.date) === bestIdx)?.content : null;

  const cities = Array.from(new Set(trip.stops.map((s) => s.city).filter((c): c is string => !!c)));

  const data: SummaryData = {
    title: trip.title,
    dateRange: `${fmt.dateFull(trip.startDate, trip.timezone)} – ${fmt.date(trip.endDate, trip.timezone)}`,
    days: n,
    coverUrl: trip.coverKey ? imageUrl(trip.coverKey, { w: 1200 }) : null,
    stopCount: trip.stops.length,
    cityNames: cities,
    distanceText: distance ? formatDistance(distance) : "—",
    flightCount: flights.length,
    flightHours,
    totalText: formatMoney(total, trip.homeCurrency),
    dailyAvgText: formatMoney(Math.round(total / n), trip.homeCurrency, { compact: true }),
    topCategory: top ? { label: EXPENSE_CATEGORIES[top[0]].label, text: formatMoney(top[1], trip.homeCurrency, { compact: true }), pct: Math.round((top[1] / (total || 1)) * 100) } : null,
    babyName: trip.babyName,
    babyAgeText: trip.babyBirthDate ? babyAge(trip.babyBirthDate, trip.startDate) : null,
    babyTotalText: babyTotal ? formatMoney(babyTotal, trip.homeCurrency, { compact: true }) : null,
    babyFirsts: firsts,
    photoCount: trip._count.photos,
    favoritePhotos: trip.photos.map((p) => imageUrl(p.ossKey, { w: 400 })),
    bestDay: bestIdx ? { index: bestIdx, date: fmt.dateFull(dayDate(trip.startDate, bestIdx), trip.timezone), text: bestNote || bestStops.map((s) => s.name).join(" → ") } : null,
    travelers: trip.travelers,
    aiText: null,
  };

  return (
    <>
      <BackButton href={`/trips/${tripId}`} label={trip.title} />
      <h1 className="mb-4 text-large-title">旅程总结</h1>
      <SummarySlides data={data} />
    </>
  );
}
