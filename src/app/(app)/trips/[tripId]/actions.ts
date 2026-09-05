"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { log } from "@/lib/logger";
import { db } from "@/lib/db";
import { requireTripAccess } from "@/lib/dal";
import { haversine, suggestMode } from "@/lib/geo";
import { drivingRoute, walkingRoute, reverseGeocode, amapConfigured, liveWeather } from "@/lib/amap";
import { BabyLogType } from "@/generated/prisma/enums";
import { CURRENCIES, toMinor, convertMinor, FALLBACK_RATES_TO_CNY } from "@/lib/currency";
import { parseInTz, TIMEZONES } from "@/lib/date";
import { deleteObject } from "@/lib/storage";
import { EntryType, ExpenseCategory, StopType } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import type { ActionState } from "@/app/(app)/trips/actions";

export type { ActionState };

/** 条目时区：优先取所属站点覆盖的时区，否则旅程时区 */
async function entryTz(tripId: string, stopId: string | null) {
  if (stopId) {
    const s = await db.stop.findUnique({ where: { id: stopId }, select: { timezone: true } });
    if (s?.timezone) return s.timezone;
  }
  return tripTz(tripId);
}

/** 旅程时区（站点可覆盖） */
async function tripTz(tripId: string) {
  const t = await db.trip.findUnique({ where: { id: tripId }, select: { timezone: true } });
  return t?.timezone ?? "Asia/Shanghai";
}

const num = z.coerce.number();
const optStr = z.string().trim().optional().or(z.literal(""));

// ───────────────────────── 站点 ─────────────────────────

const stopSchema = z.object({
  name: z.string().trim().min(1, "请填写地点名称").max(80),
  type: z.nativeEnum(StopType).default("OTHER"),
  lat: num.min(-90).max(90),
  lng: num.min(-180).max(180),
  address: optStr,
  city: optStr,
  amapPoiId: optStr,
  arriveAt: z.string().min(1, "请选择到达时间"),
  leaveAt: optStr,
  note: optStr,
  babyTags: optStr,
  timezone: optStr.refine((t) => !t || TIMEZONES.some((x) => x.value === t), "时区不支持"),
});

