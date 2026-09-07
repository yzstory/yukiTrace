import { NextResponse, type NextRequest } from "next/server";
import { requestUserId } from "@/lib/api/auth";
import { isApiError } from "@/lib/api/errors";
import { createStop } from "@/lib/services/stops";
import { createEntry } from "@/lib/services/entries";
import { createExpense } from "@/lib/services/expenses";
import { createBabyLog } from "@/lib/services/daily";
import { rateLimit, tooManyRequests, LIMITS } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

const HANDLERS = { stop: createStop, entry: createEntry, expense: createExpense, babyLog: createBabyLog } as const;
type Kind = keyof typeof HANDLERS;

/**
 * 离线队列回放。刻意复用与在线提交完全相同的服务层函数，
 * 因此校验、汇率折算、时区解析、路径计算的行为都一致。
 */
export async function POST(req: NextRequest) {
  const userId = await requestUserId(req);
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const limited = rateLimit(`sync:${userId}`, LIMITS.upload.limit, LIMITS.upload.windowMs);
  if (!limited.ok) return tooManyRequests(limited, "同步太频繁");

  const body = (await req.json().catch(() => null)) as { kind?: string; tripId?: string; fields?: Record<string, string>; clientId?: string } | null;
  if (!body?.kind || !body.tripId || !body.fields) return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });

  const handler = HANDLERS[body.kind as Kind];
  if (!handler) return NextResponse.json({ error: `不支持的操作 ${body.kind}` }, { status: 400 });

  try {
    await handler({ userId }, body.tripId, body.fields);
    log.info("sync.applied", { userId, kind: body.kind, tripId: body.tripId, clientId: body.clientId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isApiError(e)) {
      log.warn("sync.rejected", { userId, kind: body.kind, tripId: body.tripId, reason: e.message });
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    log.error("sync.failed", { userId, kind: body.kind, err: e });
    return NextResponse.json({ error: "同步失败，请稍后重试" }, { status: 500 });
  }
}
