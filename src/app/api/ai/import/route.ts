import { NextResponse, type NextRequest } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { requestUserId } from "@/lib/api/auth";
import { aiConfigured, chatModel } from "@/lib/ai/model";
import { EntryType, StopType } from "@/generated/prisma/enums";
import { CURRENCIES } from "@/lib/currency";
import { fmt } from "@/lib/date";
import { rateLimit, tooManyRequests, LIMITS } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_CHARS = 8000;

const schema = z.object({
  entries: z
    .array(
      z.object({
        type: z.nativeEnum(EntryType),
        title: z.string(),
        startAt: z.string().describe("本地时间，格式 YYYY-MM-DDTHH:mm"),
        endAt: z.string().nullable(),
        note: z.string().nullable(),
        meta: z.record(z.string(), z.string()),
        amount: z.number().nullable().describe("金额，无则 null"),
        currency: z.string().nullable(),
      })
    )
    .describe("从文本中解析出的行程条目，按时间排序"),
  stops: z
    .array(z.object({ name: z.string(), type: z.nativeEnum(StopType), arriveAt: z.string(), city: z.string().nullable() }))
    .describe("可以作为站点的地点，没有就返回空数组"),
  summary: z.string().describe("一句话说明识别到了什么"),
});

export type ImportResult = z.infer<typeof schema>;

/** 粘贴航班确认邮件 / 酒店预订单 / 行程单，解析成可确认的条目草稿（不直接落库） */
export async function POST(req: NextRequest) {
  const userId = await requestUserId(req);
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!aiConfigured()) return NextResponse.json({ error: "AI 未配置" }, { status: 503 });

  const limited = rateLimit(`ai:import:${userId}`, LIMITS.aiGenerate.limit, LIMITS.aiGenerate.windowMs);
  if (!limited.ok) return tooManyRequests(limited, "解析次数用得有点快");

  const body = (await req.json().catch(() => null)) as { text?: string; tripId?: string } | null;
  const text = body?.text?.trim();
  if (!text || !body?.tripId) return NextResponse.json({ error: "缺少内容" }, { status: 400 });
  if (text.length > MAX_CHARS) return NextResponse.json({ error: `内容太长（超过 ${MAX_CHARS} 字）` }, { status: 413 });

  const trip = await db.trip.findFirst({
    where: { id: body.tripId, OR: [{ ownerId: userId }, { members: { some: { userId: userId, role: { in: ["OWNER", "EDITOR"] } } } }] },
    select: { id: true, title: true, timezone: true, homeCurrency: true, startDate: true, endDate: true },
  });
  if (!trip) return NextResponse.json({ error: "无权限" }, { status: 403 });

  const done = log.timer("ai.import", { userId: userId, tripId: trip.id, chars: text.length });
  try {
    const { object } = await generateObject({
      model: chatModel(),
      schema,
      messages: [
        {
          role: "user",
          content: `从下面的文本里抽取行程信息，返回符合 schema 的 JSON 对象。
旅程「${trip.title}」的日期范围是 ${fmt.inputDate(trip.startDate, trip.timezone)} 到 ${fmt.inputDate(trip.endDate, trip.timezone)}，时区 ${trip.timezone}，主币种 ${trip.homeCurrency}。
时间一律输出当地时间的 YYYY-MM-DDTHH:mm，不带时区后缀。年份缺失时按上述日期范围推断。
支持的货币：${CURRENCIES.map((c) => c.code).join(",")}。
航班填 meta.flightNo/from/to/seat；酒店填 meta.roomType/bookingRef；租车填 meta.company/carModel/pickupPlace/returnPlace；火车填 meta.trainNo/from/to。
识别不到就返回空数组，不要编造。

文本：
${text}`,
        },
      ],
    });
    done({ entries: object.entries.length, stops: object.stops.length });
    return NextResponse.json(object);
  } catch (e) {
    log.error("ai.import failed", { userId: userId, err: e });
    return NextResponse.json({ error: "解析失败，请检查内容或稍后重试" }, { status: 502 });
  }
}
