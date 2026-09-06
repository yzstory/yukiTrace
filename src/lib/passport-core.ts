/**
 * 旅行护照的纯函数部分：不碰数据库、不碰模型，方便单测。
 * 章由站点城市推导：每个城市一枚，落在**第一次**到访的那段旅程上。
 */

export type StopLike = { tripId: string; city: string | null; arriveAt: Date; name: string; lat: number; lng: number };
export type TripLike = { id: string; title: string; timezone: string; babyBirthDate: Date | null; babyName: string | null };

export type StampSeed = {
  city: string;
  firstTripId: string;
  firstAt: Date;
  /** 该城市累计到访的旅程数 */
  tripCount: number;
  /** 该城市累计站点数 */
  stopCount: number;
  /** 首次到访时去的站点名（最多 4 个） */
  stopNames: string[];
};

/** 按城市聚合，首次到访优先 */
export function deriveStamps(stops: StopLike[]): StampSeed[] {
  const byCity = new Map<string, StampSeed & { trips: Set<string> }>();
  const sorted = [...stops].filter((s) => s.city?.trim()).sort((a, b) => a.arriveAt.getTime() - b.arriveAt.getTime());
  for (const s of sorted) {
    const city = s.city!.trim();
    const cur = byCity.get(city);
    if (!cur) {
      byCity.set(city, { city, firstTripId: s.tripId, firstAt: s.arriveAt, tripCount: 1, stopCount: 1, stopNames: [s.name], trips: new Set([s.tripId]) });
      continue;
    }
    cur.stopCount += 1;
    cur.trips.add(s.tripId);
    cur.tripCount = cur.trips.size;
    if (s.tripId === cur.firstTripId && cur.stopNames.length < 4 && !cur.stopNames.includes(s.name)) cur.stopNames.push(s.name);
  }
  return Array.from(byCity.values()).map(({ city, firstTripId, firstAt, tripCount, stopCount, stopNames }) => ({ city, firstTripId, firstAt, tripCount, stopCount, stopNames }));
}

/** 城市名 → 稳定的色相（0–360），同一城市永远同一种墨色 */
export function hueFor(city: string): number {
  let h = 0;
  for (const ch of city) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return h % 360;
}

/** 章的固定小角度倾斜，看起来像手盖的 */
export function tiltFor(city: string): number {
  return ((hueFor(city) % 17) - 8) * 0.9;
}

/** AI 不可用时的模板文案 */
export function templateLine(opts: { city: string; babyName: string | null; babyAge: string | null; isFirstCity: boolean }): string {
  const who = opts.babyName ?? "宝宝";
  if (opts.isFirstCity) return `${who}的第一座城市`;
  if (opts.babyAge) return `${opts.babyAge}的${who}，到此一游`;
  return `${who}来过${opts.city}`;
}

/** 地球周长 40075 km；返回 0–100 的百分比，一位小数 */
export function earthPercent(meters: number): number {
  return Math.round((meters / 40_075_000) * 1000) / 10;
}
