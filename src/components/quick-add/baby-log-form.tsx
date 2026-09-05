"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Milk, Moon, Sun, Pill, Baby, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fmt } from "@/lib/date";
import { createBabyLog, type ActionState } from "@/app/(app)/trips/[tripId]/actions";
import { Field, ErrorText } from "./form-bits";
import { cn } from "@/lib/utils";
import type { BabyLogType } from "@/generated/prisma/enums";

export const BABY_LOG_TYPES: Record<BabyLogType, { label: string; icon: typeof Milk; color: string }> = {
  FEED: { label: "喂奶/吃饭", icon: Milk, color: "text-ios-orange" },
  DIAPER: { label: "换尿布", icon: Baby, color: "text-ios-teal" },
  SLEEP: { label: "睡了", icon: Moon, color: "text-ios-indigo" },
  WAKE: { label: "醒了", icon: Sun, color: "text-ios-yellow" },
  MEDICINE: { label: "吃药", icon: Pill, color: "text-ios-red" },
  OTHER: { label: "其他", icon: MoreHorizontal, color: "text-ios-gray" },
};

export function BabyLogForm({ tripId, defaultTime, onDone, tz }: { tripId: string; defaultTime: Date; onDone: () => void; tz?: string | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createBabyLog.bind(null, tripId), undefined);
  const [type, setType] = useState<BabyLogType>("FEED");
  useEffect(() => {
    if (state?.ok) {
      toast.success("已记录");
      onDone();
    }
  }, [state, onDone]);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="type" value={type} />
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(BABY_LOG_TYPES) as BabyLogType[]).map((t) => {
          const c = BABY_LOG_TYPES[t];
          const Icon = c.icon;
          const on = type === t;
          return (
            <button key={t} type="button" onClick={() => setType(t)} className={cn("pressable flex flex-col items-center gap-1.5 rounded-2xl py-3 text-footnote font-medium transition-[transform,background-color,color,box-shadow] duration-[160ms] ease-[var(--ease-out)]", on ? "bg-card shadow-sm ring-2 ring-primary/60" : "bg-fill-secondary text-muted-foreground")}>
              <Icon className={cn("size-6", c.color)} />
              {c.label}
            </button>
          );
        })}
      </div>
      <Field label="时间" name="at" type="datetime-local" required defaultValue={fmt.inputDateTime(defaultTime, tz)} />
      <Field label="备注（可选）" name="note" placeholder="180ml / 睁眼就笑" />
      <ErrorText>{state?.error}</ErrorText>
      <Button type="submit" disabled={pending} className="h-12 rounded-xl text-body font-semibold">
        {pending ? <Loader2 className="size-5 animate-spin" /> : "记录"}
      </Button>
    </form>
  );
}
