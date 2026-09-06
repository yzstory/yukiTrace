import { NextResponse, type NextRequest } from "next/server";
import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { aiConfigured, chatModel, visionModel } from "@/lib/ai/model";
import { tripTools, systemPrompt, type Attachment } from "@/lib/ai/tools";
import { globalTools, globalSystemPrompt } from "@/lib/ai/global-tools";
import { babyAge } from "@/lib/date";
import { rateLimit, tooManyRequests, LIMITS } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 全站唯一的 AI 入口。
 * 带 tripId：当前旅程的读写工具 + 跨旅程只读工具；不带：只有跨旅程只读工具（回忆、比较、那年今日）。
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!aiConfigured()) return NextResponse.json({ error: "AI 未配置：请在 .env 设置 AI_BASE_URL / AI_API_KEY / AI_MODEL" }, { status: 503 });

  const limited = rateLimit(`ai:chat:${session.userId}`, LIMITS.aiChat.limit, LIMITS.aiChat.windowMs);
  if (!limited.ok) return tooManyRequests(limited, "AI 对话次数用得有点快");

  const { messages, tripId } = (await req.json()) as { messages: UIMessage[]; tripId?: string | null };
  const now = new Date();

  // 只保留最后一条用户消息里的图片作为「当前附件」；更早消息里的图片换成占位文字，避免每轮都把大图重发给模型
  const recent = messages.slice(-20);
  const lastUserIdx = recent.map((m) => m.role).lastIndexOf("user");
  const attachments: Attachment[] = [];
  const prepared = recent.map((m, idx) => {
    if (m.role !== "user") return m;
    const isLast = idx === lastUserIdx;
    const parts = m.parts.flatMap((p) => {
      if (p.type !== "file" || !p.mediaType?.startsWith("image/")) return [p];
      if (!isLast) return [{ type: "text" as const, text: "[图片]" }];
      const m2 = /^data:([^;]+);base64,(.+)$/.exec(p.url ?? "");
      if (m2) attachments.push({ buffer: Buffer.from(m2[2], "base64"), mediaType: m2[1] });
      return [p];
    });
    return { ...m, parts };
  });
  if (attachments.length > 6) return NextResponse.json({ error: "一次最多发 6 张图片" }, { status: 413 });

  const done = log.timer("ai.chat", { userId: session.userId, tripId: tripId ?? null, messages: messages.length, attachments: attachments.length });
  // 两个分支的工具集类型不同，这里按结构类型收口，只依赖用到的两个成员
  const finish = (result: { totalUsage: PromiseLike<{ inputTokens?: number; outputTokens?: number } | undefined>; toUIMessageStreamResponse(): Response }) => {
    void (async () => {
      try {
        const usage = await result.totalUsage;
        done({ inputTokens: usage?.inputTokens, outputTokens: usage?.outputTokens });
      } catch {
        done({ usage: "unavailable" });
      }
    })();
    return result.toUIMessageStreamResponse();
  };

  if (!tripId) {
    const user = await db.user.findUniqueOrThrow({ where: { id: session.userId }, select: { name: true } });
    return finish(
      streamText({
        model: attachments.length > 0 ? visionModel() : chatModel(),
        system: globalSystemPrompt(now, user.name),
        messages: await convertToModelMessages(prepared),
        tools: globalTools(session.userId),
        stopWhen: stepCountIs(6),
      })
    );
  }

  const trip = await db.trip.findFirst({
    where: { id: tripId, OR: [{ ownerId: session.userId }, { members: { some: { userId: session.userId } } }] },
    include: { members: { where: { userId: session.userId }, select: { role: true } } },
  });
  if (!trip) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const role = trip.ownerId === session.userId ? "OWNER" : trip.members[0]?.role;
  const canEdit = role === "OWNER" || role === "EDITOR";

  return finish(
    streamText({
      model: attachments.length > 0 ? visionModel() : chatModel(),
      system: systemPrompt({ tripTitle: trip.title, homeCurrency: trip.homeCurrency, now, babyName: trip.babyName, babyAge: trip.babyBirthDate ? babyAge(trip.babyBirthDate, now) : null, timezone: trip.timezone }),
      messages: await convertToModelMessages(prepared),
      tools: {
        ...globalTools(session.userId),
        ...tripTools({ tripId, userId: session.userId, homeCurrency: trip.homeCurrency, now, canEdit, timezone: trip.timezone, startDate: trip.startDate, endDate: trip.endDate, attachments }),
      },
      stopWhen: stepCountIs(6),
    })
  );
}
