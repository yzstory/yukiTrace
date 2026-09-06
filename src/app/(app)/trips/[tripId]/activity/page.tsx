import Link from "next/link";
import { db } from "@/lib/db";
import { requireTripAccess } from "@/lib/dal";
import { ENTITY_LABELS, ENTITIES, snapshot, recordTitle, type Entity } from "@/lib/activity-data";
import { RecordPanel } from "@/components/records/record-panel";
import { fmt } from "@/lib/date";
import { HistoryDiff } from "@/components/records/history-diff";

export const metadata = { title: "家庭操作历史" };
export default async function ActivityPage({ params, searchParams }: { params: Promise<{ tripId: string }>; searchParams: Promise<{ page?: string }> }) {
  const { tripId } = await params;
  await requireTripAccess(tripId);
  const query = await searchParams;
  const page = Math.min(10000, Math.max(1, Number(query.page) || 1));
  const [trip, events] = await Promise.all([
    db.trip.findUniqueOrThrow({ where: { id: tripId }, select: { timezone: true, title: true } }),
    db.activity.findMany({ where: { tripId }, include: { actor: { select: { name: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (Math.floor(page) - 1) * 30, take: 31 }),
  ]);
  return <div className="space-y-4 pb-12"><Link href={`/trips/${tripId}`} className="inline-block min-h-11 py-3 text-primary">返回旅程</Link><h1 className="text-title-1">家庭操作历史</h1><p className="text-footnote text-muted-foreground">{trip.title} · 历史从功能上线后开始记录，旧数据不推断操作者。</p>
    {!events.length && <p>还没有操作历史，下一次记录或修改后会出现在这里。</p>}
    {events.slice(0, 30).map((event) => <article key={event.id} className="space-y-2 rounded-2xl bg-card p-4">
      <p className="font-medium">{event.actor?.name ?? "已移除成员"} · {({ create: "新增", update: "修改", delete: "删除", undo: "撤销", confirm: "核对", keepDuplicates: "确认保留相似账单" } as Record<string, string>)[event.action] ?? event.action} {ENTITY_LABELS[event.entity]}</p>
      <p className="text-footnote text-muted-foreground">{fmt.dateFull(event.createdAt, trip.timezone)} {fmt.time(event.createdAt, trip.timezone)} · {event.source === "ai" ? "AI 辅助记录" : event.source === "organize" ? "旅程整理" : "手动记录"}{event.undoneAt ? " · 已撤销" : ""}</p>
      {["create", "update", "delete", "undo"].includes(event.action) && <HistoryDiff before={snapshot(event.before)} after={snapshot(event.after)} timezone={trip.timezone} />}
      {ENTITIES.includes(event.entity as Entity) && <RecordPanel tripId={tripId} entity={event.entity as Entity} refId={event.refId} activityId={event.id} title={recordTitle(snapshot(event.after ?? event.before)).slice(0, 80)} />}
    </article>)}
    <nav className="flex gap-6 text-primary">{page > 1 && <Link href={`?page=${page - 1}`}>上一页</Link>}{events.length > 30 && <Link href={`?page=${page + 1}`}>下一页</Link>}</nav>
  </div>;
}
