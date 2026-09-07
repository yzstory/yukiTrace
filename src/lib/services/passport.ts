import "server-only";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertTripAccess } from "@/lib/access";
import { notFound, tooMany } from "@/lib/api/errors";
import { passportFor, composeLine, type Passport } from "@/lib/passport";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import type { Actor } from "./shared";

export type { Passport };

export async function passport(actor: Actor): Promise<Passport> {
  return passportFor(actor.userId);
}

function refresh() {
  revalidatePath("/passport");
  revalidatePath("/me");
}
function gate(userId: string) {
  const g = rateLimit(`passport:${userId}`, LIMITS.aiChat.limit, LIMITS.aiChat.windowMs);
  if (!g.ok) throw tooMany("盖章太快了，歇一会儿");
}

async function inkOne(actor: Actor, city: string, book?: Passport) {
  const passport = book ?? (await passportFor(actor.userId));
  const stamp = passport.stamps.find((s) => s.city === city);
  if (!stamp) throw notFound("这座城市还没有站点记录");
  if (stamp.inkedAt) return { city, line: stamp.line ?? undefined, inked: false };
  await assertTripAccess(actor.userId, stamp.tripId, "EDITOR");

  const firsts = await db.photo.findMany({ where: { tripId: stamp.tripId, stop: { city }, firstMoment: { not: null } }, select: { firstMoment: true }, take: 3 });
  // 章按首访时间排序，只有排第一的才是「第一座城市」，同一天到两座城也只认一座
  const isFirstCity = passport.stamps[0]?.city === city;
  const { line, source } = await composeLine(stamp, { babyName: passport.babyName, isFirstCity, firsts: firsts.map((p) => p.firstMoment!) });
  await db.cityStamp.upsert({ where: { tripId_city: { tripId: stamp.tripId, city } }, create: { tripId: stamp.tripId, city, line, source }, update: {} });
  return { city, line, inked: true };
}

/** 盖一枚章 */
export async function inkStamp(actor: Actor, city: string) {
  gate(actor.userId);
  const r = await inkOne(actor, city);
  refresh();
  return r;
}

/** 把所有还没盖的章一次盖完，最多 12 枚（AI 逐个写文案） */
export async function inkAll(actor: Actor) {
  gate(actor.userId);
  const book = await passportFor(actor.userId);
  const pending = book.stamps.filter((s) => !s.inkedAt).slice(0, 12);
  let inked = 0;
  for (const s of pending) {
    try {
      if ((await inkOne(actor, s.city, book)).inked) inked++;
    } catch {
      /* 单枚失败不影响其余 */
    }
  }
  refresh();
  return { inked };
}
