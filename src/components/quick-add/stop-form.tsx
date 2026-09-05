"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { STOP_TYPES, BABY_TAGS } from "@/lib/entry-types";
import { fmt, TIMEZONES } from "@/lib/date";
import { StopType } from "@/generated/prisma/enums";
import { createStop, updateStop, type ActionState } from "@/app/(app)/trips/[tripId]/actions";
import type { TStop } from "@/components/timeline/types";
import { PlaceSearch, type PlacePick } from "./place-search";
import { Field, SelectField, ErrorText } from "./form-bits";
import { cn } from "@/lib/utils";

export function StopForm({ tripId, defaultTime, onDone, initial, tripTz }: { tripId: string; defaultTime: Date; onDone: () => void; initial?: TStop; tripTz: string }) {
  const bound = initial ? updateStop.bind(null, tripId, initial.id) : createStop.bind(null, tripId);
  const [state, action, pending] = useActionState<ActionState, FormData>(bound, undefined);
  const initialPlace: PlacePick | null = initial ? { name: initial.name, lat: initial.lat, lng: initial.lng, address: initial.address ?? undefined, city: initial.city ?? undefined } : null;
  const [place, setPlace] = useState<PlacePick | null>(initialPlace);
  const [tags, setTags] = useState<string[]>(initial?.babyTags ?? []);
  const [tz, setTz] = useState(initial?.timezone ?? "");
  const activeTz = tz || tripTz;

  useEffect(() => {
    if (state?.ok) {
      toast.success(initial ? "已更新站点" : "已添加站点");
      onDone();
    }
  }, [state, onDone, initial]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <PlaceSearch onPick={setPlace} initial={initialPlace} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="类型"
          name="type"
          defaultValue={initial?.type ?? "OTHER"}
          options={Object.values(StopType).map((t) => ({ value: t, label: STOP_TYPES[t].label }))}
        />
        <Field label="到达时间" name="arriveAt" type="datetime-local" required defaultValue={fmt.inputDateTime(initial?.arriveAt ?? defaultTime, initial?.timezone ?? tripTz)} />
      </div>
      <Field label="离开时间（可选）" name="leaveAt" type="datetime-local" defaultValue={initial?.leaveAt ? fmt.inputDateTime(initial.leaveAt, initial?.timezone ?? tripTz) : ""} />
      <SelectField
        label="时区"
        name="timezone"
        value={tz}
        onChange={(e) => setTz(e.target.value)}
        options={[{ value: "", label: `跟随旅程（${TIMEZONES.find((t) => t.value === tripTz)?.label ?? tripTz}）` }, ...TIMEZONES]}
      />
      <p className="-mt-2 text-caption text-muted-foreground">跨时区旅行时，这一站的时间会按所选时区显示与录入。当前按 {TIMEZONES.find((t) => t.value === activeTz)?.label ?? activeTz}。</p>

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
        <Textarea id="stop-note" name="note" rows={2} className="rounded-xl bg-fill-secondary text-body" placeholder="这里怎么样？" defaultValue={initial?.note ?? ""} />
      </div>
      <ErrorText>{state?.error}</ErrorText>
      <Button type="submit" disabled={pending || !place} className="h-12 rounded-xl text-body font-semibold">
        {pending ? <Loader2 className="size-5 animate-spin" /> : initial ? "保存" : "添加站点"}
      </Button>
    </form>
  );
}
