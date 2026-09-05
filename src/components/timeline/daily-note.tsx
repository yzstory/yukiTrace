"use client";

import { useState, useTransition } from "react";
import { NotebookPen, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { upsertDailyNote } from "@/app/(app)/trips/[tripId]/actions";
import { fmt } from "@/lib/date";

export function DailyNote({ tripId, date, note, canEdit }: { tripId: string; date: Date; note: string | null; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(note ?? "");
  const [pending, start] = useTransition();

  if (!editing) {
    if (!note && !canEdit) return null;
    return (
      <button
        type="button"
        disabled={!canEdit}
        onClick={() => setEditing(true)}
        className="mb-3 flex w-full items-start gap-2 rounded-2xl bg-ios-yellow/15 px-4 py-3 text-left"
      >
        <NotebookPen className="mt-0.5 size-4 shrink-0 text-ios-orange" />
        {note ? (
          <p className="whitespace-pre-wrap text-subhead text-foreground/90">{note}</p>
        ) : (
          <p className="text-subhead text-muted-foreground">今天怎么样？写一两句…</p>
        )}
      </button>
    );
  }
  return (
    <div className="mb-3 rounded-2xl bg-card p-3 card-shadow">
      <Textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        placeholder="今天怎么样？"
        className="rounded-xl bg-fill-secondary text-body"
      />
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
              await upsertDailyNote(tripId, fmt.inputDate(date), value);
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
