import "server-only";
import { generateText } from "ai";
import { db } from "@/lib/db";
import { aiConfigured, chatModel } from "@/lib/ai/model";
import { imageUrl } from "@/lib/storage";
import { fmt, babyAge } from "@/lib/date";
import { haversine } from "@/lib/geo";
import { log } from "@/lib/logger";
import { deriveStamps, hueFor, tiltFor, templateLine, earthPercent } from "@/lib/passport-core";

export type PassportStamp = {
  city: string;
  tripId: string;
  tripTitle: string;
  firstAt: Date;
  dateText: string;
  babyAgeText: string | null;
  tripCount: number;
  stopCount: number;
  stopNames: string[];
  photoUrl: string | null;
  hue: number;
  tilt: number;
  /** null = 还没盖章 */
  line: string | null;
  inkedAt: Date | null;
};

export type Passport = {
  babyName: string | null;
  stats: { cities: number; trips: number; distanceM: number; flights: number; earthPercent: number; inked: number };
  stamps: PassportStamp[];
};

function visibleTrips(userId: string) {
  return { OR: [{ ownerId: userId }, { members: { some: { userId } } }] };
}

/** 整本护照：城市从站点推导，盖章状态与文案来自 CityStamp */
export async function passportFor(userId: string): Promise<Passport> {
  const trips = await db.trip.findMany({
    where: visibleTrips(userId),
    orderBy: { startDate: "asc" },
    include: {
      stops: { orderBy: { arriveAt: "asc" }, select: { id: true, tripId: true, city: true, arriveAt: true, name: true, lat: true, lng: true, timezone: true } },
      stamps: true,
      _count: { select: { entries: { where: { type: "FLIGHT" } } } },
    },
  });
  const tripById = new Map(trips.map((t) => [t.id, t]));
  const seeds = deriveStamps(trips.flatMap((t) => t.stops));
  const stamped = new Map<string, { line: string | null; inkedAt: Date }>();
  for (const t of trips) for (const s of t.stamps) if (!stamped.has(s.city)) stamped.set(s.city, { line: s.line, inkedAt: s.inkedAt });

  // 每个城市挑一张照片当底纹：首访旅程里该城市站点的第一张
  const firstStopIds = seeds.map((s) => tripById.get(s.firstTripId)?.stops.find((x) => x.city?.trim() === s.city)?.id).filter((x): x is string => !!x);
  const photos = firstStopIds.length
    ? await db.photo.findMany({ where: { stopId: { in: firstStopIds }, NOT: { aiTags: { has: "document" } } }, orderBy: [{ isFavorite: "desc" }, { aiScore: "desc" }, { takenAt: "asc" }], select: { stopId: true, ossKey: true } })
    : [];
  const photoByStop = new Map<string, string>();
  for (const p of photos) if (p.stopId && !photoByStop.has(p.stopId)) photoByStop.set(p.stopId, p.ossKey);

  const stamps: PassportStamp[] = seeds.map((s) => {
    const trip = tripById.get(s.firstTripId)!;
    const stop = trip.stops.find((x) => x.city?.trim() === s.city);
    const tz = stop?.timezone ?? trip.timezone;
    const ink = stamped.get(s.city);
    return {
      city: s.city,
      tripId: s.firstTripId,
      tripTitle: trip.title,
      firstAt: s.firstAt,
      dateText: fmt.dateFull(s.firstAt, tz),
      babyAgeText: trip.babyBirthDate ? babyAge(trip.babyBirthDate, s.firstAt) : null,
      tripCount: s.tripCount,
      stopCount: s.stopCount,
      stopNames: s.stopNames,
      photoUrl: stop && photoByStop.get(stop.id) ? imageUrl(photoByStop.get(stop.id)!, { w: 600 }) : null,
      hue: hueFor(s.city),
      tilt: tiltFor(s.city),
      line: ink?.line ?? null,
      inkedAt: ink?.inkedAt ?? null,
    };
  });

  let distanceM = 0;
  for (const t of trips) for (let i = 1; i < t.stops.length; i++) distanceM += haversine(t.stops[i - 1], t.stops[i]);
  const flights = trips.reduce((a, t) => a + t._count.entries, 0);
  const babyName = trips.find((t) => t.babyName)?.babyName ?? null;

  return {
    babyName,
    stats: { cities: stamps.length, trips: trips.length, distanceM: Math.round(distanceM), flights, earthPercent: earthPercent(distanceM), inked: stamps.filter((s) => s.inkedAt).length },
    stamps,
  };
}

/** 这段旅程里「首次到访且还没盖章」的城市，用于旅程页提示 */
export async function unstampedCitiesForTrip(userId: string, tripId: string): Promise<string[]> {
  const passport = await passportFor(userId);
  return passport.stamps.filter((s) => s.tripId === tripId && !s.inkedAt).map((s) => s.city);
}

/** 章上的一句话：AI 优先，失败或未配置用模板 */
export async function composeLine(stamp: PassportStamp, opts: { babyName: string | null; isFirstCity: boolean; firsts: string[] }): Promise<{ line: string; source: "ai" | "template" }> {
  const fallback = { line: templateLine({ city: stamp.city, babyName: opts.babyName, babyAge: stamp.babyAgeText, isFirstCity: opts.isFirstCity }), source: "template" as const };
  if (!aiConfigured()) return fallback;
  try {
    const { text } = await generateText({
      model: chatModel(),
      system: "你给一本宝宝的旅行护照写章上的一句话。中文，12 到 24 个字，一句完整的话，具体、温柔、有画面，不要 emoji、不要标点堆砌、不要引号，纯文本、不用任何 Markdown 符号。只输出这一句。",
      prompt: [
        `城市：${stamp.city}${opts.isFirstCity ? "（这是宝宝去的第一座城市）" : ""}`,
        `日期：${stamp.dateText}`,
        stamp.babyAgeText ? `宝宝：${opts.babyName ?? "宝宝"}，当时 ${stamp.babyAgeText}` : "",
        stamp.stopNames.length ? `去了：${stamp.stopNames.join("、")}` : "",
        opts.firsts.length ? `第一次：${opts.firsts.join("；")}` : "",
        stamp.tripCount > 1 ? `之后又来过 ${stamp.tripCount - 1} 次` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    });
    const line = text.trim().replace(/^["「『]|["」』]$/g, "").split("\n")[0].slice(0, 30);
    return line.length >= 4 ? { line, source: "ai" } : fallback;
  } catch (e) {
    log.warn("passport.composeLine failed", { city: stamp.city, err: e });
    return fallback;
  }
}
