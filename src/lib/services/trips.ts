import "server-only";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertTripAccess, visibleTrips } from "@/lib/access";
import { badRequest, notFound } from "@/lib/api/errors";
import { CURRENCIES } from "@/lib/currency";
import { TIMEZONES } from "@/lib/date";
import { imageUrl } from "@/lib/storage";
import { optStr, reqStr, strList, type Input } from "./input";
import { parse, type Actor } from "./shared";
import type { TEntry, TExpense, TPhoto, TStop } from "@/components/timeline/types";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const tripSchema = z.object({
  title: reqStr("请填写旅程名称", 60),
  description: optStr.pipe(z.string().max(500)),
  startDate: optStr.pipe(z.string().regex(DATE, "请选择开始日期")),
  endDate: optStr.pipe(z.string().regex(DATE, "请选择结束日期")),
  homeCurrency: optStr.refine((c) => CURRENCIES.some((x) => x.code === c), "货币不支持"),
  timezone: z.preprocess((v) => (v == null || v === "" ? "Asia/Shanghai" : String(v)), z.string().refine((t) => TIMEZONES.some((x) => x.value === t), "时区不支持")),
  babyName: optStr.pipe(z.string().max(30)),
  babyBirthDate: optStr.refine((v) => !v || DATE.test(v), "宝宝生日格式不正确"),
  travelers: strList.default([]),
});
export type TripInput = z.input<typeof tripSchema>;

function toTripData(input: Input) {
  const d = parse(tripSchema, input);
  if (d.endDate < d.startDate) throw badRequest("结束日期不能早于开始日期");
  return {
    title: d.title,
    description: d.description || null,
    startDate: new Date(d.startDate),
    endDate: new Date(d.endDate),
    homeCurrency: d.homeCurrency,
    timezone: d.timezone,
    babyName: d.babyName || null,
    babyBirthDate: d.babyBirthDate ? new Date(d.babyBirthDate) : null,
    travelers: d.travelers,
  };
}

// ───────────────────────── 读 ─────────────────────────

export type TripSummary = {
  id: string; title: string; description: string | null; coverUrl: string | null;
  startDate: Date; endDate: Date; homeCurrency: string; timezone: string;
  babyName: string | null; babyBirthDate: Date | null; travelers: string[];
  stopCount: number; photoCount: number; totalHomeMinor: number; cities: string[]; role: "OWNER" | "EDITOR" | "VIEWER";
};

const listSchema = z.object({
  /** 不传表示不分页，返回全部（网页与老客户端的行为） */
  limit: z.preprocess((v) => (v == null || v === "" ? undefined : v), z.coerce.number().int().min(1, "limit 需要在 1-100 之间").max(100, "limit 需要在 1-100 之间").optional()),
  cursor: optStr,
});

/** 用户可见的旅程列表（拥有的 + 受邀的），按开始日期倒序；`limit` 时用 `nextCursor` 翻页 */
export async function listTrips(actor: Actor, input: Input = {}): Promise<{ trips: TripSummary[]; nextCursor: string | null }> {
  const { limit, cursor } = parse(listSchema, input);
  if (cursor && !(await db.trip.findFirst({ where: { AND: [visibleTrips(actor.userId), { id: cursor }] }, select: { id: true } }))) throw badRequest("cursor 无效");
  const rows = await db.trip.findMany({
    where: visibleTrips(actor.userId),
    // id 兜底排序，保证同一天开始的旅程在翻页时顺序稳定
    orderBy: [{ startDate: "desc" }, { id: "desc" }],
    ...(limit ? { take: limit + 1 } : {}),
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      _count: { select: { stops: true, photos: true } },
      stops: { select: { city: true }, distinct: ["city"], where: { city: { not: null } }, take: 4 },
      members: { where: { userId: actor.userId }, select: { role: true } },
    },
  });
  const trips = limit ? rows.slice(0, limit) : rows;
  const nextCursor = limit && rows.length > limit ? trips[trips.length - 1].id : null;
  // 总花费用聚合算，不把每笔账都读进内存
  const sums = trips.length
    ? await db.expense.groupBy({ by: ["tripId"], where: { tripId: { in: trips.map((t) => t.id) } }, _sum: { amountHomeMinor: true } })
    : [];
  const totals = new Map(sums.map((s) => [s.tripId, s._sum.amountHomeMinor ?? 0]));
  return { nextCursor, trips: trips.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    coverUrl: t.coverKey ? imageUrl(t.coverKey, { w: 1200 }) : null,
    startDate: t.startDate,
    endDate: t.endDate,
    homeCurrency: t.homeCurrency,
    timezone: t.timezone,
    babyName: t.babyName,
    babyBirthDate: t.babyBirthDate,
    travelers: t.travelers,
    stopCount: t._count.stops,
    photoCount: t._count.photos,
    totalHomeMinor: totals.get(t.id) ?? 0,
    cities: t.stops.map((s) => s.city!).filter(Boolean),
    role: t.ownerId === actor.userId ? "OWNER" : (t.members[0]?.role ?? "VIEWER"),
  })) };
}

