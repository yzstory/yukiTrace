"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { RecordPanel } from "@/components/records/record-panel";
import { LocalQueue } from "@/components/records/local-queue";
import { OrganizeButton } from "@/components/records/organize-button";
import { autoTidy } from "@/app/(app)/trips/[tripId]/organize/actions";
import type { TidyReport } from "@/lib/tidy";

/**
 * 整理报告：先「一键整理」把能自动做的做掉（按时间关联地点、重试照片识别），
 * 剩下需要人判断的再逐条确认。它是旅程页里的抽屉，不是独立页面。
 */
export function TidySheet({ tripId, report, canEdit }: { tripId: string; report: TidyReport; canEdit: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const automatable = report.missing.length + report.failedPhotos.length;

  return (
    <div className="space-y-6 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <p className="text-subhead text-muted-foreground" data-testid="tidy-summary">{report.count ? `${report.count} 项待处理（同一记录可能有多项）` : "服务器记录已整理完毕"}</p>

      {canEdit && automatable > 0 && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              try {
                const r = await autoTidy(tripId);
                if (r.error) {
                  toast.error(r.error);
                  return;
                }
                const parts = [r.linked ? `关联了 ${r.linked} 条记录` : "", r.analyzed ? `重新识别了 ${r.analyzed} 张照片` : ""].filter(Boolean);
                toast.success(parts.length ? parts.join("，") : "没有可以自动处理的项目");
                router.refresh();
              } catch {
                toast.error("整理失败，请稍后重试");
              }
            })
          }
          className="pressable flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-callout font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {pending ? "整理中…" : "一键整理"}
          <span className="text-caption font-normal opacity-80">按时间关联地点、重试识别</span>
        </button>
      )}

      <LocalQueue tripId={tripId} />

      <section className="space-y-3">
        <h2 className="text-title-3">疑似重复账单 · {report.duplicates.length} 组</h2>
        <p className="text-footnote text-muted-foreground">同一天、同名称、同币种和金额的消费，仅提示，不会自动删除。</p>
        {report.duplicates.map((group) => (
          <div key={group.fingerprint} className="space-y-2 rounded-2xl border border-border p-3">
            {group.items.map((item) => (
              <RecordPanel key={item.id} tripId={tripId} entity="expense" refId={item.id} title={item.title} />
            ))}
            {canEdit && <OrganizeButton tripId={tripId} kind="duplicate" value={group.fingerprint} />}
          </div>
        ))}
        {!report.duplicates.length && <p className="text-footnote">没有待核对的相似账单。</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-title-3">AI 记录待确认 · {report.unreviewed.length}</h2>
        <p className="text-footnote text-muted-foreground">展开核对日期、金额和地点，可修改或撤销。</p>
        {report.unreviewed.map((item) => (
          <RecordPanel key={item.activityId} tripId={tripId} entity={item.entity} refId={item.refId} activityId={item.activityId} />
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-title-3">补充关联地点 · {report.missing.length}</h2>
        <p className="text-footnote text-muted-foreground">「一键整理」会按时间自动归站；时间对不上的留在这里手动选。</p>
        {report.missing.map((item) => (
          <RecordPanel key={`${item.entity}:${item.refId}`} tripId={tripId} entity={item.entity} refId={item.refId} title={item.title} />
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-title-3">照片说明待整理 · {report.failedPhotos.length}</h2>
        {report.failedPhotos.map((photo) => (
          <div key={photo.id} className="space-y-2 rounded-2xl bg-card p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="待整理的旅行照片" loading="lazy" className="h-32 w-32 rounded-xl object-cover" />
            <p className="text-footnote">{photo.status === "failed" ? "识别未成功" : "等待识别"}</p>
            <RecordPanel tripId={tripId} entity="photo" refId={photo.id} title="手动整理照片" />
            {canEdit && <OrganizeButton tripId={tripId} kind="photo" value={photo.id} />}
          </div>
        ))}
      </section>
    </div>
  );
}
