import { NextResponse, type NextRequest } from "next/server";
import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { aiConfigured, chatModel } from "@/lib/ai/model";
import { tripTools, systemPrompt } from "@/lib/ai/tools";
import { babyAge } from "@/lib/date";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!aiConfigured()) return NextResponse.json({ error: "AI 未配置：请在 .env 设置 AI_BASE_URL / AI_API_KEY / AI_MODEL" }, { status: 503 });

  const { messages, tripId } = (await req.json()) as { messages: UIMessage[]; tripId: string };
  const trip = await db.trip.findFirst({
    where: { id: tripId, OR: [{ ownerId: session.userId }, { members: { some: { userId: session.userId } } }] },
    include: { members: { where: { userId: session.userId }, select: { role: true } } },
  });
  if (!trip) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const role = trip.ownerId === session.userId ? "OWNER" : trip.members[0]?.role;
  const canEdit = role === "OWNER" || role === "EDITOR";
  const now = new Date();

  const result = streamText({
    model: chatModel(),
    system: systemPrompt({ tripTitle: trip.title, homeCurrency: trip.homeCurrency, now, babyName: trip.babyName, babyAge: trip.babyBirthDate ? babyAge(trip.babyBirthDate, now) : null, timezone: trip.timezone }),
    messages: await convertToModelMessages(messages.slice(-20)),
    tools: tripTools({ tripId, userId: session.userId, homeCurrency: trip.homeCurrency, now, canEdit, timezone: trip.timezone }),
    stopWhen: stepCountIs(6),
  });
  return result.toUIMessageStreamResponse();
}
