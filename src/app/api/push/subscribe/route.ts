import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { pushConfigured } from "@/lib/push";
import { log } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!pushConfigured()) return NextResponse.json({ error: "推送未配置" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null;
  if (!body?.endpoint || !body.keys?.p256dh || !body.keys.auth) return NextResponse.json({ error: "订阅信息不完整" }, { status: 400 });

  await db.pushSubscription.upsert({
    where: { endpoint: body.endpoint },
    update: { userId: session.userId, p256dh: body.keys.p256dh, auth: body.keys.auth, userAgent: req.headers.get("user-agent") ?? undefined },
    create: {
      userId: session.userId,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent: req.headers.get("user-agent") ?? undefined,
    },
  });
  log.info("push.subscribed", { userId: session.userId });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) return NextResponse.json({ error: "缺少 endpoint" }, { status: 400 });
  await db.pushSubscription.deleteMany({ where: { endpoint: body.endpoint, userId: session.userId } });
  return NextResponse.json({ ok: true });
}
