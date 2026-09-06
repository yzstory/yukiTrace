"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { verifySession, requireTripAccess } from "@/lib/dal";
import { passportFor, composeLine } from "@/lib/passport";
import { rateLimit, LIMITS } from "@/lib/rate-limit";

export type InkResult = { error?: string; line?: string; city?: string };

async function inkOne(userId: string, city: string): Promise<InkResult> {
  const passport = await passportFor(userId);
  const stamp = passport.stamps.find((s) => s.city === city);
  if (!stamp) return { error: "这座城市还没有站点记录" };
  if (stamp.inkedAt) return { city, line: stamp.line ?? undefined };
  await requireTripAccess(stamp.tripId, "EDITOR");

  const firsts = await db.photo.findMany({ where: { tripId: stamp.tripId, stop: { city }, firstMoment: { not: null } }, select: { firstMoment: true }, take: 3 });
  // 章按首访时间排序，只有排第一的才是「第一座城市」，同一天到两座城也只认一座
  const isFirstCity = passport.stamps[0]?.city === city;
  const { line, source } = await composeLine(stamp, { babyName: passport.babyName, isFirstCity, firsts: firsts.map((p) => p.firstMoment!) });
  await db.cityStamp.upsert({ where: { tripId_city: { tripId: stamp.tripId, city } }, create: { tripId: stamp.tripId, city, line, source }, update: {} });
  return { city, line };
}

/** 盖一枚章 */
export async function inkStamp(city: string): Promise<InkResult> {
  const { userId } = await verifySession();
  const gate = rateLimit(`passport:${userId}`, LIMITS.aiChat.limit, LIMITS.aiChat.windowMs);
  if (!gate.ok) return { error: "盖章太快了，歇一会儿" };
  const r = await inkOne(userId, city);
  revalidatePath("/passport");
  revalidatePath("/me");
  return r;
}

/** 把所有还没盖的章一次盖完，最多 12 枚（AI 逐个写文案） */
export async function inkAll(): Promise<{ error?: string; inked: number }> {
  const { userId } = await verifySession();
  const gate = rateLimit(`passport:${userId}`, LIMITS.aiChat.limit, LIMITS.aiChat.windowMs);
  if (!gate.ok) return { error: "盖章太快了，歇一会儿", inked: 0 };
  const passport = await passportFor(userId);
  const pending = passport.stamps.filter((s) => !s.inkedAt).slice(0, 12);
  let inked = 0;
  for (const s of pending) {
    const r = await inkOne(userId, s.city);
    if (!r.error) inked++;
  }
  revalidatePath("/passport");
  revalidatePath("/me");
  return { inked };
}
