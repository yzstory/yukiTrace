"use client";

import { useTransition } from "react";
import { Link2, Copy, Trash2, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { createShareLink, revokeShareLink, toggleShareExpense } from "@/app/(app)/trips/[tripId]/share-actions";

export type ShareLinkData = { id: string; token: string; hideExpense: boolean; createdAt: Date };

export function ShareSettings({ tripId, links }: { tripId: string; links: ShareLinkData[] }) {
  const [pending, start] = useTransition();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <section className="rounded-2xl bg-card p-4 card-shadow">
      <h2 className="mb-1 text-footnote font-semibold uppercase tracking-wide text-muted-foreground">分享给家人</h2>
      <p className="mb-3 text-caption text-muted-foreground">只读链接，不需要登录即可查看时间线、地图与照片。可选择隐藏花费。</p>
      <ul className="flex flex-col gap-2">
        {links.map((l) => {
          const url = `${origin}/share/${l.token}`;
          return (
            <li key={l.id} className="rounded-xl bg-fill-secondary p-3">
              <div className="flex items-center gap-2">
                <Link2 className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate text-footnote">{url}</span>
                <button
                  type="button"
                  aria-label="复制"
                  onClick={async () => {
                    await navigator.clipboard.writeText(url);
                    toast.success("已复制链接");
                  }}
                  className="rounded-full p-1.5 text-primary active:bg-fill"
                >
                  <Copy className="size-4" />
                </button>
                <button type="button" aria-label="撤销" disabled={pending} onClick={() => start(() => revokeShareLink(tripId, l.id))} className="rounded-full p-1.5 text-destructive active:bg-fill">
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between text-footnote">
                <span className="text-muted-foreground">隐藏花费</span>
                <Switch checked={l.hideExpense} disabled={pending} onCheckedChange={(v) => start(() => toggleShareExpense(tripId, l.id, v))} />
              </div>
            </li>
          );
        })}
      </ul>
      <Button variant="secondary" disabled={pending} className="mt-3 h-10 w-full rounded-xl" onClick={() => start(() => createShareLink(tripId, true))}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} 生成分享链接
      </Button>
    </section>
  );
}
