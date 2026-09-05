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
import { createEntry, updateEntry, type ActionState } from "@/app/(app)/trips/[tripId]/actions";
import type { TEntry } from "@/components/timeline/types";
import { Field, SelectField, ErrorText } from "./form-bits";
import { useOfflineForm, useOnline } from "@/lib/offline/use-offline-form";

export type StopOption = { id: string; name: string; arriveAt: Date };

export function EntryForm({
  tripId,
  type,
  stops,
  homeCurrency,
  defaultTime,
  defaultStopId,
  onDone,
  initial,
  tz,
}: {
  tripId: string;
  type: EntryType;
  stops: StopOption[];
  homeCurrency: string;
  defaultTime: Date;
  defaultStopId?: string;
  onDone: () => void;
  initial?: TEntry & { stopId?: string | null };
  tz?: string | null;
}) {
  const cfg = ENTRY_TYPES[type];
  const bound = initial ? updateEntry.bind(null, tripId, initial.id) : createEntry.bind(null, tripId);
  const [state, action, pending] = useActionState<ActionState, FormData>(bound, undefined);
  const [meta, setMeta] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(initial?.meta ?? {}).map(([k, v]) => [k, v == null ? "" : String(v)]))
  );
  const [withExpense, setWithExpense] = useState(!initial && type !== "MOMENT");
  const [isBaby, setIsBaby] = useState(false);
  const online = useOnline();
  const submit = useOfflineForm({
    kind: "entry",
    tripId,
    action,
    summarize: (fd) => `${cfg.label}：${fd.get("title") ?? ""}`,
    onDoneQueued: onDone,
    // 编辑已有条目不能离线排队（回放接口只支持新建）
    disabled: Boolean(initial),
  });

  useEffect(() => {
    if (state?.ok) {
      toast.success(initial ? "已更新" : `已记录${cfg.label}`);
      onDone();
    }
  }, [state, onDone, cfg.label, initial]);

  const metaJson = useMemo(() => JSON.stringify(Object.fromEntries(Object.entries(meta).filter(([, v]) => v !== ""))), [meta]);

  return (
    <form action={submit} className="flex flex-col gap-4">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="meta" value={metaJson} />
      <input type="hidden" name="category" value={cfg.defaultCategory} />

      <Field label="标题" name="title" required placeholder={placeholderFor(type)} defaultValue={initial?.title ?? ""} />

      <div className="grid grid-cols-2 gap-3">
        <Field label={type === "HOTEL" ? "入住" : "时间"} name="startAt" type="datetime-local" required defaultValue={fmt.inputDateTime(initial?.startAt ?? defaultTime, tz)} />
        <Field label={type === "HOTEL" ? "退房" : "结束（可选）"} name="endAt" type="datetime-local" defaultValue={initial?.endAt ? fmt.inputDateTime(initial.endAt, tz) : ""} />
      </div>

      {stops.length > 0 && (
        <SelectField
          label="关联站点"
          name="stopId"
          defaultValue={initial?.stopId ?? defaultStopId ?? ""}
          options={[{ value: "", label: "不关联" }, ...stops.map((s) => ({ value: s.id, label: `${s.name} · ${fmt.dateTime(s.arriveAt, tz)}` }))]}
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
        <Textarea id="entry-note" name="note" rows={2} className="rounded-xl bg-fill-secondary text-body" placeholder="想说点什么…" defaultValue={initial?.note ?? ""} />
      </div>

      {!initial && <div className="rounded-xl bg-fill-secondary p-3">
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
      </div>}

      <ErrorText>{state?.error}</ErrorText>
      <Button type="submit" disabled={pending} className="h-12 rounded-xl text-body font-semibold">
        {pending ? <Loader2 className="size-5 animate-spin" /> : initial ? "保存" : `${online ? "" : "离线"}记录${cfg.label}`}
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
