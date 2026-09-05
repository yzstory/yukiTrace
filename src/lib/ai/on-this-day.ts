import "server-only";
import { db } from "@/lib/db";
import { babyAge } from "@/lib/date";
import { imageUrl } from "@/lib/storage";

export type OnThisDayItem = {
  tripId: string;
  tripTitle: string;
  year: number;
  yearsAgo: number;
  stopName: string;
  city: string | null;
  babyAgeText: string | null;
  photoUrl: string | null;
  caption: string | null;
};

/** 往年的今天去过哪儿。按「几年前」聚合，每年只留最有代表性的一站 */
export async function onThisDay(userId: string, now = new Date()): Promise<OnThisDayItem[]> {
  const month = now.getMonth();
  const date = now.getDate();
  const thisYear = now.getFullYear();

  const stops = await db.stop.findMany({
    where: {
      trip: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
      arriveAt: { lt: new Date(thisYear, month, date) },
    },
    include: {
      trip: { select: { id: true, title: true, babyName: true, babyBirthDate: true, startDate: true, endDate: true } },
      photos: { where: { NOT: { aiTags: { has: "document" } } }, orderBy: [{ aiScore: "desc" }, { takenAt: "asc" }], take: 1, select: { ossKey: true, aiCaption: true, caption: true } },
    },
  });

  const byYear = new Map<number, OnThisDayItem>();
  for (const s of stops) {
    const d = new Date(s.arriveAt);
    if (d.getMonth() !== month || d.getDate() !== date) continue;
    // 站点时间必须落在所属旅程的日期范围内，否则视为脏数据不展示
    if (d.getTime() < s.trip.startDate.getTime() - 86400_000 || d.getTime() > s.trip.endDate.getTime() + 2 * 86400_000) continue;
    const year = d.getFullYear();
    const existing = byYear.get(year);
    // 优先保留有照片的那一站
    if (existing && !(s.photos.length > 0 && !existing.photoUrl)) continue;
    byYear.set(year, {
      tripId: s.trip.id,
      tripTitle: s.trip.title,
      year,
      yearsAgo: thisYear - year,
      stopName: s.name,
      city: s.city,
      babyAgeText: s.trip.babyBirthDate ? babyAge(s.trip.babyBirthDate, s.arriveAt) : null,
      photoUrl: s.photos[0] ? imageUrl(s.photos[0].ossKey, { w: 600 }) : null,
      caption: s.photos[0]?.caption ?? s.photos[0]?.aiCaption ?? null,
    });
  }

  return Array.from(byYear.values()).sort((a, b) => b.year - a.year);
}
