"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireTripAccess } from "@/lib/dal";
import { duplicateExpenses } from "@/lib/organize";
import { analyzePhoto } from "@/lib/ai/photo";
import { aiConfigured } from "@/lib/ai/model";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { checkAccess } from "@/lib/record-service";

export async function keepDuplicates(tripId: string, fingerprint: string) {
  const { userId } = await requireTripAccess(tripId, "EDITOR");
  return db.$transaction(async (tx) => {
    await checkAccess(tx, { tripId, userId });
    const trip = await tx.trip.findUniqueOrThrow({ where: { id: tripId }, select: { timezone: true, expenses: true } });
    const group = duplicateExpenses(trip.expenses, trip.timezone).find((item) => item.fingerprint === fingerprint);
    if (!group) return { error: "账单已变化，请刷新后核对" };
    await tx.activity.create({ data: { tripId, actorId: userId, source: "organize", action: "keepDuplicates", entity: "expense", refId: group.items[0].id, after: { fingerprint, title: "确认相似账单为不同消费，全部保留" } } });
    revalidatePath(`/trips/${tripId}/organize`);
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
  revalidatePath(`/trips/${tripId}/organize`);
  return result ? { ok: true } : { error: "暂时无法识别，可手动填写照片说明" };
}
