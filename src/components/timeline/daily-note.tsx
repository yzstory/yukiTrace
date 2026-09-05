"use client";

import { useState, useTransition } from "react";
import { NotebookPen, Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { upsertDailyNote } from "@/app/(app)/trips/[tripId]/actions";
import { generateDailyDraft, generateFamilyDigest } from "@/app/(app)/trips/[tripId]/ai-actions";
import { fmt } from "@/lib/date";

export function DailyNote({ tripId, date, note, aiDraft, canEdit, aiConfigured, hasContent, tz, multiMember }: { tripId: string; date: Date; note: string | null; aiDraft?: string | null; canEdit: boolean; aiConfigured?: boolean; hasContent?: boolean; tz?: string | null; multiMember?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(note ?? "");
  const [draft, setDraft] = useState(aiDraft ?? null);
  const [pending, start] = useTransition();
  const [drafting, startDraft] = useTransition();

  function askDigest() {
    startDraft(async () => {
      const r = await generateFamilyDigest(tripId, fmt.inputDate(date, tz));
      if (r.error) {
        toast.error(r.error);
        return;
      }
      setDraft(r.draft!);
      setEditing(true);
    });
  }

  function askDraft(tone: "default" | "to_baby") {
    startDraft(async () => {
      const r = await generateDailyDraft(tripId, fmt.inputDate(date, tz), tone);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      setDraft(r.draft!);
      setEditing(true);
    });
  }

  if (!editing) {
    if (!note && !canEdit) return null;
    return (
      <div className="mb-3 flex gap-2">
        <button type="button" disabled={!canEdit} onClick={() => setEditing(true)} className="flex min-w-0 flex-1 items-start gap-2 rounded-2xl bg-ios-yellow/15 px-4 py-3 text-left">
          <NotebookPen className="mt-0.5 size-4 shrink-0 text-ios-orange" />
          {note ? <p className="whitespace-pre-wrap text-subhead text-foreground/90">{note}</p> : <p className="text-subhead text-muted-foreground">今天怎么样？写一两句…</p>}
        </button>
        {canEdit && aiConfigured && hasContent && !note && (
          <button type="button" disabled={drafting} onClick={() => askDraft("default")} className="flex shrink-0 items-center gap-1 self-start rounded-2xl bg-card px-3 py-3 text-footnote font-medium text-primary card-shadow" aria-label="AI 生成日记草稿">
            {drafting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} 草稿
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="mb-3 rounded-2xl bg-card p-3 card-shadow">
      <Textarea autoFocus value={value} onChange={(e) => setValue(e.target.value)} rows={4} placeholder="今天怎么样？" className="rounded-xl bg-fill-secondary text-body" />
      {draft && draft !== value && (
        <div className="mt-2 rounded-xl bg-primary/8 p-3">
          <p className="mb-1 flex items-center gap-1 text-caption font-medium text-primary">
            <Sparkles className="size-3" /> AI 草稿
          </p>
          <p className="whitespace-pre-wrap text-subhead text-foreground/85">{draft}</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="secondary" className="rounded-lg" onClick={() => setValue(draft)}>
              采用
            </Button>
            <Button size="sm" variant="ghost" className="rounded-lg" disabled={drafting} onClick={() => askDraft("to_baby")}>
              {drafting ? <Loader2 className="size-4 animate-spin" /> : "换成写给宝宝的口吻"}
            </Button>
            {multiMember && (
              <Button size="sm" variant="ghost" className="rounded-lg" disabled={drafting} onClick={askDigest}>
                合成全家的
              </Button>
            )}
          </div>
        </div>
      )}
      {!draft && aiConfigured && hasContent && (
        <button type="button" disabled={drafting} onClick={() => askDraft("default")} className="mt-2 flex items-center gap-1 text-footnote font-medium text-primary">
          {drafting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} 让 AI 起个草稿
        </button>
      )}
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" size="sm" className="rounded-lg" onClick={() => setEditing(false)}>
          取消
        </Button>
        <Button
          size="sm"
          className="rounded-lg"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await upsertDailyNote(tripId, fmt.inputDate(date, tz), value);
              setEditing(false);
              toast.success("已保存日记");
            })
          }
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} 保存
        </Button>
      </div>
    </div>
  );
}
