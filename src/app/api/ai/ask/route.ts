import { NextResponse, type NextRequest } from "next/server";
import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { aiConfigured, chatModel } from "@/lib/ai/model";
import { globalTools, globalSystemPrompt } from "@/lib/ai/global-tools";
import { rateLimit, tooManyRequests, LIMITS } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

/** 跨旅程问答：不绑定单个 tripId */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!aiConfigured()) return NextResponse.json({ error: "AI 未配置" }, { status: 503 });

  const limited = rateLimit(`ai:ask:${session.userId}`, LIMITS.aiChat.limit, LIMITS.aiChat.windowMs);
  if (!limited.ok) return tooManyRequests(limited, "提问次数用得有点快");

  const { messages } = (await req.json()) as { messages: UIMessage[] };
  const user = await db.user.findUniqueOrThrow({ where: { id: session.userId }, select: { name: true } });

  const done = log.timer("ai.ask", { userId: session.userId });
  const result = streamText({
    model: chatModel(),
    system: globalSystemPrompt(new Date(), user.name),
    messages: await convertToModelMessages(messages.slice(-20)),
    tools: globalTools(session.userId),
    stopWhen: stepCountIs(6),
  });
  void (async () => {
    try {
      const usage = await result.totalUsage;
      done({ inputTokens: usage?.inputTokens, outputTokens: usage?.outputTokens });
    } catch {
      done({ usage: "unavailable" });
    }
  })();
  return result.toUIMessageStreamResponse();
}
