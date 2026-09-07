import "server-only";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { reindexTrip } from "@/lib/ai/memory";
import { embeddingsConfigured } from "@/lib/ai/model";
import { badRequest } from "@/lib/api/errors";
import { firstIssue, type Input } from "./input";
import type { z } from "zod";

/** 调用方身份：服务层只认 userId，不碰 cookie / 会话 */
export type Actor = { userId: string };

/** 校验输入；失败抛 400，信息与原表单提示一致 */
export function parse<T extends z.ZodTypeAny>(schema: T, input: Input): z.infer<T> {
  const r = schema.safeParse(input);
  if (!r.success) throw badRequest(firstIssue(r.error));
  return r.data;
}

/** 内容变更后重建向量索引（后台执行，失败只记日志） */
export function scheduleReindex(tripId: string) {
  if (!embeddingsConfigured()) return;
  after(async () => {
    try {
      await reindexTrip(tripId);
    } catch (err) {
      log.error("memory.reindex failed", { tripId, err });
    }
  });
}

/** 旅程页与列表的缓存失效；旅程内的子页面（清单、成员）由各自服务再加 */
export function refreshTrip(tripId: string) {
  revalidatePath(`/trips/${tripId}`, "layout");
  revalidatePath("/trips");
}

/** 旅程时区（站点可覆盖） */
export async function tripTz(tripId: string) {
  const t = await db.trip.findUnique({ where: { id: tripId }, select: { timezone: true } });
  return t?.timezone ?? "Asia/Shanghai";
}

/** 条目时区：优先取所属站点覆盖的时区，否则旅程时区 */
export async function entryTz(tripId: string, stopId: string | null) {
  if (stopId) {
    const s = await db.stop.findUnique({ where: { id: stopId }, select: { timezone: true } });
    if (s?.timezone) return s.timezone;
  }
  return tripTz(tripId);
}
