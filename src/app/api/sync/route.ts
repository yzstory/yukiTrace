import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { createStop, createEntry, createExpense, createBabyLog } from "@/app/(app)/trips/[tripId]/actions";
import { rateLimit, tooManyRequests, LIMITS } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

const HANDLERS = { stop: createStop, entry: createEntry, expense: createExpense, babyLog: createBabyLog } as const;
type Kind = keyof typeof HANDLERS;

/**
 * 离线队列回放。刻意复用与在线提交完全相同的 Server Action，
 * 因此校验、汇率折算、时区解析、路径计算的行为都一致。
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const limited = rateLimit(`sync:${session.userId}`, LIMITS.upload.limit, LIMITS.upload.windowMs);
  if (!limited.ok) return tooManyRequests(limited, "同步太频繁");

  const body = (await req.json().catch(() => null)) as { kind?: string; tripId?: string; fields?: Record<string, string>; clientId?: string } | null;
  if (!body?.kind || !body.tripId || !body.fields) return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });

  const handler = HANDLERS[body.kind as Kind];
  if (!handler) return NextResponse.json({ error: `不支持的操作 ${body.kind}` }, { status: 400 });

  const fd = new FormData();
  for (const [k, v] of Object.entries(body.fields)) fd.set(k, String(v));

  try {
    const r = await handler(body.tripId, undefined, fd);
    if (r?.error) {
      log.warn("sync.rejected", { userId: session.userId, kind: body.kind, tripId: body.tripId, reason: r.error });
      return NextResponse.json({ error: r.error }, { status: 422 });
    }
    log.info("sync.applied", { userId: session.userId, kind: body.kind, tripId: body.tripId, clientId: body.clientId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    log.error("sync.failed", { userId: session.userId, kind: body.kind, err: e });
    return NextResponse.json({ error: "同步失败，请稍后重试" }, { status: 500 });
  }
}