export type TripDetail = {
  trip: {
    id: string; title: string; description: string | null; coverUrl: string | null;
    startDate: Date; endDate: Date; homeCurrency: string; timezone: string;
    babyName: string | null; babyBirthDate: Date | null; travelers: string[];
    role: "OWNER" | "EDITOR" | "VIEWER"; memberCount: number;
  };
  stops: TStop[];
  looseEntries: TEntry[];
  looseExpenses: TExpense[];
  loosePhotos: TPhoto[];
  babyLogs: Array<{ id: string; type: string; at: Date; note: string | null }>;
  dailyNotes: Array<{ date: Date; content: string; aiDraft: string | null }>;
  totalHomeMinor: number;
  totalDistanceM: number;
};

/**
 * 旅程全量详情：站点树（条目 / 花费 / 照片挂在站点下）+ 游离记录 + 宝宝状态 + 日记。
 * `photos: false` 只跳过照片（地图页 / 账本页用不到），照片多的旅程能少传很多。
 */
export async function tripDetail(actor: Actor, tripId: string, opts: { photos?: boolean } = {}): Promise<TripDetail> {
  const role = await assertTripAccess(actor.userId, tripId);
  const withPhotos = opts.photos !== false;
  // 不要照片时用一个必然不匹配的条件跳过，include 结构与返回类型都保持不变
  const NONE = { id: "" };
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    include: {
      stops: {
        orderBy: [{ arriveAt: "asc" }, { order: "asc" }],
        include: {
          entries: { orderBy: { startAt: "asc" }, include: { expenses: true, photos: { where: withPhotos ? undefined : NONE, orderBy: { takenAt: "asc" } } } },
          expenses: { where: { entryId: null }, orderBy: { paidAt: "asc" } },
          photos: { where: withPhotos ? { entryId: null } : NONE, orderBy: { takenAt: "asc" } },
          legsTo: true,
        },
      },
      entries: { where: { stopId: null }, orderBy: { startAt: "asc" }, include: { expenses: true, photos: { where: withPhotos ? undefined : NONE } } },
      expenses: { where: { stopId: null, entryId: null }, orderBy: { paidAt: "asc" } },
      photos: { where: withPhotos ? { stopId: null, entryId: null } : NONE, orderBy: { takenAt: "asc" } },
      dailyNotes: { orderBy: { date: "asc" } },
      members: { select: { userId: true } },
      babyLogs: { orderBy: { at: "asc" } },
    },
  });
  if (!trip) throw notFound("旅程不存在");

  const toPhoto = (p: (typeof trip.photos)[number]): TPhoto => ({
    id: p.id, url: imageUrl(p.ossKey, { w: 1600 }), thumbUrl: imageUrl(p.ossKey, { w: 300 }),
    width: p.width, height: p.height, caption: p.caption, takenAt: p.takenAt,
  });
  const toExpense = (e: (typeof trip.expenses)[number]): TExpense => ({
    id: e.id, title: e.title, amountMinor: e.amountMinor, currency: e.currency, amountHomeMinor: e.amountHomeMinor,
    category: e.category, isBaby: e.isBaby, paidAt: e.paidAt,
  });
  const toEntry = (e: (typeof trip.entries)[number]): TEntry => ({
    id: e.id, type: e.type, title: e.title, note: e.note, startAt: e.startAt, endAt: e.endAt,
    meta: (e.meta as Record<string, unknown> | null) ?? null, expenses: e.expenses.map(toExpense), photos: e.photos.map(toPhoto),
  });
  const stops: TStop[] = trip.stops.map((s, i) => {
    const prev = trip.stops[i - 1];
    const legs = prev ? s.legsTo.filter((l) => l.fromStopId === prev.id) : [];
    const best = legs.find((l) => l.mode === "DRIVING") ?? legs.find((l) => l.mode === "WALKING") ?? legs.find((l) => l.mode === "STRAIGHT") ?? null;
    return {
      id: s.id, name: s.name, type: s.type, lat: s.lat, lng: s.lng, address: s.address, city: s.city,
      arriveAt: s.arriveAt, leaveAt: s.leaveAt, note: s.note, babyTags: s.babyTags, timezone: s.timezone,
      weather: (s.weather as TStop["weather"]) ?? null,
      entries: s.entries.map(toEntry), expenses: s.expenses.map(toExpense), photos: s.photos.map(toPhoto),
      legFromPrev: best ? { mode: best.mode, distanceM: best.distanceM, durationS: best.durationS } : null,
    };
  });
  const looseEntries = trip.entries.map(toEntry);
  const looseExpenses = trip.expenses.map(toExpense);
  const sum = (xs: TExpense[]) => xs.reduce((a, e) => a + e.amountHomeMinor, 0);
  const totalHomeMinor =
    stops.reduce((a, s) => a + sum(s.expenses) + s.entries.reduce((b, e) => b + sum(e.expenses), 0), 0) +
    looseEntries.reduce((a, e) => a + sum(e.expenses), 0) +
    sum(looseExpenses);

  return {
    trip: {
      id: trip.id, title: trip.title, description: trip.description,
      coverUrl: trip.coverKey ? imageUrl(trip.coverKey, { w: 1600 }) : null,
      startDate: trip.startDate, endDate: trip.endDate, homeCurrency: trip.homeCurrency, timezone: trip.timezone,
      babyName: trip.babyName, babyBirthDate: trip.babyBirthDate, travelers: trip.travelers, role, memberCount: trip.members.length,
    },
    stops,
    looseEntries,
    looseExpenses,
    loosePhotos: trip.photos.map(toPhoto),
    babyLogs: trip.babyLogs.map((b) => ({ id: b.id, type: b.type, at: b.at, note: b.note })),
    dailyNotes: trip.dailyNotes.map((d) => ({ date: d.date, content: d.content, aiDraft: d.aiDraft })),
    totalHomeMinor,
    totalDistanceM: stops.reduce((a, s) => a + (s.legFromPrev?.distanceM ?? 0), 0),
  };
}

// ───────────────────────── 写 ─────────────────────────

export async function createTrip(actor: Actor, input: Input) {
  const data = toTripData(input);
  const trip = await db.trip.create({ data: { ...data, ownerId: actor.userId, members: { create: { userId: actor.userId, role: "OWNER" } } } });
  revalidatePath("/trips");
  return { id: trip.id };
}

export async function updateTrip(actor: Actor, tripId: string, input: Input) {
  await assertTripAccess(actor.userId, tripId, "EDITOR");
  const data = toTripData(input);
  await db.trip.update({ where: { id: tripId }, data });
  revalidatePath("/trips");
  revalidatePath(`/trips/${tripId}`, "layout");
  return { id: tripId };
}

export async function deleteTrip(actor: Actor, tripId: string) {
  await assertTripAccess(actor.userId, tripId, "OWNER");
  await db.trip.delete({ where: { id: tripId } });
  revalidatePath("/trips");
}

export async function setTripCover(actor: Actor, tripId: string, coverKey: string | null) {
  await assertTripAccess(actor.userId, tripId, "EDITOR");
  await db.trip.update({ where: { id: tripId }, data: { coverKey } });
  revalidatePath("/trips");
  revalidatePath(`/trips/${tripId}`, "layout");
}
