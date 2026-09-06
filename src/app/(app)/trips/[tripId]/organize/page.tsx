import Link from "next/link";
import { db } from "@/lib/db";
import { requireTripAccess } from "@/lib/dal";
import { duplicateExpenses } from "@/lib/organize";
import { snapshot, ENTITIES, type Entity } from "@/lib/activity-data";
import { RecordPanel } from "@/components/records/record-panel";
import { LocalQueue } from "@/components/records/local-queue";
import { OrganizeButton } from "@/components/records/organize-button";
import { imageUrl } from "@/lib/storage";

export const metadata = { title: "旅程整理" };
export default async function OrganizePage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const { role } = await requireTripAccess(tripId);
  const trip = await db.trip.findUniqueOrThrow({ where: { id: tripId }, include: { expenses: { orderBy: { paidAt: "asc" } }, photos: { orderBy: { createdAt: "desc" } }, entries: { where: { stopId: null } } } });
  const events = await db.activity.findMany({ where: { tripId, OR: [{ source: "ai", reviewedAt: null, undoneAt: null }, { action: "keepDuplicates" }] }, orderBy: { createdAt: "desc" } });
  const kept = new Set(events.filter((item) => item.action === "keepDuplicates").map((item) => snapshot(item.after)?.fingerprint));
  const duplicates = duplicateExpenses(trip.expenses, trip.timezone).filter((item) => !kept.has(item.fingerprint));
  const missing = [...trip.entries.map((item) => ({ entity: "entry" as Entity, refId: item.id, title: item.title })), ...trip.expenses.filter((item) => !item.stopId).map((item) => ({ entity: "expense" as Entity, refId: item.id, title: item.title })), ...trip.photos.filter((item) => !item.stopId).map((item) => ({ entity: "photo" as Entity, refId: item.id, title: item.caption || item.aiCaption || "未关联地点的照片" }))];
  const unreviewed = Array.from(new Map(events.toReversed().filter((item) => item.source === "ai" && ["create", "update"].includes(item.action) && ENTITIES.includes(item.entity as Entity)).map((item) => [`${item.entity}:${item.refId}`, item] as const)).values());
  const failedPhotos = trip.photos.filter((item) => ["pending", "failed"].includes(item.aiStatus));
  const count = duplicates.length + missing.length + unreviewed.length + failedPhotos.length;
  return <div className="space-y-6 pb-12">
    <Link href={`/trips/${tripId}`} className="inline-block min-h-11 py-3 text-primary">返回旅程</Link>
    <header><h1 className="text-title-1">旅程整理</h1><p className="mt-2 text-muted-foreground">{trip.title} · {count ? `${count} 项待核对（同一记录可能有多项）` : "服务器记录已整理完毕"}</p></header>
    <LocalQueue tripId={tripId} />
    <section className="space-y-3"><h2 className="text-title-3">疑似重复账单 · {duplicates.length} 组</h2><p className="text-footnote text-muted-foreground">同一天、同名称、同币种和金额的消费，仅提示，不会自动删除。</p>
      {duplicates.map((group) => <div key={group.fingerprint} className="space-y-2 rounded-2xl border border-border p-3">{group.items.map((item) => <RecordPanel key={item.id} tripId={tripId} entity="expense" refId={item.id} title={item.title} />)}{role !== "VIEWER" && <OrganizeButton tripId={tripId} kind="duplicate" value={group.fingerprint} />}</div>)}
      {!duplicates.length && <p className="text-footnote">没有待核对的相似账单。</p>}
    </section>
    <section className="space-y-3"><h2 className="text-title-3">AI 记录待确认 · {unreviewed.length}</h2><p className="text-footnote text-muted-foreground">展开核对日期、金额和地点，可修改或撤销。</p>{unreviewed.map((item) => <RecordPanel key={item.id} tripId={tripId} entity={item.entity as Entity} refId={item.refId} activityId={item.id} />)}</section>
    <section className="space-y-3"><h2 className="text-title-3">补充关联地点 · {missing.length}</h2><p className="text-footnote text-muted-foreground">关联地点有助于按路线回顾；交通等跨站记录可以保持未关联。</p>{missing.map((item) => <RecordPanel key={`${item.entity}:${item.refId}`} tripId={tripId} {...item} />)}</section>
    <section className="space-y-3"><h2 className="text-title-3">照片说明待整理 · {failedPhotos.length}</h2>{failedPhotos.map((photo) => <div key={photo.id} className="space-y-2 rounded-2xl bg-card p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl(photo.ossKey, { w: 400 })} alt={photo.caption || "待整理的旅行照片"} loading="lazy" className="h-32 w-32 rounded-xl object-cover" />
      <p className="text-footnote">{photo.aiStatus === "failed" ? "识别未成功" : "等待识别"}</p><RecordPanel tripId={tripId} entity="photo" refId={photo.id} title="手动整理照片" />{role !== "VIEWER" && <OrganizeButton tripId={tripId} kind="photo" value={photo.id} />}
    </div>)}</section>
    <nav className="flex flex-wrap gap-4 text-primary"><Link href={`/trips/${tripId}/activity`}>家庭操作历史</Link><Link href={`/trips/${tripId}/summary`}>生成旅程回顾</Link><Link href={`/trips/${tripId}/album`}>打印相册</Link></nav>
  </div>;
}
