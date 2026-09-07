import "server-only";
import { z } from "zod";
import { after } from "next/server";
import { db } from "@/lib/db";
import { auditedDb } from "@/lib/activity";
import { assertTripAccess } from "@/lib/access";
import { log } from "@/lib/logger";
import { haversine, suggestMode } from "@/lib/geo";
import { drivingRoute, walkingRoute, reverseGeocode, amapConfigured, liveWeather } from "@/lib/amap";
import { StopType } from "@/generated/prisma/enums";
import { parseInTz, TIMEZONES } from "@/lib/date";
import { num, optStr, reqStr, strList, type Input } from "./input";
import { parse, refreshTrip, scheduleReindex, tripTz, type Actor } from "./shared";

const stopSchema = z.object({
  name: reqStr("请填写地点名称", 80),
  type: z.nativeEnum(StopType).default("OTHER"),
  lat: num.min(-90).max(90),
  lng: num.min(-180).max(180),
  address: optStr,
  city: optStr,
  amapPoiId: optStr,
  arriveAt: reqStr("请选择到达时间"),
  leaveAt: optStr,
  note: optStr,
  babyTags: strList.default([]),
  timezone: optStr.refine((t) => !t || TIMEZONES.some((x) => x.value === t), "时区不支持"),
});
export type StopInput = z.input<typeof stopSchema>;

export async function createStop(actor: Actor, tripId: string, input: Input) {
  await assertTripAccess(actor.userId, tripId, "EDITOR");
  const audited = auditedDb({ tripId, userId: actor.userId });
  const d = parse(stopSchema, input);
  const tz = d.timezone || (await tripTz(tripId));
  const arriveAt = parseInTz(d.arriveAt, tz);

  let address = d.address || null;
  let city = d.city || null;
  let adcode: string | null = null;
  let weather: { weather: string; temperature: string } | null = null;
  if (amapConfigured()) {
    const geo = await reverseGeocode({ lat: d.lat, lng: d.lng });
    address ??= geo?.address || null;
    city ??= geo?.city || null;
    adcode = geo?.adcode ?? null;
    // 只有当到达时间在当前 ±12 小时内，实况天气才有记录意义
    if (adcode && Math.abs(arriveAt.getTime() - Date.now()) < 12 * 3600_000) {
      const w = await liveWeather(adcode);
      if (w) weather = { weather: w.weather, temperature: w.temperature };
    }
  }

  const count = await db.stop.count({ where: { tripId } });
  const stop = await audited.stop.create({
    data: {
      tripId, name: d.name, type: d.type, lat: d.lat, lng: d.lng, address, city,
      amapPoiId: d.amapPoiId || null, adcode, timezone: d.timezone || null, weather: weather ?? undefined,
      arriveAt, leaveAt: d.leaveAt ? parseInTz(d.leaveAt, tz) : null, note: d.note || null, babyTags: d.babyTags, order: count,
    },
  });

  // 响应返回后再算路，失败要留下日志而不是静默吞掉
  after(async () => {
    try {
      await computeLegForStop(tripId, stop.id);
    } catch (err) {
      log.error("leg.compute failed", { tripId, stopId: stop.id, err });
    }
  });
  refreshTrip(tripId);
  scheduleReindex(tripId);
  return { id: stop.id, city, address, arriveAt };
}

export async function updateStop(actor: Actor, tripId: string, stopId: string, input: Input) {
  await assertTripAccess(actor.userId, tripId, "EDITOR");
  const audited = auditedDb({ tripId, userId: actor.userId });
  const d = parse(stopSchema, input);
  const tz = d.timezone || (await tripTz(tripId));
  const arriveAt = parseInTz(d.arriveAt, tz);
  const before = await db.stop.findUnique({ where: { id: stopId, tripId }, select: { lat: true, lng: true, arriveAt: true } });
  await audited.stop.update({
    where: { id: stopId, tripId },
    data: {
      name: d.name, type: d.type, lat: d.lat, lng: d.lng, address: d.address || null, city: d.city || null, timezone: d.timezone || null,
      arriveAt, leaveAt: d.leaveAt ? parseInTz(d.leaveAt, tz) : null, note: d.note || null, babyTags: d.babyTags,
    },
  });
  const moved = before && (before.lat !== d.lat || before.lng !== d.lng || before.arriveAt.getTime() !== arriveAt.getTime());
  if (moved) {
    await db.stopLeg.deleteMany({ where: { OR: [{ fromStopId: stopId }, { toStopId: stopId }] } });
    after(async () => {
      try {
        await recomputeAllLegs(tripId);
      } catch (err) {
        log.error("leg.recompute failed", { tripId, err });
      }
    });
  }
  refreshTrip(tripId);
  scheduleReindex(tripId);
  return { id: stopId };
}

export async function deleteStop(actor: Actor, tripId: string, stopId: string) {
  await assertTripAccess(actor.userId, tripId, "EDITOR");
  await auditedDb({ tripId, userId: actor.userId }).stop.delete({ where: { id: stopId, tripId } });
  after(async () => {
    try {
      await recomputeAllLegs(tripId);
    } catch (err) {
      log.error("leg.recompute failed", { tripId, err });
    }
  });
  refreshTrip(tripId);
}

/** 计算某站与其前一站的距离并缓存 */
async function computeLegForStop(tripId: string, stopId: string) {
  const stops = await db.stop.findMany({ where: { tripId }, orderBy: [{ arriveAt: "asc" }, { order: "asc" }], select: { id: true, lat: true, lng: true } });
  const idx = stops.findIndex((s) => s.id === stopId);
  const pairs: Array<[(typeof stops)[number], (typeof stops)[number]]> = [];
  if (idx > 0) pairs.push([stops[idx - 1], stops[idx]]);
  if (idx >= 0 && idx < stops.length - 1) pairs.push([stops[idx], stops[idx + 1]]);
  await Promise.all(pairs.map(([a, b]) => ensureLeg(a, b)));
  refreshTrip(tripId);
}

async function recomputeAllLegs(tripId: string) {
  const stops = await db.stop.findMany({ where: { tripId }, orderBy: [{ arriveAt: "asc" }, { order: "asc" }], select: { id: true, lat: true, lng: true } });
  for (let i = 1; i < stops.length; i++) await ensureLeg(stops[i - 1], stops[i]);
  refreshTrip(tripId);
}

async function ensureLeg(a: { id: string; lat: number; lng: number }, b: { id: string; lat: number; lng: number }) {
  const straight = haversine(a, b);
  await db.stopLeg.upsert({
    where: { fromStopId_toStopId_mode: { fromStopId: a.id, toStopId: b.id, mode: "STRAIGHT" } },
    update: { distanceM: straight },
    create: { fromStopId: a.id, toStopId: b.id, mode: "STRAIGHT", distanceM: straight },
  });
  const mode = suggestMode(straight);
  if (mode === "STRAIGHT" || !amapConfigured()) return;
  const existing = await db.stopLeg.findUnique({ where: { fromStopId_toStopId_mode: { fromStopId: a.id, toStopId: b.id, mode } } });
  if (existing) return;
  const route = mode === "WALKING" ? await walkingRoute(a, b) : await drivingRoute(a, b);
  if (!route) return;
  await db.stopLeg.create({ data: { fromStopId: a.id, toStopId: b.id, mode, distanceM: route.distanceM, durationS: route.durationS, polyline: route.polyline } });
}
