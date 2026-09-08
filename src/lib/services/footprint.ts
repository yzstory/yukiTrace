import "server-only";
import { db } from "@/lib/db";
import { visibleTrips } from "@/lib/access";
import { DAY_COLORS, haversine } from "@/lib/geo";
import type { Actor } from "./shared";

export type Footprint = {
  stats: { trips: number; cities: number; stops: number; distanceM: number };
  trips: Array<{ id: string; title: string; startDate: Date; color: string; stops: Array<{ id: string; name: string; lat: number; lng: number; city: string | null }> }>;
};

/** 足迹：所有可见旅程的站点坐标，按旅程着色；给全局地图页与小程序足迹 Tab 用 */
export async function footprint(actor: Actor): Promise<Footprint> {
  const trips = await db.trip.findMany({
    where: visibleTrips(actor.userId),
    orderBy: { startDate: "asc" },
    include: { stops: { orderBy: [{ arriveAt: "asc" }, { order: "asc" }], select: { id: true, name: true, lat: true, lng: true, city: true } } },
  });
  const cities = new Set<string>();
  let distanceM = 0;
  for (const t of trips) {
    t.stops.forEach((s) => s.city && cities.add(s.city));
    for (let i = 1; i < t.stops.length; i++) distanceM += haversine(t.stops[i - 1], t.stops[i]);
  }
  return {
    stats: { trips: trips.length, cities: cities.size, stops: trips.reduce((a, t) => a + t.stops.length, 0), distanceM: Math.round(distanceM) },
    trips: trips.map((t, i) => ({ id: t.id, title: t.title, startDate: t.startDate, color: DAY_COLORS[Math.min(i, DAY_COLORS.length - 1)], stops: t.stops })),
  };
}
