import "server-only";
import { db } from "@/lib/db";
import { duplicateExpenses } from "@/lib/organize";
import { snapshot, ENTITIES, type Entity } from "@/lib/activity-data";
import { imageUrl } from "@/lib/storage";

export type TidyReport = {
  duplicates: Array<{ fingerprint: string; items: Array<{ id: string; title: string }> }>;
  unreviewed: Array<{ activityId: string; entity: Entity; refId: string }>;
  missing: Array<{ entity: Entity; refId: string; title: string }>;
  failedPhotos: Array<{ id: string; url: string; status: "pending" | "failed" }>;
  count: number;
};

/** 交通类条目本来就跨站，不算「缺少关联地点」 */
const CROSS_STOP_ENTRY = new Set(["FLIGHT", "CAR_RENTAL", "TRAIN", "TAXI"]);

/** 纯统计的整理报告：重复账单、AI 待核对、缺关联、识别失败。不调用模型。 */
export async function tidyReport(tripId: string): Promise<TidyReport> {
  const trip = await db.trip.findUniqueOrThrow({
    where: { id: tripId },
    include: {
      expenses: { orderBy: { paidAt: "asc" } },
      photos: { orderBy: { createdAt: "desc" }, select: { id: true, stopId: true, ossKey: true, caption: true, aiCaption: true, aiStatus: true } },
      entries: { where: { stopId: null }, select: { id: true, title: true, type: true } },
    },
  });
  const events = await db.activity.findMany({
    where: { tripId, OR: [{ source: "ai", reviewedAt: null, undoneAt: null }, { action: "keepDuplicates" }] },
    orderBy: { createdAt: "desc" },
  });
  const kept = new Set(events.filter((e) => e.action === "keepDuplicates").map((e) => snapshot(e.after)?.fingerprint));
  const duplicates = duplicateExpenses(trip.expenses, trip.timezone)
    .filter((g) => !kept.has(g.fingerprint))
    .map((g) => ({ fingerprint: g.fingerprint, items: g.items.map((i) => ({ id: i.id, title: i.title })) }));

  const missing: TidyReport["missing"] = [
    ...trip.entries.filter((e) => !CROSS_STOP_ENTRY.has(e.type)).map((e) => ({ entity: "entry" as Entity, refId: e.id, title: e.title })),
    ...trip.expenses.filter((e) => !e.stopId).map((e) => ({ entity: "expense" as Entity, refId: e.id, title: e.title })),
    ...trip.photos.filter((p) => !p.stopId).map((p) => ({ entity: "photo" as Entity, refId: p.id, title: p.caption || p.aiCaption || "未关联地点的照片" })),
  ];

  const unreviewed = Array.from(
    new Map(
      events
        .toReversed()
        .filter((e) => e.source === "ai" && ["create", "update"].includes(e.action) && ENTITIES.includes(e.entity as Entity))
        .map((e) => [`${e.entity}:${e.refId}`, { activityId: e.id, entity: e.entity as Entity, refId: e.refId }] as const)
    ).values()
  );

  const failedPhotos = trip.photos
    .filter((p) => p.aiStatus === "pending" || p.aiStatus === "failed")
    .map((p) => ({ id: p.id, url: imageUrl(p.ossKey, { w: 400 }), status: p.aiStatus as "pending" | "failed" }));

  return { duplicates, unreviewed, missing, failedPhotos, count: duplicates.length + unreviewed.length + missing.length + failedPhotos.length };
}

/**
 * 按时间把记录归到站点：取到达时间不晚于记录时间的最后一站，
 * 且记录时间在该站离开之前（没填离开时间就按 12 小时算）。
 */
export function stopForTime(stops: Array<{ id: string; arriveAt: Date; leaveAt: Date | null }>, at: Date): string | null {
  let best: (typeof stops)[number] | null = null;
  for (const s of stops) if (s.arriveAt <= at && (!best || s.arriveAt > best.arriveAt)) best = s;
  if (!best) return null;
  const until = best.leaveAt ?? new Date(best.arriveAt.getTime() + 12 * 3600_000);
  return at <= until ? best.id : null;
}
