"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ENTRY_TYPES } from "@/lib/entry-types";
import { CURRENCIES } from "@/lib/currency";
import { fmt } from "@/lib/date";
import type { EntryType } from "@/generated/prisma/enums";
import { createEntry, type ActionState } from "@/app/(app)/trips/[tripId]/actions";
import { Field, SelectField, ErrorText } from "./form-bits";

export type StopOption = { id: string; name: string; arriveAt: Date };

export function EntryForm({
  tripId,
  type,
  stops,
  homeCurrency,
  defaultTime,
  defaultStopId,
  onDone,
}: {
  tripId: string;
  type: EntryType;
  stops: StopOption[];
  homeCurrency: string;
  defaultTime: Date;
  defaultStopId?: string;
  onDone: () => void;
}) {
  const cfg = ENTRY_TYPES[type];
  const [state, action, pending] = useActionState<ActionState, FormData>(createEntry.bind(null, tripId), undefined);
  const [meta, setMeta] = useState<Record<string, string>>({});
  const [withExpense, setWithExpense] = useState(type !== "MOMENT");
  const [isBaby, setIsBaby] = useState(false);

  useEffect(() => {
    if (state?.ok) {
      toast.success(`已记录${cfg.label}`);
      onDone();
    }
  }, [state, onDone, cfg.label]);

  const metaJson = useMemo(() => JSON.stringify(Object.fromEntries(Object.entries(meta).filter(([, v]) => v !== ""))), [meta]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="meta" value={metaJson} />
      <input type="hidden" name="category" value={cfg.defaultCategory} />

      <Field label="标题" name="title" required placeholder={placeholderFor(type)} autoFocus />

      <div className="grid grid-cols-2 gap-3">
        <Field label={type === "HOTEL" ? "入住" : "时间"} name="startAt" type="datetime-local" required defaultValue={fmt.inputDateTime(defaultTime)} />
        <Field label={type === "HOTEL" ? "退房" : "结束（可选）"} name="endAt" type="datetime-local" />
      </div>

      {stops.length > 0 && (
        <SelectField
          label="关联站点"
          name="stopId"
          defaultValue={defaultStopId ?? ""}
          options={[{ value: "", label: "不关联" }, ...stops.map((s) => ({ value: s.id, label: `${s.name} · ${fmt.dateTime(s.arriveAt)}` }))]}
        />
      )}

      {cfg.fields.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {cfg.fields.map((f) => (
            <Field
              key={f.key}
              label={f.label}
              name={`meta_${f.key}`}
              type={f.type ?? "text"}
              placeholder={f.placeholder}
              value={meta[f.key] ?? ""}
              onChange={(e) => setMeta((m) => ({ ...m, [f.key]: e.target.value }))}
              className={f.key === "from" || f.key === "to" || f.key.endsWith("Place") ? "" : "col-span-2"}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="entry-note" className="text-footnote font-medium text-muted-foreground">
          备注
        </Label>
        <Textarea id="entry-note" name="note" rows={2} className="rounded-xl bg-fill-secondary text-body" placeholder="想说点什么…" />
      </div>

      <div className="rounded-xl bg-fill-secondary p-3">
        <div className="flex items-center justify-between">
          <Label className="text-callout">同时记一笔花费</Label>
          <Switch checked={withExpense} onCheckedChange={setWithExpense} />
        </div>
        {withExpense && (
          <div className="mt-3 flex flex-col gap-3">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Field label="金额" name="amount" type="number" inputMode="decimal" step="any" min="0" placeholder="0.00" />
              <SelectField
                label="货币"
                name="currency"
                defaultValue={homeCurrency}
                options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} ${c.symbol}` }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-subhead text-muted-foreground">宝宝相关</Label>
              <Switch checked={isBaby} onCheckedChange={setIsBaby} />
              <input type="hidden" name="isBaby" value={isBaby ? "true" : "false"} />
            </div>
          </div>
        )}
      </div>

      <ErrorText>{state?.error}</ErrorText>
      <Button type="submit" disabled={pending} className="h-12 rounded-xl text-body font-semibold">
        {pending ? <Loader2 className="size-5 animate-spin" /> : `记录${cfg.label}`}
      </Button>
    </form>
  );
}

function placeholderFor(type: EntryType) {
  switch (type) {
    case "FLIGHT":
      return "上海 → 札幌";
    case "CAR_RENTAL":
      return "新千岁机场取车";
    case "TRAIN":
      return "札幌 → 小樽";
    case "TAXI":
      return "酒店 → 狸小路";
    case "HOTEL":
      return "札幌格兰大酒店";
    case "MEAL":
      return "汤咖喱";
    case "ACTIVITY":
      return "旭山动物园";
    case "SHOPPING":
      return "药妆店";
    default:
      return "宝宝第一次看到雪";
  }
}
