"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireTripAccess } from "@/lib/dal";
import { duplicateExpenses } from "@/lib/organize";
import { analyzePhoto } from "@/lib/ai/photo";
import { aiConfigured } from "@/lib/ai/model";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { checkAccess } from "@/lib/record-service";
import { auditedDb } from "@/lib/activity";
import { stopForTime } from "@/lib/tidy";

export async function keepDuplicates(tripId: string, fingerprint: string) {
  const { userId } = await requireTripAccess(tripId, "EDITOR");
  return db.$transaction(async (tx) => {
    await checkAccess(tx, { tripId, userId });
    const trip = await tx.trip.findUniqueOrThrow({ where: { id: tripId }, select: { timezone: true, expenses: true } });
    const group = duplicateExpenses(trip.expenses, trip.timezone).find((item) => item.fingerprint === fingerprint);
    if (!group) return { error: "账单已变化，请刷新后核对" };
    await tx.activity.create({ data: { tripId, actorId: userId, source: "organize", action: "keepDuplicates", entity: "expense", refId: group.items[0].id, after: { fingerprint, title: "确认相似账单为不同消费，全部保留" } } });
    revalidatePath(`/trips/${tripId}`);
    return { ok: true };
  }, { isolationLevel: "Serializable" });
}
export async function retryPhotoAnalysis(tripId: string, photoId: string) {
  const { userId } = await requireTripAccess(tripId, "EDITOR");
  if (!aiConfigured()) return { error: "当前未启用照片识别" };
  const gate = rateLimit(`photo-retry:${tripId}`, LIMITS.aiReceipt.limit, LIMITS.aiReceipt.windowMs);
  if (!gate.ok) return { error: "识别次数较多，请稍后重试" };
  const photo = await db.photo.findFirst({ where: { id: photoId, tripId }, select: { id: true, aiStatus: true } });
  if (!photo) return { error: "照片不存在" };
  if (photo.aiStatus === "done") return { ok: true };
  const result = await analyzePhoto(photoId, userId);
  revalidatePath(`/trips/${tripId}`);
  return result ? { ok: true } : { error: "暂时无法识别，可手动填写照片说明" };
}

const CROSS_STOP_ENTRY = new Set(["FLIGHT", "CAR_RENTAL", "TRAIN", "TAXI"]);
const MAX_PHOTO_RETRY = 5;

/**
 * 一键整理：把能自动判断的做掉，剩下的留给人。
 * - 没关联地点的条目 / 花费 / 无 GPS 照片，按时间归到当时所在的站点（写入操作历史，可撤销可改）；
 * - 识别失败或未识别的照片，重试最多 5 张（受 AI 频率限制）。
 */
export async function autoTidy(tripId: string): Promise<{ error?: string; linked?: number; analyzed?: number }> {
  const { userId } = await requireTripAccess(tripId, "EDITOR");
  const trip = await db.trip.findUniqueOrThrow({
    where: { id: tripId },
    include: {
      stops: { orderBy: { arriveAt: "asc" }, select: { id: true, arriveAt: true, leaveAt: true } },
      entries: { where: { stopId: null }, select: { id: true, type: true, startAt: true } },
      expenses: { where: { stopId: null }, select: { id: true, paidAt: true, entryId: true } },
      photos: { where: { stopId: null }, select: { id: true, takenAt: true, lat: true, aiStatus: true } },
    },
  });
  if (trip.stops.length === 0) return { error: "还没有站点，先加一站再整理" };
  const audited = auditedDb({ tripId, userId, source: "organize" });
  let linked = 0;

  for (const e of trip.entries) {
    if (CROSS_STOP_ENTRY.has(e.type)) continue;
    const stopId = stopForTime(trip.stops, e.startAt);
    if (!stopId) continue;
    await audited.entry.update({ where: { id: e.id }, data: { stopId } });
    linked++;
  }
  for (const x of trip.expenses) {
    if (x.entryId) continue; // 挂在条目上的花费跟条目走
    const stopId = stopForTime(trip.stops, x.paidAt);
    if (!stopId) continue;
    await audited.expense.update({ where: { id: x.id }, data: { stopId } });
    linked++;
  }
  for (const p of trip.photos) {
    if (p.lat != null || !p.takenAt) continue; // 有 GPS 却没匹配上，说明确实不在任何站点附近
    const stopId = stopForTime(trip.stops, p.takenAt);
    if (!stopId) continue;
    await audited.photo.update({ where: { id: p.id }, data: { stopId } });
    linked++;
  }

  let analyzed = 0;
  if (aiConfigured()) {
    const retry = await db.photo.findMany({ where: { tripId, aiStatus: { in: ["pending", "failed"] } }, select: { id: true }, take: MAX_PHOTO_RETRY });
    for (const p of retry) {
      const gate = rateLimit(`photo-retry:${tripId}`, LIMITS.aiReceipt.limit, LIMITS.aiReceipt.windowMs);
      if (!gate.ok) break;
      if (await analyzePhoto(p.id, userId)) analyzed++;
    }
  }

  revalidatePath(`/trips/${tripId}`);
  return { linked, analyzed };
}
