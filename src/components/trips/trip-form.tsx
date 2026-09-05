"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CURRENCIES } from "@/lib/currency";
import { fmt, TIMEZONES, DEFAULT_TZ } from "@/lib/date";
import type { ActionState } from "@/app/(app)/trips/actions";

export type TripFormValues = {
  title?: string;
  description?: string | null;
  startDate?: Date | string;
  endDate?: Date | string;
  homeCurrency?: string;
  timezone?: string;
  babyName?: string | null;
  babyBirthDate?: Date | string | null;
  travelers?: string[];
};

export function TripForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  initial?: TripFormValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);
  const today = fmt.inputDate(new Date());

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5"
    >
      <Section title="基本信息">
        <Field label="旅程名称" name="title" required placeholder="北海道 · 秋" defaultValue={initial?.title} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="开始日期" name="startDate" type="date" required defaultValue={initial?.startDate ? fmt.inputDate(initial.startDate) : today} />
          <Field label="结束日期" name="endDate" type="date" required defaultValue={initial?.endDate ? fmt.inputDate(initial.endDate) : today} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-footnote font-medium text-muted-foreground">时区</Label>
          <select
            name="timezone"
            defaultValue={initial?.timezone ?? DEFAULT_TZ}
            className="h-11 rounded-xl border border-input bg-fill-secondary px-3 text-body outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {TIMEZONES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <p className="text-caption text-muted-foreground">所有时间按这个时区显示。个别站点可单独设置时区。</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-footnote font-medium text-muted-foreground">主币种</Label>
          <select
            name="homeCurrency"
            defaultValue={initial?.homeCurrency ?? "CNY"}
            className="h-11 rounded-xl border border-input bg-fill-secondary px-3 text-body outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description" className="text-footnote font-medium text-muted-foreground">
            一句话描述
          </Label>
          <Textarea
            id="description"
            name="description"
            rows={2}
            placeholder="宝宝第一次坐飞机"
            defaultValue={initial?.description ?? ""}
            className="rounded-xl bg-fill-secondary text-body"
          />
        </div>
      </Section>

      <Section title="同行人与宝宝">
        <Field
          label="同行人（逗号分隔）"
          name="travelers"
          placeholder="爸爸, 妈妈, 外婆"
          defaultValue={initial?.travelers?.join(", ")}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="宝宝昵称" name="babyName" placeholder="小汤圆" defaultValue={initial?.babyName ?? ""} />
          <Field
            label="宝宝生日"
            name="babyBirthDate"
            type="date"
            defaultValue={initial?.babyBirthDate ? fmt.inputDate(initial.babyBirthDate) : ""}
          />
        </div>
        <p className="text-caption text-muted-foreground">填写生日后，每一站都会显示宝宝当时的月龄。</p>
      </Section>

      {state?.error && (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-footnote text-destructive">{state.error}</p>
      )}

      <Button type="submit" disabled={pending} className="h-12 w-full rounded-xl text-body font-semibold">
        {pending ? <Loader2 className="size-5 animate-spin" /> : submitLabel}
      </Button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-4 card-shadow">
      <h2 className="mb-3 text-footnote font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Field({ label, name, ...rest }: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name} className="text-footnote font-medium text-muted-foreground">
        {label}
      </Label>
      <Input id={name} name={name} className="h-11 rounded-xl bg-fill-secondary text-body" {...rest} />
    </div>
  );
}