export async function createStop(tripId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireTripAccess(tripId, "EDITOR");
  const parsed = stopSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
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
  const stop = await db.stop.create({
    data: {
      tripId,
      name: d.name,
      type: d.type,
      lat: d.lat,
      lng: d.lng,
      address,
      city,
      amapPoiId: d.amapPoiId || null,
      adcode,
      timezone: d.timezone || null,
      weather: weather ?? undefined,
      arriveAt,
      leaveAt: d.leaveAt ? parseInTz(d.leaveAt, tz) : null,
      note: d.note || null,
      babyTags: (d.babyTags ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      order: count,
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

  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}

export async function updateStop(tripId: string, stopId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireTripAccess(tripId, "EDITOR");
  const parsed = stopSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const tz = d.timezone || (await tripTz(tripId));
  const arriveAt = parseInTz(d.arriveAt, tz);
  const before = await db.stop.findUnique({ where: { id: stopId }, select: { lat: true, lng: true, arriveAt: true } });
  await db.stop.update({
    where: { id: stopId, tripId },
    data: {
      name: d.name,
      type: d.type,
      lat: d.lat,
      lng: d.lng,
      address: d.address || null,
      city: d.city || null,
      timezone: d.timezone || null,
      arriveAt,
      leaveAt: d.leaveAt ? parseInTz(d.leaveAt, tz) : null,
      note: d.note || null,
      babyTags: (d.babyTags ?? "").split(",").map((s) => s.trim()).filter(Boolean),
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
  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}

export async function deleteStop(tripId: string, stopId: string) {
  await requireTripAccess(tripId, "EDITOR");
  await db.stop.delete({ where: { id: stopId, tripId } });
  after(async () => {
    try {
      await recomputeAllLegs(tripId);
    } catch (err) {
      log.error("leg.recompute failed", { tripId, err });
    }
  });
  revalidatePath(`/trips/${tripId}`);
}

/** 计算某站与其前一站的距离并缓存 */
async function computeLegForStop(tripId: string, stopId: string) {
  const stops = await db.stop.findMany({ where: { tripId }, orderBy: [{ arriveAt: "asc" }, { order: "asc" }], select: { id: true, lat: true, lng: true } });
  const idx = stops.findIndex((s) => s.id === stopId);
  const pairs: Array<[typeof stops[number], typeof stops[number]]> = [];
  if (idx > 0) pairs.push([stops[idx - 1], stops[idx]]);
  if (idx >= 0 && idx < stops.length - 1) pairs.push([stops[idx], stops[idx + 1]]);
  await Promise.all(pairs.map(([a, b]) => ensureLeg(a, b)));
  revalidatePath(`/trips/${tripId}`);
}

async function recomputeAllLegs(tripId: string) {
  const stops = await db.stop.findMany({ where: { tripId }, orderBy: [{ arriveAt: "asc" }, { order: "asc" }], select: { id: true, lat: true, lng: true } });
  for (let i = 1; i < stops.length; i++) await ensureLeg(stops[i - 1], stops[i]);
  revalidatePath(`/trips/${tripId}`);
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
  await db.stopLeg.create({
    data: { fromStopId: a.id, toStopId: b.id, mode, distanceM: route.distanceM, durationS: route.durationS, polyline: route.polyline },
  });
}

// ───────────────────────── 条目 ─────────────────────────

const entrySchema = z.object({
  type: z.nativeEnum(EntryType),
  title: z.string().trim().min(1, "请填写标题").max(120),
  stopId: optStr,
  note: optStr,
  startAt: z.string().min(1, "请选择时间"),
  endAt: optStr,
  meta: optStr,
  // 可选：同时记一笔花费
  amount: optStr,
  currency: optStr,
  category: z.nativeEnum(ExpenseCategory).optional(),
  isBaby: optStr,
});

export async function createEntry(tripId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { userId } = await requireTripAccess(tripId, "EDITOR");
  const parsed = entrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const tz = await entryTz(tripId, d.stopId || null);
  const startAt = parseInTz(d.startAt, tz);

  let meta: Record<string, unknown> | null = null;
  if (d.meta) {
    try {
      meta = JSON.parse(d.meta);
    } catch {
      return { error: "附加信息格式错误" };
    }
  }

  const entry = await db.entry.create({
    data: {
      tripId,
      stopId: d.stopId || null,
      type: d.type,
      title: d.title,
      note: d.note || null,
      startAt,
      endAt: d.endAt ? parseInTz(d.endAt, tz) : null,
      meta: meta ? (meta as import("@/generated/prisma/internal/prismaNamespace").InputJsonValue) : undefined,
    },
  });

  if (d.amount && parseFloat(d.amount) > 0) {
    const r = await buildExpense({
      tripId,
      userId,
      amount: d.amount,
      currency: d.currency || undefined,
      category: d.category,
      isBaby: d.isBaby === "on" || d.isBaby === "true",
      title: d.title,
      paidAt: startAt,
      stopId: d.stopId || null,
      entryId: entry.id,
    });
    if ("error" in r) return { error: r.error };
    await db.expense.create({ data: r.data });
  }

  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}

export async function updateEntry(tripId: string, entryId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireTripAccess(tripId, "EDITOR");
  const parsed = entrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  let meta: Record<string, unknown> | null = null;
  if (d.meta) {
    try {
      meta = JSON.parse(d.meta);
    } catch {
      return { error: "附加信息格式错误" };
    }
  }
  const tz = await entryTz(tripId, d.stopId || null);
  await db.entry.update({
    where: { id: entryId, tripId },
    data: {
      stopId: d.stopId || null,
      type: d.type,
      title: d.title,
      note: d.note || null,
      startAt: parseInTz(d.startAt, tz),
      endAt: d.endAt ? parseInTz(d.endAt, tz) : null,
      meta: meta ? (meta as import("@/generated/prisma/internal/prismaNamespace").InputJsonValue) : Prisma.DbNull,
    },
  });
  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}

export async function deleteEntry(tripId: string, entryId: string) {
  await requireTripAccess(tripId, "EDITOR");
  await db.entry.delete({ where: { id: entryId, tripId } });
  revalidatePath(`/trips/${tripId}`);
}

// ───────────────────────── 花费 ─────────────────────────

const expenseSchema = z.object({
  title: z.string().trim().min(1, "请填写名称").max(120),
  amount: z.string().min(1, "请填写金额"),
  currency: z.string().optional(),
  category: z.nativeEnum(ExpenseCategory).default("OTHER"),
  isBaby: optStr,
  paidAt: z.string().min(1, "请选择时间"),
  stopId: optStr,
  entryId: optStr,
  note: optStr,
  rate: optStr,
});

async function buildExpense(input: {
  tripId: string;
  userId: string;
  amount: string;
  currency?: string;
  category?: ExpenseCategory;
  isBaby: boolean;
  title: string;
  note?: string | null;
  paidAt: Date;
  stopId: string | null;
  entryId: string | null;
  rate?: number;
}) {
  const trip = await db.trip.findUnique({ where: { id: input.tripId }, select: { homeCurrency: true } });
  if (!trip) return { error: "旅程不存在" } as const;
  const currency = input.currency && CURRENCIES.some((c) => c.code === input.currency) ? input.currency : trip.homeCurrency;
  const amountMinor = toMinor(input.amount, currency);
  if (amountMinor <= 0) return { error: "金额需要大于 0" } as const;
  const rate = input.rate ?? (await getRate(currency, trip.homeCurrency, input.paidAt));
  const amountHomeMinor = convertMinor(amountMinor, currency, trip.homeCurrency, rate);
  const cnyRate = currency === "CNY" ? 1 : await getRate(currency, "CNY", input.paidAt);
  const amountCnyMinor = convertMinor(amountMinor, currency, "CNY", cnyRate);
  return {
    data: {
      tripId: input.tripId,
      stopId: input.stopId,
      entryId: input.entryId,
      paidById: input.userId,
      amountMinor,
      currency,
      amountHomeMinor,
      amountCnyMinor,
      rate,
      category: input.isBaby ? ("BABY" as ExpenseCategory) : (input.category ?? "OTHER"),
      isBaby: input.isBaby,
      title: input.title,
      note: input.note ?? null,
      paidAt: input.paidAt,
    },
  } as const;
}

/** 汇率：DB 缓存 → 免费 API → 离线兜底 */
export async function getRate(from: string, to: string, at: Date): Promise<number> {
  if (from === to) return 1;
  const day = new Date(Date.UTC(at.getFullYear(), at.getMonth(), at.getDate()));
  const cached = await db.exchangeRate.findUnique({ where: { date_base_quote: { date: day, base: from, quote: to } } });
  if (cached) return cached.rate;
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const json = (await res.json()) as { rates: Record<string, number> };
      const rate = json.rates[to];
      if (rate) {
        await db.exchangeRate.upsert({
          where: { date_base_quote: { date: day, base: from, quote: to } },
          update: { rate },
          create: { date: day, base: from, quote: to, rate },
        });
        return rate;
      }
    }
  } catch {
    /* fall through */
  }
  const f = FALLBACK_RATES_TO_CNY[from];
  const t = FALLBACK_RATES_TO_CNY[to];
  return f && t ? f / t : 1;
}

export async function createExpense(tripId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { userId } = await requireTripAccess(tripId, "EDITOR");
  const parsed = expenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const r = await buildExpense({
    tripId,
    userId,
    amount: d.amount,
    currency: d.currency,
    category: d.category,
    isBaby: d.isBaby === "on" || d.isBaby === "true",
    title: d.title,
    note: d.note || null,
    paidAt: parseInTz(d.paidAt, await entryTz(tripId, d.stopId || null)),
    stopId: d.stopId || null,
    entryId: d.entryId || null,
    rate: d.rate ? parseFloat(d.rate) : undefined,
  });
  if ("error" in r) return { error: r.error };
  await db.expense.create({ data: r.data });
  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/ledger");
  return { ok: true };
}

export async function deleteExpense(tripId: string, expenseId: string) {
  await requireTripAccess(tripId, "EDITOR");
  await db.expense.delete({ where: { id: expenseId, tripId } });
  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/ledger");
}

// ───────────────────────── 照片 ─────────────────────────

export async function deletePhoto(tripId: string, photoId: string) {
  await requireTripAccess(tripId, "EDITOR");
  const photo = await db.photo.delete({ where: { id: photoId, tripId } });
  await deleteObject(photo.ossKey);
  revalidatePath(`/trips/${tripId}`);
}

export async function updatePhotoCaption(tripId: string, photoId: string, caption: string) {
  await requireTripAccess(tripId, "EDITOR");
  await db.photo.update({ where: { id: photoId, tripId }, data: { caption: caption.trim() || null } });
  revalidatePath(`/trips/${tripId}`);
}

// ───────────────────────── 宝宝状态 ─────────────────────────

const babyLogSchema = z.object({ type: z.nativeEnum(BabyLogType), at: z.string().min(1, "请选择时间"), note: optStr });

export async function createBabyLog(tripId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireTripAccess(tripId, "EDITOR");
  const parsed = babyLogSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.babyLog.create({ data: { tripId, type: parsed.data.type, at: parseInTz(parsed.data.at, await tripTz(tripId)), note: parsed.data.note || null } });
  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}

export async function deleteBabyLog(tripId: string, id: string) {
  await requireTripAccess(tripId, "EDITOR");
  await db.babyLog.delete({ where: { id, tripId } });
  revalidatePath(`/trips/${tripId}`);
}

// ───────────────────────── 日记 ─────────────────────────

export async function upsertDailyNote(tripId: string, date: string, content: string) {
  await requireTripAccess(tripId, "EDITOR");
  const day = new Date(date);
  await db.dailyNote.upsert({
    where: { tripId_date: { tripId, date: day } },
    update: { content },
    create: { tripId, date: day, content },
  });
  revalidatePath(`/trips/${tripId}`);
}
