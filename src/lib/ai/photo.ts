import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { visionModel, aiConfigured } from "@/lib/ai/model";
import { getObject } from "@/lib/storage";
import { log } from "@/lib/logger";
import { babyAge } from "@/lib/date";

const photoSchema = z.object({
  caption: z.string().describe("一句话说明这张照片，中文，20 字以内，不要以「这张照片」开头"),
  tags: z.array(z.enum(["baby", "people", "food", "scenery", "building", "transport", "document", "pet", "other"])).describe("内容标签，1-3 个"),
  score: z.number().min(0).max(100).describe("值得放进相册精选的程度：构图、清晰度、人物表情、纪念意义综合打分"),
  hasBaby: z.boolean().describe("画面里是否有婴幼儿"),
  firstMoment: z.string().nullable().describe("若画面明显是某个「第一次」（第一次坐飞机/看到雪/踩沙滩等），用一句话描述，否则为 null"),
  isDocument: z.boolean().describe("是否是票据、菜单、路牌等以文字为主的图，这类不适合进精选"),
});

export type PhotoAnalysis = z.infer<typeof photoSchema>;

/**
 * 对单张照片做视觉分析。失败不抛出，只写状态，避免影响上传主流程。
 */
export async function analyzePhoto(photoId: string): Promise<PhotoAnalysis | null> {
  if (!aiConfigured()) return null;

  const photo = await db.photo.findUnique({
    where: { id: photoId },
    include: { trip: { select: { babyName: true, babyBirthDate: true, title: true } }, stop: { select: { name: true, city: true } } },
  });
  if (!photo || photo.aiStatus === "done") return null;

  const buf = await getObject(photo.ossKey);
  if (!buf) {
    await db.photo.update({ where: { id: photoId }, data: { aiStatus: "failed" } });
    return null;
  }

  const context = [
    photo.trip.title && `旅程：${photo.trip.title}`,
    photo.stop && `地点：${photo.stop.name}${photo.stop.city ? `（${photo.stop.city}）` : ""}`,
    photo.trip.babyBirthDate && photo.takenAt && `同行宝宝${photo.trip.babyName ? ` ${photo.trip.babyName}` : ""}当时 ${babyAge(photo.trip.babyBirthDate, photo.takenAt)}`,
  ]
    .filter(Boolean)
    .join("；");

  try {
    const { object } = await generateObject({
      model: visionModel(),
      schema: photoSchema,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `描述这张旅行照片并按 schema 返回 JSON 对象。${context ? `已知信息：${context}。` : ""}说明要具体、有画面感，不要套话。` },
            { type: "file", data: new Uint8Array(buf), mediaType: "image/webp", filename: "photo.webp" },
          ],
        },
      ],
    });

    await db.photo.update({
      where: { id: photoId },
      data: {
        aiCaption: object.caption,
        aiTags: object.tags,
        // 文档类照片压低分，避免票据被选成封面
        aiScore: object.isDocument ? Math.min(object.score, 20) : object.score,
        firstMoment: object.firstMoment,
        aiStatus: "done",
      },
    });
    return object;
  } catch (e) {
    log.warn("photo.analyze failed", { photoId, err: e });
    await db.photo.update({ where: { id: photoId }, data: { aiStatus: "failed" } }).catch(() => {});
    return null;
  }
}

/** 批量分析（上传后台任务用），串行避免打爆网关 */
export async function analyzePhotos(ids: string[]) {
  for (const id of ids) await analyzePhoto(id);
}

/** 旅程还没设封面时，用 AI 评分最高的照片自动补一张 */
export async function autoPickCover(tripId: string) {
  const trip = await db.trip.findUnique({ where: { id: tripId }, select: { coverKey: true } });
  if (!trip || trip.coverKey) return;
  const best = await db.photo.findFirst({
    where: { tripId, aiStatus: "done", aiScore: { gte: 60 }, NOT: { aiTags: { has: "document" } } },
    orderBy: { aiScore: "desc" },
    select: { ossKey: true },
  });
  if (best) await db.trip.update({ where: { id: tripId }, data: { coverKey: best.ossKey } });
}

/** 精选：优先 AI 高分，其次有拍摄时间的，排除文档类 */
export async function pickHighlights(tripId: string, limit = 6) {
  return db.photo.findMany({
    where: { tripId, NOT: { aiTags: { has: "document" } } },
    orderBy: [{ isFavorite: "desc" }, { aiScore: "desc" }, { takenAt: "asc" }],
    take: limit,
  });
}
