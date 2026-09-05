import { NextResponse, type NextRequest } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import sharp from "sharp";
import { getSession } from "@/lib/session";
import { aiConfigured, visionModel } from "@/lib/ai/model";
import { CURRENCIES } from "@/lib/currency";
import { ExpenseCategory, EntryType } from "@/generated/prisma/enums";
import { rateLimit, tooManyRequests, LIMITS } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_RECEIPT_BYTES = 15 * 1024 * 1024;

const schema = z.object({
  kind: z.enum(["receipt", "flight", "hotel", "car_rental", "train", "other"]).describe("图片类型"),
  title: z.string().describe("简短名称，如商家名或航班号"),
  amount: z.number().nullable().describe("总金额（原币），无则 null"),
  currency: z.string().nullable().describe("ISO 4217 货币码，如 JPY；无法判断则 null"),
  paidAt: z.string().nullable().describe("时间 ISO 8601，无则 null"),
  category: z.nativeEnum(ExpenseCategory).nullable(),
  entryType: z.nativeEnum(EntryType).nullable().describe("若是航班/酒店/租车/火车确认单，对应条目类型"),
  meta: z.record(z.string(), z.string()).describe("结构化字段：flightNo/from/to/seat/company/carModel/roomType/bookingRef 等"),
  items: z.array(z.object({ name: z.string(), amount: z.number().nullable() })).describe("明细行，最多 10 条"),
  note: z.string().nullable().describe("其他值得记的信息"),
});

export type ReceiptResult = z.infer<typeof schema>;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!aiConfigured()) return NextResponse.json({ error: "AI 未配置" }, { status: 503 });

  const limited = rateLimit(`ai:receipt:${session.userId}`, LIMITS.aiReceipt.limit, LIMITS.aiReceipt.windowMs);
  if (!limited.ok) return tooManyRequests(limited, "票据识别次数用得有点快");

  const form = await req.formData();
  const file = form.get("file");
  const homeCurrency = String(form.get("homeCurrency") ?? "CNY");
  if (!(file instanceof File)) return NextResponse.json({ error: "no file" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "请选择图片文件" }, { status: 415 });
  if (file.size > MAX_RECEIPT_BYTES) return NextResponse.json({ error: "图片不能超过 15MB" }, { status: 413 });

  const input = Buffer.from(await file.arrayBuffer());
  let image: Buffer;
  try {
    image = await sharp(input, { failOn: "none" }).rotate().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  } catch {
    return NextResponse.json({ error: "图片无法读取，请换一张重试" }, { status: 400 });
  }

  const done = log.timer("ai.receipt", { userId: session.userId, bytes: image.length });
  try {
    const { object } = await generateObject({
      model: visionModel(),
      schema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `识别这张图片（收据 / 航班确认 / 酒店预订 / 租车合同 / 车票等）。只返回一个 JSON 对象，不要数组、Markdown 或解释，并且必须包含全部字段：{"kind":"other","title":"无法识别的图片","amount":null,"currency":null,"paidAt":null,"category":null,"entryType":null,"meta":{},"items":[],"note":null}。kind 只能是 receipt/flight/hotel/car_rental/train/other；category 只能是 TRANSPORT/ACCOMMODATION/FOOD/ACTIVITY/SHOPPING/BABY/OTHER 或 null；entryType 只能是 FLIGHT/CAR_RENTAL/TRAIN/TAXI/HOTEL/MEAL/ACTIVITY/SHOPPING/MOMENT 或 null；meta 的值必须是字符串，items 最多 10 条。主币种是 ${homeCurrency}；若图片中的货币符号是 ¥ 且商家在日本则为 JPY。支持的货币：${CURRENCIES.map((c) => c.code).join(",")}。看不清的字段填 null。`,
            },
            { type: "file", data: image, mediaType: "image/jpeg", filename: "receipt.jpg" },
          ],
        },
      ],
    });
    done({ kind: object.kind, hasAmount: object.amount != null });
    return NextResponse.json(object);
  } catch (e) {
    log.error("ai.receipt failed", { userId: session.userId, err: e });
    return NextResponse.json({ error: "识别失败，请重试或手动填写" }, { status: 500 });
  }
}
