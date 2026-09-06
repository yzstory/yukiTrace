"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { loadRecord, editRecord, removeRecord, undoRecord, confirmRecord } from "@/app/(app)/trips/[tripId]/record-actions";
import { ENTITY_LABELS, recordTitle, type Entity } from "@/lib/activity-data";
import { RECORD_FIELDS } from "@/lib/record-fields";
import { CURRENCIES, formatMoney } from "@/lib/currency";
import { fmt } from "@/lib/date";

import { HistoryDiff } from "./history-diff";

type Detail = Awaited<ReturnType<typeof loadRecord>>;
const inputStyle = "mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-base";
const buttonStyle = "min-h-11 rounded-xl bg-fill-secondary px-3 text-footnote disabled:opacity-50";
export function RecordPanel({ tripId, entity, refId, activityId, title, expanded = false }: { tripId: string; entity: Entity; refId: string; activityId?: string; title?: string; expanded?: boolean }) {
  const [open, setOpen] = useState(expanded);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [editing, setEditing] = useState(false);
  const [failure, setFailure] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const reload = useCallback(async () => {
    try { setDetail(await loadRecord(tripId, entity, refId)); setFailure(""); }
    catch { setFailure("记录加载失败，请重试"); }
  }, [tripId, entity, refId]);
  useEffect(() => { if (open) void Promise.resolve().then(reload); }, [open, reload]);
  const run = (operation: () => Promise<{ error?: string; ok?: boolean }>) => start(async () => {
    try {
      const result = await operation();
      if (result.error) { toast.error(result.error); await reload(); return; }
      toast.success("已保存"); setEditing(false); await reload(); router.refresh();
    } catch { toast.error("操作失败，请稍后重试"); }
  });
  const record = detail?.record;
  const event = activityId ? detail?.history.find((item) => item.id === activityId) : detail?.history.find((item) => item.source === "ai" && ["create", "update"].includes(item.action));
  const timeValue = record?.paidAt || record?.startAt || record?.arriveAt || record?.takenAt || record?.at || record?.date;
  return <section className="w-full min-w-0 rounded-2xl border border-border bg-card p-3 text-callout">
    <button type="button" className="min-h-11 w-full text-left font-medium" onClick={() => setOpen(!open)} aria-expanded={open}>
      {ENTITY_LABELS[entity]} · {title || (record ? recordTitle(record).slice(0, 60) : "查看已写入的记录")} <span className="text-muted-foreground">{open ? "收起" : "查看 / 修改"}</span>
    </button>
    {open && <div className="space-y-3">
      {failure && <button className={buttonStyle} onClick={() => void reload()}>{failure}</button>}
      {!detail && !failure && <p role="status">正在读取最新记录…</p>}
      {detail && !record && <p className="text-muted-foreground">这条记录已删除或撤销。</p>}
      {record && detail && <>
        <div className="space-y-1 text-footnote text-muted-foreground">
          <p>{recordTitle(record)}</p>
          {entity === "expense" && <p className="font-medium text-foreground">{formatMoney(Number(record.amountMinor), String(record.currency), { showCode: true })} · {String(record.currency)}</p>}
          {timeValue != null && <p>{fmt.dateFull(new Date(String(timeValue)), detail.timezone)} {fmt.time(new Date(String(timeValue)), detail.timezone)} · {detail.timezone}</p>}
          {["entry", "expense", "photo"].includes(entity) && <p>地点：{detail.stops.find((stop) => stop.id === record.stopId)?.name ?? "未关联"}</p>}
          {detail.history[0] && <p>最近操作：{detail.history[0].actor?.name ?? "已移除成员"} · {detail.history[0].source === "ai" ? "AI 辅助" : detail.history[0].source === "organize" ? "旅程整理" : "手动记录"}</p>}
        </div>
        {detail.canEdit && <div className="flex flex-wrap gap-2">
          <button className={buttonStyle} disabled={pending} onClick={() => setEditing(!editing)}>修改</button>
          {detail.history.some((item) => item.source === "ai" && !item.reviewedAt && !item.undoneAt) && <button className={buttonStyle} disabled={pending} onClick={() => run(() => confirmRecord(tripId, entity, refId, detail.version))}>核对无误</button>}
          {event && event.source === "ai" && ["create", "update"].includes(event.action) && !event.undoneAt && (event.actorId === detail.userId || detail.isOwner) && <button className={buttonStyle} disabled={pending} onClick={() => { if (window.confirm("撤销这次 AI 写入？若记录已有后续修改，系统会阻止撤销。")) run(() => undoRecord(tripId, event.id)); }}>撤销 AI 写入</button>}
          <button className={`${buttonStyle} text-destructive`} disabled={pending} onClick={() => { if (window.confirm("确认删除这条记录？删除后保留操作历史。")) run(() => removeRecord(tripId, entity, refId, detail.version)); }}>删除</button>
        </div>}
        {editing && detail.canEdit && <form key={detail.version} className="space-y-3" action={(form) => run(() => editRecord(tripId, entity, refId, detail.version, Object.fromEntries(Array.from(form.entries()).map(([key, value]) => [key, String(value)]))))}>
          <p className="text-footnote text-muted-foreground">时间按 {detail.timezone} 填写。</p>
          {RECORD_FIELDS[entity].map((field) => <label key={field.key} className="block text-footnote">{field.label}
            {field.type === "textarea" ? <textarea name={field.key} defaultValue={detail.values[field.key]} required={field.required} className={inputStyle} rows={3} /> : field.type === "stop" || field.type === "currency" ? <select name={field.key} defaultValue={detail.values[field.key]} className={inputStyle}>
              {field.type === "stop" ? <><option value="">未关联</option>{detail.stops.map((stop) => <option key={stop.id} value={stop.id}>{stop.name}</option>)}</> : CURRENCIES.map((currency) => <option key={currency.code} value={currency.code}>{currency.code} · {currency.name}</option>)}
            </select> : <input name={field.key} type={field.type ?? "text"} step={field.type === "number" ? "any" : undefined} defaultValue={detail.values[field.key]} required={field.required} className={inputStyle} />}
          </label>)}
          <button className="min-h-11 rounded-xl bg-primary px-4 text-primary-foreground disabled:opacity-50" disabled={pending}>{pending ? "保存中…" : "保存修改"}</button>
        </form>}
      </>}
      {detail && <details className="text-footnote"><summary className="min-h-11 cursor-pointer py-3">记录来源与修改历史</summary>
        {!detail.history.length && <p>历史记录上线前的数据，暂无可核对的操作者信息。</p>}
        {detail.history.map((item) => <div key={item.id} className="border-t border-border py-3">
          <p>{item.actor?.name ?? "已移除成员"} · {({ create: "新增", update: "修改", delete: "删除", undo: "撤销", confirm: "核对" } as Record<string, string>)[item.action] ?? item.action} · {item.source === "ai" ? "AI 辅助" : "手动"}</p>
          <p className="text-muted-foreground">{fmt.dateFull(new Date(item.createdAt), detail.timezone)} {fmt.time(new Date(item.createdAt), detail.timezone)}</p>
          {["create", "update", "delete", "undo"].includes(item.action) && <HistoryDiff before={item.before} after={item.after} timezone={detail.timezone} />}
        </div>)}
        <p className="text-muted-foreground">显示最近 20 次操作。</p>
      </details>}
    </div>}
  </section>;
}
