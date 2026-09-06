import "server-only";
import { generateText } from "ai";
import { db } from "@/lib/db";
import { aiConfigured, chatModel } from "@/lib/ai/model";
import { formatMoney } from "@/lib/currency";
import { formatDistance, haversine } from "@/lib/geo";
import { fmt, babyAge, tripDays } from "@/lib/date";
import { imageUrl } from "@/lib/storage";
import { EXPENSE_CATEGORIES } from "@/lib/entry-types";
import { log } from "@/lib/logger";
import type { ExpenseCategory } from "@/generated/prisma/enums";

export type YearReview = {
  year: number;
  tripCount: number;
  dayCount: number;
  cityCount: number;
  cities: string[];
  countryHint: string[];
  distanceText: string;
  flightCount: number;
  flightHours: number;
  photoCount: number;
  totalText: string;
  topCategory: { label: string; text: string; pct: number } | null;
  babyName: string | null;
  babyStartAge: string | null;
  babyEndAge: string | null;
  babyTotalText: string | null;
  firsts: string[];
  highlightPhotos: string[];
  busiestMonth: { month: number; trips: number } | null;
  trips: Array<{ id: string; title: string; dates: string; cover: string | null }>;
  letter: string | null;
};

/** 年度回顾。统计部分全部本地算，只有「给宝宝的信」交给模型。 */
export async function yearReview(userId: string, year: number): Promise<YearReview | null> {
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

  const trips = await db.trip.findMany({
    where: {
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      startDate: { lte: to },
      endDate: { gte: from },
    },
    orderBy: { startDate: "asc" },
    include: {
      stops: { orderBy: { arriveAt: "asc" } },
      entries: { where: { type: "FLIGHT" } },
      expenses: { select: { amountCnyMinor: true, category: true, isBaby: true } },
      photos: {
        where: { NOT: { aiTags: { has: "document" } } },
        orderBy: [{ isFavorite: "desc" }, { aiScore: "desc" }],
        take: 3,
        select: { ossKey: true, firstMoment: true },
      },
      _count: { select: { photos: true } },
    },
  });
  if (trips.length === 0) return null;

  const cities = new Set<string>();
  let distance = 0;
  let flightHours = 0;
  let flights = 0;
  const monthCount = new Map<number, number>();

  for (const t of trips) {
    t.stops.forEach((s) => s.city && cities.add(s.city));
    for (let i = 1; i < t.stops.length; i++) distance += haversine(t.stops[i - 1], t.stops[i]);
    flights += t.entries.length;
    flightHours += t.entries.reduce((a, e) => a + (e.endAt ? (e.endAt.getTime() - e.startAt.getTime()) / 3600_000 : 0), 0);
    const m = t.startDate.getMonth() + 1;
    monthCount.set(m, (monthCount.get(m) ?? 0) + 1);
  }

  const allExpenses = trips.flatMap((t) => t.expenses);
  const total = allExpenses.reduce((a, e) => a + e.amountCnyMinor, 0);
  const babyTotal = allExpenses.filter((e) => e.isBaby).reduce((a, e) => a + e.amountCnyMinor, 0);
  const byCat = new Map<ExpenseCategory, number>();
  allExpenses.forEach((e) => byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amountCnyMinor));
  const top = Array.from(byCat).sort((a, b) => b[1] - a[1])[0];

  const firstMoments = await db.photo.findMany({
    where: { trip: { id: { in: trips.map((t) => t.id) } }, firstMoment: { not: null } },
    select: { firstMoment: true },
    orderBy: { takenAt: "asc" },
    take: 6,
  });

  const withBaby = trips.find((t) => t.babyBirthDate);
  const busiest = Array.from(monthCount).sort((a, b) => b[1] - a[1])[0];

  const review: YearReview = {
    year,
    tripCount: trips.length,
    dayCount: trips.reduce((a, t) => a + tripDays(t.startDate, t.endDate), 0),
    cityCount: cities.size,
    cities: Array.from(cities),
    countryHint: [],
    distanceText: distance ? formatDistance(distance) : "—",
    flightCount: flights,
    flightHours: Math.round(flightHours),
    photoCount: trips.reduce((a, t) => a + t._count.photos, 0),
    totalText: formatMoney(total, "CNY"),
    topCategory: top ? { label: EXPENSE_CATEGORIES[top[0]].label, text: formatMoney(top[1], "CNY", { compact: true }), pct: Math.round((top[1] / (total || 1)) * 100) } : null,
    babyName: withBaby?.babyName ?? null,
    babyStartAge: withBaby?.babyBirthDate ? babyAge(withBaby.babyBirthDate, from) : null,
    babyEndAge: withBaby?.babyBirthDate ? babyAge(withBaby.babyBirthDate, to) : null,
    babyTotalText: babyTotal ? formatMoney(babyTotal, "CNY", { compact: true }) : null,
    firsts: Array.from(new Set(firstMoments.map((f) => f.firstMoment!))).slice(0, 5),
    highlightPhotos: trips.flatMap((t) => t.photos.map((p) => imageUrl(p.ossKey, { w: 600 }))).slice(0, 9),
    busiestMonth: busiest ? { month: busiest[0], trips: busiest[1] } : null,
    trips: trips.map((t) => ({
      id: t.id,
      title: t.title,
      dates: `${fmt.date(t.startDate, t.timezone)} – ${fmt.date(t.endDate, t.timezone)}`,
      cover: t.coverKey ? imageUrl(t.coverKey, { w: 600 }) : null,
    })),
    letter: null,
  };

  if (aiConfigured()) {
    try {
      const { text } = await generateText({
        model: chatModel(),
        system: `你替一对父母给孩子写一封 ${review.year} 年的年终短信，150 字左右，中文，第二人称称呼孩子。基于给出的事实，温柔但不肉麻，结尾一句期待明年。不要标题、不要 emoji、不要罗列数字清单，纯文本、不用任何 Markdown 符号。`,
        prompt: [
          `孩子：${review.babyName ?? "宝宝"}，年初 ${review.babyStartAge ?? "未知"}，年末 ${review.babyEndAge ?? "未知"}`,
          `这一年出行 ${review.tripCount} 段，共 ${review.dayCount} 天，去了 ${review.cityCount} 座城市：${review.cities.join("、")}`,
          `旅程：${review.trips.map((t) => t.title).join("；")}`,
          review.flightCount ? `坐了 ${review.flightCount} 次飞机` : "",
          review.firsts.length ? `第一次：${review.firsts.join("；")}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      });
      review.letter = text.trim();
    } catch (e) {
      log.warn("yearReview.letter failed", { year, err: e });
    }
  }

  return review;
}

/** 有记录的年份列表 */
export async function reviewableYears(userId: string): Promise<number[]> {
  const trips = await db.trip.findMany({
    where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { startDate: true, endDate: true },
  });
  const years = new Set<number>();
  trips.forEach((t) => {
    for (let y = t.startDate.getFullYear(); y <= t.endDate.getFullYear(); y++) years.add(y);
  });
  return Array.from(years).sort((a, b) => b - a);
}
