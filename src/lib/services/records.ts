import "server-only";
import { db } from "@/lib/db";
import { assertTripAccess } from "@/lib/access";
import { badRequest, conflict, notFound } from "@/lib/api/errors";
import { ENTITIES, snapshot, type Entity, type Snapshot } from "@/lib/activity-data";
import { delegate } from "@/lib/activity";
import { changeRecord, undoActivity, versionOf, checkAccess } from "@/lib/record-service";
import { RECORD_FIELDS } from "@/lib/record-fields";
import { CURRENCIES, fromMinor, toMinor, convertMinor } from "@/lib/currency";
import { fmt, parseInTz } from "@/lib/date";
import { getRate } from "./expenses";
import { refreshTrip, type Actor } from "./shared";

export function entityOf(value: string): Entity {
  if (!ENTITIES.includes(value as Entity)) throw badRequest("不支持的记录类型");
  return value as Entity;
}

/** 记录服务抛出的普通 Error 翻译成给人看的话；Prisma 序列化冲突单独处理 */
function translate(error: unknown): never {
  if (error && typeof error === "object" && "code" in error && error.code === "P2034") throw conflict("记录刚刚发生变化，请刷新后重试");
  if (error instanceof Error && !error.message.includes("prisma")) throw badRequest(error.message);
  throw error;
}

/** 单条记录 + 表单值 + 操作历史；给编辑面板和 API 共用 */
export async function loadRecord(actor: Actor, tripId: string, kind: string, refId: string) {
  const role = await assertTripAccess(actor.userId, tripId);
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
  return {
    record, version: raw ? versionOf(raw) : "", values, timezone,
    stops: trip.stops.map(({ id, name }) => ({ id, name })),
    canEdit: role !== "VIEWER", userId: actor.userId, isOwner: role === "OWNER",
    history: history.map((event) => ({ ...event, before: snapshot(event.before), after: snapshot(event.after), createdAt: event.createdAt.toISOString(), reviewedAt: event.reviewedAt?.toISOString() ?? null, undoneAt: event.undoneAt?.toISOString() ?? null })),
  };
}

/** 按字段表校验后写入；version 不一致视为冲突 */
export async function editRecord(actor: Actor, tripId: string, kind: string, refId: string, version: string, values: Record<string, string>) {
  await assertTripAccess(actor.userId, tripId, "EDITOR");
  const entity = entityOf(kind);
  const current = await loadRecord(actor, tripId, entity, refId);
  if (!current.record) throw notFound("记录已被删除");
  if (current.version !== version) throw conflict("记录已改变，请刷新后再修改");
  const data: Snapshot = {};
  for (const field of RECORD_FIELDS[entity]) {
    const value = String(values[field.key] ?? "").trim();
    if (field.required && !value) throw badRequest(`请填写${field.label}`);
    if (value.length > (field.type === "textarea" ? 10000 : 200)) throw badRequest(`${field.label}过长`);
    if (field.key === "amount") continue;
    if (field.type === "datetime-local") {
      if (!value) { data[field.key] = null; continue; }
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw badRequest("时间格式不正确");
      const date = parseInTz(value, current.timezone);
      if (!Number.isFinite(date.getTime())) throw badRequest("时间不正确");
      data[field.key] = date;
    } else if (field.type === "number") {
      const number = Number(value);
      const bound = field.key === "lat" ? 90 : 180;
      if (!Number.isFinite(number) || Math.abs(number) > bound) throw badRequest("坐标超出范围");
      data[field.key] = number;
    } else data[field.key] = value || null;
  }
  if (data.endAt && data.startAt && Number(data.endAt) < Number(data.startAt)) throw badRequest("结束时间不能早于开始时间");
  if (data.leaveAt && data.arriveAt && Number(data.leaveAt) < Number(data.arriveAt)) throw badRequest("离开时间不能早于到达时间");
  if (entity === "expense") {
    const currency = String(data.currency);
    if (!CURRENCIES.some((item) => item.code === currency)) throw badRequest("币种不支持");
    const number = Number(values.amount);
    const amountMinor = toMinor(number, currency);
    if (!Number.isFinite(number) || !Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > 2147483647) throw badRequest("金额超出范围");
    const trip = await db.trip.findUniqueOrThrow({ where: { id: tripId }, select: { homeCurrency: true } });
    const rate = await getRate(currency, trip.homeCurrency, data.paidAt as Date);
    Object.assign(data, { amountMinor, rate, amountHomeMinor: convertMinor(amountMinor, currency, trip.homeCurrency, rate), amountCnyMinor: convertMinor(amountMinor, currency, "CNY", await getRate(currency, "CNY", data.paidAt as Date)) });
  }
  if (entity === "photo" && data.caption && ["pending", "failed"].includes(String(current.record.aiStatus))) data.aiStatus = "skipped";
  try {
    await changeRecord({ tripId, userId: actor.userId, source: "organize" }, entity, refId, version, data);
  } catch (e) {
    translate(e);
  }
  refreshTrip(tripId);
}

export async function removeRecord(actor: Actor, tripId: string, kind: string, refId: string, version: string) {
  await assertTripAccess(actor.userId, tripId, "EDITOR");
  try {
    await changeRecord({ tripId, userId: actor.userId, source: "organize" }, entityOf(kind), refId, version, null);
  } catch (e) {
    translate(e);
  }
  refreshTrip(tripId);
}

export async function undoRecord(actor: Actor, tripId: string, activityId: string) {
  await assertTripAccess(actor.userId, tripId, "EDITOR");
  try {
    await undoActivity({ tripId, userId: actor.userId }, activityId);
  } catch (e) {
    translate(e);
  }
  refreshTrip(tripId);
}

export async function confirmRecord(actor: Actor, tripId: string, kind: string, refId: string, version: string) {
  await assertTripAccess(actor.userId, tripId, "EDITOR");
  const entity = entityOf(kind);
  try {
    await db.$transaction(async (tx) => {
      await checkAccess(tx, { tripId, userId: actor.userId });
      const record = await delegate(tx, entity).findUnique({ where: { id: refId, tripId } });
      if (!record || versionOf(record) !== version) throw new Error("记录已改变，请刷新后确认");
      await tx.activity.updateMany({ where: { tripId, entity, refId, source: "ai", reviewedAt: null }, data: { reviewedAt: new Date() } });
      await tx.activity.create({ data: { tripId, actorId: actor.userId, source: "organize", entity, refId, action: "confirm", after: { title: "已核对记录" } } });
    }, { isolationLevel: "Serializable" });
  } catch (e) {
    translate(e);
  }
  refreshTrip(tripId);
}
