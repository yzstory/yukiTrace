"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireTripAccess } from "@/lib/dal";
import { ENTITIES, snapshot, type Entity, type Snapshot } from "@/lib/activity-data";
import { delegate } from "@/lib/activity";
import { changeRecord, undoActivity, versionOf, checkAccess } from "@/lib/record-service";
import { RECORD_FIELDS } from "@/lib/record-fields";
import { CURRENCIES, fromMinor, toMinor, convertMinor } from "@/lib/currency";
import { fmt, parseInTz } from "@/lib/date";
import { getRate } from "./actions";

function entityOf(value: string): Entity {
  if (!ENTITIES.includes(value as Entity)) throw new Error("不支持的记录类型");
  return value as Entity;
}
function refreshTrip(tripId: string) {
  revalidatePath(`/trips/${tripId}`, "layout");
  revalidatePath("/trips");
  revalidatePath("/ledger");
}
function message(error: unknown) {
  if (error && typeof error === "object" && "code" in error && error.code === "P2034") return "记录刚刚发生变化，请刷新后重试";
  return error instanceof Error && !error.message.includes("prisma") ? error.message : "操作失败，请刷新后重试";
}
export async function loadRecord(tripId: string, kind: string, refId: string) {
  const { userId, role } = await requireTripAccess(tripId);
  const entity = entityOf(kind);
  const [raw, trip, history] = await Promise.all([
    delegate(db, entity).findUnique({ where: { id: refId, tripId } }),
    db.trip.findUniqueOrThrow({ where: { id: tripId }, select: { timezone: true, stops: { orderBy: { arriveAt: "asc" }, select: { id: true, name: true, timezone: true } } } }),
    db.activity.findMany({ where: { tripId, entity, refId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20, include: { actor: { select: { name: true } } } }),
  ]);
  const record = snapshot(raw);
  const timezone = entity === "stop" ? String(record?.timezone || trip.timezone) : trip.stops.find((stop) => stop.id === record?.stopId)?.timezone || trip.timezone;
  const values: Record<string, string> = {};
  if (record) for (const field of RECORD_FIELDS[entity]) {
    const value = record[field.key];
    values[field.key] = field.key === "amount" ? String(fromMinor(Number(record.amountMinor), String(record.currency))) : field.type === "datetime-local" && value ? fmt.inputDateTime(new Date(String(value)), timezone) : value == null ? "" : String(value);
  }
  return { record, version: raw ? versionOf(raw) : "", values, timezone, stops: trip.stops.map(({ id, name }) => ({ id, name })), canEdit: role !== "VIEWER", userId, isOwner: role === "OWNER", history: history.map((event) => ({ ...event, before: snapshot(event.before), after: snapshot(event.after), createdAt: event.createdAt.toISOString(), reviewedAt: event.reviewedAt?.toISOString() ?? null, undoneAt: event.undoneAt?.toISOString() ?? null })) };
}
export async function editRecord(tripId: string, kind: string, refId: string, version: string, values: Record<string, string>) {
  const { userId } = await requireTripAccess(tripId, "EDITOR");
  try {
    const entity = entityOf(kind);
    const current = await loadRecord(tripId, entity, refId);
    if (!current.record || current.version !== version) return { error: "记录已改变，请刷新后再修改" };
    const data: Snapshot = {};
    for (const field of RECORD_FIELDS[entity]) {
      const value = String(values[field.key] ?? "").trim();
      if (field.required && !value) throw new Error(`请填写${field.label}`);
      if (value.length > (field.type === "textarea" ? 10000 : 200)) throw new Error(`${field.label}过长`);
      if (field.key === "amount") continue;
      if (field.type === "datetime-local") {
        if (!value) { data[field.key] = null; continue; }
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("时间格式不正确");
        const date = parseInTz(value, current.timezone);
        if (!Number.isFinite(date.getTime())) throw new Error("时间不正确");
        data[field.key] = date;
      } else if (field.type === "number") {
        const number = Number(value);
        const bound = field.key === "lat" ? 90 : 180;
        if (!Number.isFinite(number) || Math.abs(number) > bound) throw new Error("坐标超出范围");
        data[field.key] = number;
      } else data[field.key] = value || null;
    }
    if (data.endAt && data.startAt && Number(data.endAt) < Number(data.startAt)) throw new Error("结束时间不能早于开始时间");
    if (data.leaveAt && data.arriveAt && Number(data.leaveAt) < Number(data.arriveAt)) throw new Error("离开时间不能早于到达时间");
    if (entity === "expense") {
      const currency = String(data.currency);
      if (!CURRENCIES.some((item) => item.code === currency)) throw new Error("币种不支持");
      const number = Number(values.amount);
      const amountMinor = toMinor(number, currency);
      if (!Number.isFinite(number) || !Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > 2147483647) throw new Error("金额超出范围");
      const trip = await db.trip.findUniqueOrThrow({ where: { id: tripId }, select: { homeCurrency: true } });
      const rate = await getRate(currency, trip.homeCurrency, data.paidAt as Date);
      Object.assign(data, { amountMinor, rate, amountHomeMinor: convertMinor(amountMinor, currency, trip.homeCurrency, rate), amountCnyMinor: convertMinor(amountMinor, currency, "CNY", await getRate(currency, "CNY", data.paidAt as Date)) });
    }
    if (entity === "photo" && data.caption && ["pending", "failed"].includes(String(current.record.aiStatus))) data.aiStatus = "skipped";
    await changeRecord({ tripId, userId, source: "organize" }, entity, refId, version, data);
    refreshTrip(tripId);
    return { ok: true };
  } catch (error) { return { error: message(error) }; }
}
export async function removeRecord(tripId: string, kind: string, refId: string, version: string) {
  const { userId } = await requireTripAccess(tripId, "EDITOR");
  try {
    await changeRecord({ tripId, userId, source: "organize" }, entityOf(kind), refId, version, null);
    refreshTrip(tripId);
    return { ok: true };
  } catch (error) { return { error: message(error) }; }
}
export async function undoRecord(tripId: string, id: string) {
  const { userId } = await requireTripAccess(tripId, "EDITOR");
  try {
    await undoActivity({ tripId, userId }, id);
    refreshTrip(tripId);
    return { ok: true };
  } catch (error) { return { error: message(error) }; }
}
export async function confirmRecord(tripId: string, kind: string, refId: string, version: string) {
  const { userId } = await requireTripAccess(tripId, "EDITOR");
  try {
    const entity = entityOf(kind);
    await db.$transaction(async (tx) => {
      await checkAccess(tx, { tripId, userId });
      const record = await delegate(tx, entity).findUnique({ where: { id: refId, tripId } });
      if (!record || versionOf(record) !== version) throw new Error("记录已改变，请刷新后确认");
      await tx.activity.updateMany({ where: { tripId, entity, refId, source: "ai", reviewedAt: null }, data: { reviewedAt: new Date() } });
      await tx.activity.create({ data: { tripId, actorId: userId, source: "organize", entity, refId, action: "confirm", after: { title: "已核对记录" } } });
    }, { isolationLevel: "Serializable" });
    refreshTrip(tripId);
    return { ok: true };
  } catch (error) { return { error: message(error) }; }
}
