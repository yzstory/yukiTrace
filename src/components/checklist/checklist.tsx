"use client";

import { useOptimistic, useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, Plus, Trash2, Sparkles, ListPlus, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toggleChecklistItem, addChecklistItem, deleteChecklistItem, applyDefaultTemplate, resetChecks } from "@/app/(app)/trips/[tripId]/checklist/actions";
import { generatePackingList } from "@/app/(app)/trips/[tripId]/ai-actions";

export type CheckItem = { id: string; group: string; text: string; checked: boolean };

export function Checklist({ tripId, items, canEdit, aiConfigured }: { tripId: string; items: CheckItem[]; canEdit: boolean; aiConfigured: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(items, (state, patch: { id: string; checked: boolean }) => state.map((i) => (i.id === patch.id ? { ...i, checked: patch.checked } : i)));
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState<string | null>(null);
  const [text, setText] = useState("");

  const groups = Array.from(new Set(optimistic.map((i) => i.group)));
  const done = optimistic.filter((i) => i.checked).length;

  if (optimistic.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-3xl bg-card px-6 py-12 text-center card-shadow">
        <span className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-ios-green/15 text-ios-green">
          <ListPlus className="size-8" />
        </span>
        <h2 className="text-title-2">出行前清单</h2>
        <p className="mt-1 max-w-xs text-subhead text-muted-foreground">从带娃出行模板开始，或让 AI 按目的地和月龄生成。</p>
        {canEdit && (
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button disabled={pending} className="h-11 rounded-xl px-5" onClick={() => start(() => applyDefaultTemplate(tripId))}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <ListPlus className="size-4" />} 使用模板
            </Button>
            {aiConfigured && (
              <Button
                variant="secondary"
                disabled={pending}
                className="h-11 rounded-xl px-5"
                onClick={() =>
                  start(async () => {
                    const r = await generatePackingList(tripId);
                    if (r.error) toast.error(r.error);
                    else toast.success(`已生成 ${r.count} 项`);
                  })
                }
              >
                <Sparkles className="size-4 text-primary" /> AI 生成
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-card p-4 card-shadow">
        <div className="flex items-baseline justify-between">
          <p className="text-headline">
            {done} / {optimistic.length} <span className="text-subhead font-normal text-muted-foreground">已准备</span>
          </p>
          {canEdit && (
            <button type="button" onClick={() => start(() => resetChecks(tripId))} className="flex items-center gap-1 text-footnote text-primary">
              <RotateCcw className="size-3.5" /> 全部重置
            </button>
          )}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-fill">
          <div
            className="h-full origin-left rounded-full bg-ios-green transition-transform duration-200 ease-[var(--ease-in-out)]"
            style={{ transform: `scaleX(${done / optimistic.length})` }}
          />
        </div>
      </div>

      {groups.map((g) => (
        <section key={g} className="rounded-2xl bg-card card-shadow">
          <h2 className="px-4 pt-3 text-footnote font-semibold uppercase tracking-wide text-muted-foreground">{g}</h2>
          <ul className="divide-y divide-border/60">
            <AnimatePresence initial={false}>
              {optimistic
                .filter((i) => i.group === g)
                .map((i) => (
                  <motion.li key={i.id} layout exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 px-4 py-2.5">
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() =>
                        start(async () => {
                          setOptimistic({ id: i.id, checked: !i.checked });
                          await toggleChecklistItem(tripId, i.id, !i.checked);
                        })
                      }
                      className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors", i.checked ? "border-ios-green bg-ios-green text-white" : "border-label-tertiary")}
                      aria-label={i.checked ? "取消勾选" : "勾选"}
                    >
                      {i.checked && <Check className="size-3.5" strokeWidth={3} />}
                    </button>
                    <span className={cn("flex-1 text-callout", i.checked && "text-muted-foreground line-through")}>{i.text}</span>
                    {canEdit && (
                      <button type="button" onClick={() => start(() => deleteChecklistItem(tripId, i.id))} className="rounded-full p-1.5 text-label-tertiary active:bg-fill" aria-label="删除">
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </motion.li>
                ))}
            </AnimatePresence>
          </ul>
          {canEdit && (
            <div className="px-4 pb-3 pt-1">
              {adding === g ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const t = text;
                    setText("");
                    setAdding(null);
                    start(() => addChecklistItem(tripId, g, t));
                  }}
                >
                  <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="添加物品" className="h-9 rounded-lg bg-fill-secondary" />
                  <Button type="submit" size="sm" className="h-9 rounded-lg">
                    添加
                  </Button>
                </form>
              ) : (
                <button type="button" onClick={() => setAdding(g)} className="flex items-center gap-1 text-footnote text-primary">
                  <Plus className="size-3.5" /> 添加
                </button>
              )}
            </div>
          )}
        </section>
      ))}

      {canEdit && (
        <div className="flex gap-2">
          <Button variant="secondary" className="h-10 flex-1 rounded-xl" onClick={() => setAdding("新分组")}>
            <Plus className="size-4" /> 新分组
          </Button>
          {aiConfigured && (
            <Button
              variant="secondary"
              disabled={pending}
              className="h-10 flex-1 rounded-xl"
              onClick={() =>
                start(async () => {
                  const r = await generatePackingList(tripId);
                  if (r.error) toast.error(r.error);
                  else toast.success(`已追加 ${r.count} 项`);
                })
              }
            >
              <Sparkles className="size-4 text-primary" /> AI 补充
            </Button>
          )}
        </div>
      )}
      {adding === "新分组" && (
        <form
          className="flex gap-2 rounded-2xl bg-card p-3 card-shadow"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const g = String(fd.get("group") ?? "");
            const t = String(fd.get("text") ?? "");
            setAdding(null);
            start(() => addChecklistItem(tripId, g, t));
          }}
        >
          <Input name="group" autoFocus placeholder="分组名" className="h-9 w-28 rounded-lg bg-fill-secondary" />
          <Input name="text" placeholder="物品" className="h-9 flex-1 rounded-lg bg-fill-secondary" />
          <Button type="submit" size="sm" className="h-9 rounded-lg">
            添加
          </Button>
        </form>
      )}
    </div>
  );
}
