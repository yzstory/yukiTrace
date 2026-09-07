import "server-only";
import { z } from "zod";
import { auditedDb } from "@/lib/activity";
import { assertTripAccess } from "@/lib/access";
import { badRequest } from "@/lib/api/errors";
import { BabyLogType } from "@/generated/prisma/enums";
import { parseInTz } from "@/lib/date";
import { deleteObject } from "@/lib/storage";
import { optStr, reqStr, type Input } from "./input";
import { parse, refreshTrip, scheduleReindex, tripTz, type Actor } from "./shared";

// ───────────────────────── 宝宝状态 ─────────────────────────

const babyLogSchema = z.object({ type: z.nativeEnum(BabyLogType), at: reqStr("请选择时间"), note: optStr });
export type BabyLogInput = z.input<typeof babyLogSchema>;

export async function createBabyLog(actor: Actor, tripId: string, input: Input) {
  await assertTripAccess(actor.userId, tripId, "EDITOR");
  const d = parse(babyLogSchema, input);
  const row = await auditedDb({ tripId, userId: actor.userId }).babyLog.create({
    data: { tripId, type: d.type, at: parseInTz(d.at, await tripTz(tripId)), note: d.note || null },
  });
  refreshTrip(tripId);
  scheduleReindex(tripId);
  return { id: row.id };
}

export async function deleteBabyLog(actor: Actor, tripId: string, id: string) {
  await assertTripAccess(actor.userId, tripId, "EDITOR");
  await auditedDb({ tripId, userId: actor.userId }).babyLog.delete({ where: { id, tripId } });
  refreshTrip(tripId);
}

// ───────────────────────── 日记 ─────────────────────────

export async function upsertDailyNote(actor: Actor, tripId: string, date: string, content: string) {
  await assertTripAccess(actor.userId, tripId, "EDITOR");
  const day = new Date(date);
  if (!Number.isFinite(day.getTime())) throw badRequest("日期格式不正确");
  if (content.length > 10000) throw badRequest("日记太长");
  await auditedDb({ tripId, userId: actor.userId }).dailyNote.upsert({
    where: { tripId_date: { tripId, date: day } },
    update: { content },
    create: { tripId, date: day, content },
  });
  refreshTrip(tripId);
  scheduleReindex(tripId);
}

// ───────────────────────── 照片 ─────────────────────────

export async function deletePhoto(actor: Actor, tripId: string, photoId: string) {
  await assertTripAccess(actor.userId, tripId, "EDITOR");
  const photo = await auditedDb({ tripId, userId: actor.userId }).photo.delete({ where: { id: photoId, tripId } });
  await deleteObject(photo.ossKey);
  refreshTrip(tripId);
}

export async function updatePhotoCaption(actor: Actor, tripId: string, photoId: string, caption: string) {
  await assertTripAccess(actor.userId, tripId, "EDITOR");
  if (caption.length > 500) throw badRequest("说明太长");
  await auditedDb({ tripId, userId: actor.userId }).photo.update({ where: { id: photoId, tripId }, data: { caption: caption.trim() || null } });
  refreshTrip(tripId);
}
