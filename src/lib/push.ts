import "server-only";
import webpush from "web-push";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";

export function pushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function ensureVapid() {
  if (!pushConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:noreply@example.com",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  return true;
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

/** 给某个用户的所有设备推送；订阅失效（410/404）自动清理 */
export async function pushToUser(userId: string, payload: PushPayload, channel: "briefing" | "babyAlert" = "briefing") {
  if (!ensureVapid()) return { sent: 0, removed: 0 };
  const subs = await db.pushSubscription.findMany({ where: { userId, ...(channel === "briefing" ? { briefing: true } : { babyAlert: true }) } });

  let sent = 0;
  let removed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload)
        );
        sent++;
        await db.pushSubscription.update({ where: { id: s.id }, data: { lastSentAt: new Date() } });
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
          removed++;
        } else {
          log.warn("push failed", { userId, status, err: e });
        }
      }
    })
  );
  return { sent, removed };
}
