"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EXPENSE_CATEGORIES } from "@/lib/entry-types";
import { CURRENCIES } from "@/lib/currency";
import { fmt } from "@/lib/date";
import { ExpenseCategory } from "@/generated/prisma/enums";
import { createExpense, type ActionState } from "@/app/(app)/trips/[tripId]/actions";
import { Field, SelectField, ErrorText } from "./form-bits";
import type { StopOption } from "./entry-form";
import { cn } from "@/lib/utils";

export function ExpenseForm({
  tripId,
  stops,
  homeCurrency,
  defaultTime,
  defaultStopId,
  onDone,
}: {
  tripId: string;
  stops: StopOption[];
  homeCurrency: string;
  defaultTime: Date;
  defaultStopId?: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createExpense.bind(null, tripId), undefined);
  const [category, setCategory] = useState<ExpenseCategory>("FOOD");
  const [isBaby, setIsBaby] = useState(false);

  useEffect(() => {
    if (state?.ok) {
      toast.success("已记账");
      onDone();
    }
  }, [state, onDone]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Field label="金额" name="amount" type="number" inputMode="decimal" step="any" min="0" required placeholder="0.00" autoFocus className="[&_input]:text-title-2 [&_input]:h-14" />
        <SelectField label="货币" name="currency" defaultValue={homeCurrency} options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} ${c.symbol}` }))} className="[&_select]:h-14" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-footnote font-medium text-muted-foreground">分类</Label>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[])
            .filter((c) => c !== "BABY")
            .map((c) => {
              const cfg = EXPENSE_CATEGORIES[c];
              const Icon = cfg.icon;
              const on = category === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn("pressable flex flex-col items-center gap-1 rounded-xl py-2.5 text-caption font-medium transition-[transform,background-color,color,box-shadow] duration-[160ms] ease-[var(--ease-out)]", on ? "bg-card shadow-sm ring-2 ring-primary/60" : "bg-fill-secondary text-muted-foreground")}
                >
                  <Icon className="size-5" style={{ color: cfg.color }} />
                  {cfg.label}
                </button>
              );
            })}
        </div>
        <input type="hidden" name="category" value={category} />
      </div>

      <Field label="名称" name="title" required placeholder="拉面 / 打车 / 奶粉" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="时间" name="paidAt" type="datetime-local" required defaultValue={fmt.inputDateTime(defaultTime)} />
        {stops.length > 0 ? (
          <SelectField
            label="站点"
            name="stopId"
            defaultValue={defaultStopId ?? ""}
            options={[{ value: "", label: "不关联" }, ...stops.map((s) => ({ value: s.id, label: s.name }))]}
          />
        ) : (
          <div />
        )}
      </div>
      <div className="flex items-center justify-between rounded-xl bg-fill-secondary px-3 py-2.5">
        <Label className="text-callout">宝宝相关</Label>
        <Switch checked={isBaby} onCheckedChange={setIsBaby} />
        <input type="hidden" name="isBaby" value={isBaby ? "true" : "false"} />
      </div>
      <Field label="备注（可选）" name="note" />

      <ErrorText>{state?.error}</ErrorText>
      <Button type="submit" disabled={pending} className="h-12 rounded-xl text-body font-semibold">
        {pending ? <Loader2 className="size-5 animate-spin" /> : "记一笔"}
      </Button>
    </form>
  );
}
