"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { STOP_TYPES, BABY_TAGS } from "@/lib/entry-types";
import { fmt } from "@/lib/date";
import { StopType } from "@/generated/prisma/enums";
import { createStop, type ActionState } from "@/app/(app)/trips/[tripId]/actions";
import { PlaceSearch, type PlacePick } from "./place-search";
import { Field, SelectField, ErrorText } from "./form-bits";
import { cn } from "@/lib/utils";

export function StopForm({ tripId, defaultTime, onDone }: { tripId: string; defaultTime: Date; onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createStop.bind(null, tripId), undefined);
  const [place, setPlace] = useState<PlacePick | null>(null);
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (state?.ok) {
      toast.success("已添加站点");
      onDone();
    }
  }, [state, onDone]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <PlaceSearch onPick={setPlace} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="类型"
          name="type"
          defaultValue="OTHER"
          options={Object.values(StopType).map((t) => ({ value: t, label: STOP_TYPES[t].label }))}
        />
        <Field label="到达时间" name="arriveAt" type="datetime-local" required defaultValue={fmt.inputDateTime(defaultTime)} />
      </div>
      <Field label="离开时间（可选）" name="leaveAt" type="datetime-local" />
      <div className="flex flex-col gap-1.5">
        <Label className="text-footnote font-medium text-muted-foreground">婴儿友好</Label>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(BABY_TAGS).map(([k, label]) => {
            const on = tags.includes(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => setTags((t) => (on ? t.filter((x) => x !== k) : [...t, k]))}
                className={cn("rounded-full px-3 py-1 text-footnote font-medium transition-colors", on ? "bg-ios-teal text-white" : "bg-fill text-muted-foreground")}
              >
                {label}
              </button>
            );
          })}
        </div>
        <input type="hidden" name="babyTags" value={tags.join(",")} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="stop-note" className="text-footnote font-medium text-muted-foreground">
          备注
        </Label>
        <Textarea id="stop-note" name="note" rows={2} className="rounded-xl bg-fill-secondary text-body" placeholder="这里怎么样？" />
      </div>
      <ErrorText>{state?.error}</ErrorText>
      <Button type="submit" disabled={pending || !place} className="h-12 rounded-xl text-body font-semibold">
        {pending ? <Loader2 className="size-5 animate-spin" /> : "添加站点"}
      </Button>
    </form>
  );
}
