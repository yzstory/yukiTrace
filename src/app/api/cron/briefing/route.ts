import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { pushToUser, pushConfigured } from "@/lib/push";
import { morningBriefing, eveningBriefing, babyReminder, activeTripsFor } from "@/lib/ai/briefing";
import { wallClock } from "@/lib/date";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * 由服务器 crontab 每小时调用一次：
 *   0 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3100/api/cron/briefing
 * 内部按每个旅程自己的时区判断「现在是不是早上 8 点 / 晚上 9 点」，避免跨时区推错时间。
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "未配置 CRON_SECRET" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!pushConfigured()) return NextResponse.json({ error: "推送未配置" }, { status: 503 });

  const now = new Date();
  const force = req.nextUrl.searchParams.get("force"); // morning | evening | baby，用于手动测试
  const users = await db.user.findMany({
    where: { pushSubs: { some: {} } },
    select: { id: true },
  });

  let sent = 0;
  for (const u of users) {
    const trips = await activeTripsFor(u.id, now);
    for (const trip of trips) {
      const local = wallClock(now, trip.timezone);
      const hour = local.getHours();

      try {
        if (force === "morning" || (!force && hour === 8)) {
          const b = await morningBriefing(trip.id, now);
          if (b) sent += (await pushToUser(u.id, { ...b, tag: `morning-${trip.id}` }, "briefing")).sent;
        }
        if (force === "evening" || (!force && hour === 21)) {
          const b = await eveningBriefing(trip.id, now);
          if (b) sent += (await pushToUser(u.id, { ...b, tag: `evening-${trip.id}` }, "briefing")).sent;
        }
        // 作息提醒白天每小时检查一次
        if (force === "baby" || (!force && hour >= 7 && hour <= 21)) {
          const b = await babyReminder(trip.id, now);
          if (b) sent += (await pushToUser(u.id, { ...b, tag: `baby-${trip.id}` }, "babyAlert")).sent;
        }
      } catch (err) {
        log.error("cron.briefing failed", { userId: u.id, tripId: trip.id, err });
      }
    }
  }

  log.info("cron.briefing done", { users: users.length, sent, force });
  return NextResponse.json({ ok: true, users: users.length, sent });
}
