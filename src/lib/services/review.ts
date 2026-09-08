import "server-only";
import { db } from "@/lib/db";
import { assertTripAccess, visibleTrips } from "@/lib/access";
import { badRequest, notFound } from "@/lib/api/errors";
import { imageUrl } from "@/lib/storage";
import { fmt, tripDays, babyAge, dayIndex, dayDate } from "@/lib/date";
import { formatDistance, haversine } from "@/lib/geo";
import { formatMoney } from "@/lib/currency";
import { EXPENSE_CATEGORIES } from "@/lib/entry-types";
import { yearReview, reviewableYears, type YearReview } from "@/lib/ai/year-review";
import type { ExpenseCategory } from "@/generated/prisma/enums";
import type { SummaryData } from "@/components/summary/summary-slides";
import type { Actor } from "./shared";

export type { SummaryData, YearReview };

/** 旅程总结（Wrapped 风格卡片的数据）：网页总结页与小程序共用 */
export async function tripSummary(actor: Actor, tripId: string): Promise<SummaryData> {
  await assertTripAccess(actor.userId, tripId);
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    include: {
      stops: { orderBy: [{ arriveAt: "asc" }, { order: "asc" }], include: { legsTo: true, _count: { select: { entries: true, photos: true } } } },
      entries: true,
      expenses: true,
      photos: { where: { NOT: { aiTags: { has: "document" } } }, orderBy: [{ isFavorite: "desc" }, { aiScore: "desc" }, { takenAt: "asc" }], take: 6, select: { ossKey: true } },
      _count: { select: { photos: true } },
      dailyNotes: true,
    },
  });
  if (!trip) throw notFound("旅程不存在");

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

  // 「第一次」：优先用照片视觉识别出的时刻，不足时再从文本里找
  const aiFirsts = await db.photo.findMany({ where: { tripId, firstMoment: { not: null } }, orderBy: { takenAt: "asc" }, select: { firstMoment: true }, take: 4 });
  const textFirsts = [
    ...trip.entries.map((e) => [e.title, e.note].filter(Boolean).join(" ")),
    ...trip.stops.map((s) => s.note ?? ""),
    ...trip.dailyNotes.map((d) => d.content),
    trip.description ?? "",
  ]
    .flatMap((t) => t.split(/[。！\n]/))
    .map((s) => s.trim())
    .filter((s) => s.includes("第一次") && s.length <= 40)
    .slice(0, 4);
  const firsts = Array.from(new Set([...aiFirsts.map((p) => p.firstMoment!), ...textFirsts])).slice(0, 4);

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

  return {
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
}

/** 可回顾的年份（倒序） */
export async function years(actor: Actor) {
  return { years: await reviewableYears(actor.userId) };
}

/** 年度回顾；没有该年旅程时 404 */
export async function yearReviewFor(actor: Actor, year: string | number): Promise<YearReview> {
  const y = Number(year);
  if (!Number.isInteger(y) || y < 2000 || y > 2100) throw badRequest("年份不正确");
  const review = await yearReview(actor.userId, y);
  if (!review) throw notFound(`${y} 年没有旅程记录`);
  return review;
}

export type GrowthPair = { city: string; visits: Array<{ tripId: string; title: string; date: Date; photoUrl: string | null; ageText: string | null }> };

/** 成长对照：同一城市在不同旅程各取一张照片并排，标出当时月龄 */
export async function growth(actor: Actor): Promise<{ pairs: GrowthPair[] }> {
  const trips = await db.trip.findMany({
    where: visibleTrips(actor.userId),
    orderBy: { startDate: "asc" },
    include: { stops: { where: { city: { not: null } }, select: { city: true, photos: { take: 1, orderBy: { takenAt: "asc" }, select: { ossKey: true } } } } },
  });
  const byCity = new Map<string, GrowthPair["visits"]>();
  for (const t of trips) {
    const seen = new Set<string>();
    for (const s of t.stops) {
      if (!s.city || seen.has(s.city)) continue;
      seen.add(s.city);
      const list = byCity.get(s.city) ?? [];
      list.push({ tripId: t.id, title: t.title, date: t.startDate, photoUrl: s.photos[0] ? imageUrl(s.photos[0].ossKey, { w: 400 }) : null, ageText: t.babyBirthDate ? babyAge(t.babyBirthDate, t.startDate) : null });
      byCity.set(s.city, list);
    }
  }
  const pairs = Array.from(byCity.entries())
    .filter(([, l]) => l.length >= 2 && l.some((x) => x.photoUrl))
    .map(([city, visits]) => ({ city, visits }));
  return { pairs };
}
