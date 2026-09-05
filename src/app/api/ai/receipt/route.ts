import { NextResponse, type NextRequest } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import sharp from "sharp";
import { getSession } from "@/lib/session";
import { aiConfigured, visionModel } from "@/lib/ai/model";
import { CURRENCIES } from "@/lib/currency";
import { ExpenseCategory, EntryType } from "@/generated/prisma/enums";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  const form = await req.formData();
  const file = form.get("file");
  const homeCurrency = String(form.get("homeCurrency") ?? "CNY");
  if (!(file instanceof File)) return NextResponse.json({ error: "no file" }, { status: 400 });

  const input = Buffer.from(await file.arrayBuffer());
  const image = await sharp(input, { failOn: "none" }).rotate().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();

  try {
    const { object } = await generateObject({
      model: visionModel(),
      schema,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `识别这张图片（收据 / 航班确认 / 酒店预订 / 租车合同 / 车票等），抽取结构化信息。主币种是 ${homeCurrency}；若图片中的货币符号是 ¥ 且商家在日本则为 JPY。支持的货币：${CURRENCIES.map((c) => c.code).join(",")}。看不清的字段填 null。` },
            { type: "image", image, mediaType: "image/jpeg" },
          ],
        },
      ],
    });
    return NextResponse.json(object);
  } catch (e) {
    console.error("[ai/receipt]", e);
    return NextResponse.json({ error: "识别失败，请重试或手动填写" }, { status: 500 });
  }
}
