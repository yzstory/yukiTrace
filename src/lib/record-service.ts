import "server-only";
import { createHash } from "node:crypto";
import { db } from "./db";
import { delegate, assertReferences, writeActivity, type AuditContext } from "./activity";
import { snapshot, sameSnapshot, type Entity, type Snapshot } from "./activity-data";
import { Prisma } from "@/generated/prisma/client";

export const versionOf = (record: unknown) => createHash("sha256").update(JSON.stringify(snapshot(record))).digest("hex");

async function noDependents(tx: Prisma.TransactionClient, tripId: string, entity: Entity, refId: string, record: Snapshot) {
  if (entity === "stop" || entity === "entry") {
    const where = entity === "stop" ? { stopId: refId } : { entryId: refId };
    const [photos, expenses, entries] = await Promise.all([tx.photo.count({ where }), tx.expense.count({ where }), entity === "stop" ? tx.entry.count({ where: { stopId: refId } }) : 0]);
    if (photos + expenses + entries > 0) throw new Error("这条记录已有照片或花费等关联，请先处理关联记录，再撤销或删除");
  }
  if (entity === "photo" && await tx.trip.count({ where: { id: tripId, coverKey: String(record.ossKey) } })) throw new Error("照片正在用作封面，请先更换封面");
}
async function checkAccess(tx: Prisma.TransactionClient, context: AuditContext) {
  const trip = await tx.trip.findFirst({ where: { id: context.tripId, OR: [{ ownerId: context.userId }, { members: { some: { userId: context.userId, role: { in: ["EDITOR", "OWNER"] } } } }] }, select: { ownerId: true } });
  if (!trip) throw new Error("没有编辑权限");
  return trip;
}
export async function changeRecord(context: AuditContext, entity: Entity, refId: string, version: string, data: Snapshot | null) {
  return db.$transaction(async (tx) => {
    await checkAccess(tx, context);
    const table = delegate(tx, entity);
    const before = await table.findUnique({ where: { id: refId, tripId: context.tripId } });
    if (!before) throw new Error("记录已被删除");
    if (versionOf(before) !== version) throw new Error("家人或 AI 已更新这条记录，请刷新后再修改");
    let after: Snapshot | null = null;
    if (data) {
      await assertReferences(tx, context.tripId, data);
      after = await table.update({ where: { id: refId, tripId: context.tripId }, data });
    } else {
      await noDependents(tx, context.tripId, entity, refId, before);
      await table.delete({ where: { id: refId, tripId: context.tripId } });
    }
    await writeActivity(tx, context, entity, before, after);
    await tx.activity.updateMany({ where: { tripId: context.tripId, entity, refId, source: "ai", reviewedAt: null }, data: { reviewedAt: new Date() } });
    await tx.embedding.deleteMany({ where: { tripId: context.tripId, refId } });
    if (entity === "stop") await tx.stopLeg.deleteMany({ where: { OR: [{ fromStopId: refId }, { toStopId: refId }] } });
    return after;
  }, { isolationLevel: "Serializable" });
}
export async function undoActivity(context: AuditContext, id: string) {
  return db.$transaction(async (tx) => {
    const trip = await checkAccess(tx, context);
    const event = await tx.activity.findFirst({ where: { id, tripId: context.tripId, source: "ai" } });
    if (!event || !["create", "update"].includes(event.action)) throw new Error("这条操作不能撤销");
    if (event.actorId !== context.userId && trip.ownerId !== context.userId) throw new Error("只能撤销自己发起的 AI 操作，旅程所有者也可撤销");
    if (event.undoneAt) return;
    const entity = event.entity as Entity;
    const table = delegate(tx, entity);
    const current = await table.findUnique({ where: { id: event.refId, tripId: context.tripId } });
    if (!current || !sameSnapshot(current, event.after)) throw new Error("记录已被修改或删除，无法撤销原操作；请查看最新记录");
    let restored: Snapshot | null = null;
    if (event.action === "create") {
      await noDependents(tx, context.tripId, entity, event.refId, current);
      await table.delete({ where: { id: event.refId, tripId: context.tripId } });
    } else {
      const data = { ...snapshot(event.before)! };
      for (const key of ["id", "tripId", "createdAt", "updatedAt"]) delete data[key];
      for (const key of ["arriveAt", "leaveAt", "startAt", "endAt", "paidAt", "takenAt", "at", "date"]) if (data[key]) data[key] = new Date(String(data[key]));
      for (const key of ["meta", "weather"]) if (key in data && data[key] === null) data[key] = Prisma.DbNull;
      await assertReferences(tx, context.tripId, data);
      restored = await table.update({ where: { id: event.refId, tripId: context.tripId }, data });
    }
    await writeActivity(tx, { ...context, source: "manual" }, entity, current, restored, "undo");
    await tx.activity.update({ where: { id }, data: { undoneAt: new Date(), reviewedAt: new Date() } });
    await tx.embedding.deleteMany({ where: { tripId: context.tripId, refId: event.refId } });
    if (entity === "stop") await tx.stopLeg.deleteMany({ where: { OR: [{ fromStopId: event.refId }, { toStopId: event.refId }] } });
  }, { isolationLevel: "Serializable" });
}
