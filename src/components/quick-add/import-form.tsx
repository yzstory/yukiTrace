"use client";

import { useState, useTransition } from "react";
import { Loader2, ClipboardPaste, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ENTRY_TYPES } from "@/lib/entry-types";
import { createEntry } from "@/app/(app)/trips/[tripId]/actions";
import type { ImportResult } from "@/app/api/ai/import/route";
import { cn } from "@/lib/utils";

/**
 * 粘贴航班确认邮件、酒店预订单、行程单 → AI 解析成条目草稿 → 用户勾选后落库。
 * 刻意不直接写库：解析可能出错，让人确认一遍成本很低。
 */
export function ImportForm({ tripId, onDone }: { tripId: string; onDone: () => void }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [parsing, setParsing] = useState(false);
  const [saving, startSave] = useTransition();

  async function parse() {
    if (!text.trim()) return;
    setParsing(true);
    try {
      const res = await fetch("/api/ai/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, tripId }),
      });
      const json = (await res.json()) as ImportResult & { error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? "解析失败");
      if (json.entries.length === 0) {
        toast.error("没识别出行程信息，换一段试试");
        return;
      }
      setResult(json);
      setPicked(new Set(json.entries.map((_, i) => i)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "解析失败");
    } finally {
      setParsing(false);
    }
  }

  function save() {
    if (!result) return;
    startSave(async () => {
      let ok = 0;
      for (const [i, e] of result.entries.entries()) {
        if (!picked.has(i)) continue;
        const fd = new FormData();
        fd.set("type", e.type);
        fd.set("title", e.title);
        fd.set("startAt", e.startAt);
        if (e.endAt) fd.set("endAt", e.endAt);
        if (e.note) fd.set("note", e.note);
        fd.set("meta", JSON.stringify(e.meta ?? {}));
        fd.set("category", ENTRY_TYPES[e.type].defaultCategory);
        if (e.amount) {
          fd.set("amount", String(e.amount));
          if (e.currency) fd.set("currency", e.currency);
        }
        const r = await createEntry(tripId, undefined, fd);
        if (!r?.error) ok++;
      }
      toast.success(`已导入 ${ok} 条`);
      onDone();
    });
  }

  if (!result) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-subhead text-muted-foreground">把航班确认邮件、酒店预订单、行程单粘进来，AI 会拆成条目让你确认。</p>
        <Textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={"例如：\nMU279 上海浦东 T1 10/01 09:30 → 札幌新千岁 14:10 座位 23A\n札幌格兰大酒店 10/01-10/03 家庭房 预订号 ABC123"}
          className="rounded-xl bg-fill-secondary text-body"
        />
        <Button onClick={parse} disabled={!text.trim() || parsing} className="h-12 rounded-xl text-body font-semibold">
          {parsing ? <Loader2 className="size-5 animate-spin" /> : <ClipboardPaste className="size-5" />} 解析
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-subhead text-muted-foreground">{result.summary}</p>
      <ul className="flex flex-col gap-2">
        {result.entries.map((e, i) => {
          const cfg = ENTRY_TYPES[e.type];
          const Icon = cfg.icon;
          const on = picked.has(i);
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() =>
                  setPicked((p) => {
                    const n = new Set(p);
                    if (n.has(i)) n.delete(i);
                    else n.add(i);
                    return n;
                  })
                }
                className={cn("flex w-full items-start gap-3 rounded-2xl p-3 text-left transition-colors", on ? "bg-card card-shadow ring-2 ring-primary/60" : "bg-fill-secondary opacity-60")}
              >
                <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl", cfg.bg, cfg.color)}>
                  <Icon className="size-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-callout font-medium">{e.title}</span>
                  <span className="block text-caption text-muted-foreground">
                    {cfg.label} · {e.startAt.replace("T", " ")}
                    {e.amount ? ` · ${e.amount} ${e.currency ?? ""}` : ""}
                  </span>
                  {Object.keys(e.meta ?? {}).length > 0 && (
                    <span className="mt-0.5 block truncate text-caption text-label-tertiary">
                      {Object.entries(e.meta).map(([k, v]) => `${k}=${v}`).join(" · ")}
                    </span>
                  )}
                </span>
                {on && <Check className="mt-1 size-4 shrink-0 text-primary" />}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex gap-2">
        <Button variant="secondary" className="h-12 flex-1 rounded-xl" onClick={() => setResult(null)}>
          重新粘贴
        </Button>
        <Button onClick={save} disabled={saving || picked.size === 0} className="h-12 flex-1 rounded-xl font-semibold">
          {saving ? <Loader2 className="size-5 animate-spin" /> : `导入 ${picked.size} 条`}
        </Button>
      </div>
    </div>
  );
}
