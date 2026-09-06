"use client";
import { useCallback, useEffect, useState, useTransition } from "react";
import { listOps, listPhotos, onQueueChange, retryQueued, removeOp, removePhoto } from "@/lib/offline/queue";
import { flushQueue } from "@/lib/offline/sync";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function LocalQueue({ tripId }: { tripId: string }) {
  const [items, setItems] = useState<Array<{ id: string; store: "ops" | "photos"; title: string; error?: string }>>([]);
  const [pending, start] = useTransition();
  const router = useRouter();
  const reload = useCallback(async () => {
    const [ops, photos] = await Promise.all([listOps(), listPhotos()]);
    setItems([...ops.filter((item) => item.tripId === tripId).map((item) => ({ id: item.id, store: "ops" as const, title: item.summary, error: item.lastError })), ...photos.filter((item) => item.tripId === tripId).map((item) => ({ id: item.id, store: "photos" as const, title: item.filename, error: item.lastError }))]);
  }, [tripId]);
  useEffect(() => { void Promise.resolve().then(reload); return onQueueChange(() => void reload()); }, [reload]);
  return <section className="space-y-2"><h2 className="text-title-3">本设备待同步 · {items.length}</h2><p className="text-footnote text-muted-foreground">仅显示这台设备保存的离线记录和照片，其他家人的设备需各自联网同步。</p>
    {!items.length && <p className="text-footnote">本设备没有待同步内容。</p>}
    {items.map((item) => <div key={item.id} className="rounded-2xl bg-card p-3"><p>{item.title}</p>{item.error && <p className="text-footnote text-destructive">{item.error}</p>}<div className="flex gap-3">
      <button disabled={pending} className="min-h-11 text-primary" onClick={() => start(async () => { try { if (!navigator.onLine) { toast.error("请联网后再同步"); return; } await retryQueued(item.store, item.id); const result = await flushQueue(tripId); toast(result.failed ? "部分内容未同步，请查看错误" : "同步已完成"); await reload(); router.refresh(); } catch { toast.error("同步失败，请重试"); } })}>重新同步</button>
      <button disabled={pending} className="min-h-11 text-destructive" onClick={() => { if (window.confirm("放弃这条未同步内容？此操作不能恢复。")) start(async () => { try { if (item.store === "ops") await removeOp(item.id); else await removePhoto(item.id); await reload(); } catch { toast.error("删除失败"); } }); }}>放弃</button>
    </div></div>)}
  </section>;
}
