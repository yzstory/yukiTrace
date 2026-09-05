"use client";

import { useMemo, useState, useTransition } from "react";
import { Baby, Trash2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { toast } from "sonner";
import { formatMoney, fromMinor } from "@/lib/currency";
import { EXPENSE_CATEGORIES } from "@/lib/entry-types";
import { fmt } from "@/lib/date";
import type { ExpenseCategory } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

export type LedgerExpense = {
  id: string;
  title: string;
  amountMinor: number;
  currency: string;
  amountHomeMinor: number;
  category: ExpenseCategory;
  isBaby: boolean;
  paidAt: Date;
  dayIndex: number;
  stopName: string | null;
  tripId: string;
  tripTitle?: string;
};

export type LedgerDay = { index: number; date: Date };

export function LedgerView({
  expenses,
  days,
  homeCurrency,
  canEdit,
  onDelete,
  showTrip,
  timezone,
}: {
  expenses: LedgerExpense[];
  days: LedgerDay[];
  homeCurrency: string;
  canEdit: boolean;
  onDelete?: (tripId: string, id: string) => Promise<void>;
  showTrip?: boolean;
  timezone?: string;
}) {
  const [babyOnly, setBabyOnly] = useState(false);
  const [cat, setCat] = useState<ExpenseCategory | null>(null);
  const [pending, start] = useTransition();

  const filtered = useMemo(() => expenses.filter((e) => (!babyOnly || e.isBaby) && (!cat || e.category === cat)), [expenses, babyOnly, cat]);
  const total = filtered.reduce((a, e) => a + e.amountHomeMinor, 0);
  const totalAll = expenses.reduce((a, e) => a + e.amountHomeMinor, 0);
  const babyTotal = expenses.filter((e) => e.isBaby).reduce((a, e) => a + e.amountHomeMinor, 0);
  const dayCount = Math.max(days.length, 1);

  const byCategory = useMemo(() => {
    const m = new Map<ExpenseCategory, number>();
    for (const e of expenses.filter((e) => !babyOnly || e.isBaby)) m.set(e.category, (m.get(e.category) ?? 0) + e.amountHomeMinor);
    return (Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[]).map((c) => ({ category: c, amount: m.get(c) ?? 0 })).filter((x) => x.amount > 0).sort((a, b) => b.amount - a.amount);
  }, [expenses, babyOnly]);
  const maxCat = byCategory[0]?.amount ?? 1;

  const byDay = useMemo(
    () =>
      days.map((d) => ({
        name: `D${d.index}`,
        label: fmt.date(d.date, timezone),
        amount: fromMinor(filtered.filter((e) => e.dayIndex === d.index).reduce((a, e) => a + e.amountHomeMinor, 0), homeCurrency),
      })),
    [days, filtered, homeCurrency, timezone]
  );

  const byCurrency = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of filtered) m.set(e.currency, (m.get(e.currency) ?? 0) + e.amountMinor);
    return Array.from(m.entries()).filter(([c]) => c !== homeCurrency);
  }, [filtered, homeCurrency]);

  const grouped = useMemo(() => {
    const m = new Map<number, LedgerExpense[]>();
    for (const e of [...filtered].sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime())) m.set(e.dayIndex, [...(m.get(e.dayIndex) ?? []), e]);
    return Array.from(m.entries()).sort((a, b) => b[0] - a[0]);
  }, [filtered]);

  return (
    <div className="flex flex-col gap-5">
      {/* 英雄数字 */}
      <section className="rounded-3xl bg-card p-5 card-shadow">
        <p className="text-footnote font-medium text-muted-foreground">{cat || babyOnly ? "筛选后合计" : "总花费"}</p>
        <p className="mt-1 text-[2.5rem] font-bold leading-none tracking-tight">{formatMoney(total, homeCurrency)}</p>
        {byCurrency.length > 0 && (
          <p className="mt-2 text-caption text-muted-foreground">含 {byCurrency.map(([c, m]) => formatMoney(m, c, { showCode: true })).join(" · ")}</p>
        )}
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/60 pt-4">
          <Kpi label="日均" value={formatMoney(Math.round(totalAll / dayCount), homeCurrency, { compact: true })} />
          <Kpi label="宝宝相关" value={formatMoney(babyTotal, homeCurrency, { compact: true })} sub={totalAll ? `${Math.round((babyTotal / totalAll) * 100)}%` : undefined} />
          <Kpi label="笔数" value={String(expenses.length)} />
        </div>
      </section>

      {/* 筛选：一行 */}
      <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5">
        <FilterChip active={!cat && !babyOnly} onClick={() => { setCat(null); setBabyOnly(false); }} label="全部" />
        <FilterChip active={babyOnly} onClick={() => setBabyOnly((v) => !v)} label="宝宝" icon={<Baby className="size-3.5" />} />
        {byCategory.filter(({ category }) => category !== "BABY").map(({ category }) => (
          <FilterChip key={category} active={cat === category} onClick={() => setCat((c) => (c === category ? null : category))} label={EXPENSE_CATEGORIES[category].label} />
        ))}
      </div>

      {/* 分类：条形列表（直接标注，图标+文字作为第二编码） */}
      {byCategory.length > 0 && (
        <section className="rounded-2xl bg-card p-4 card-shadow">
          <h2 className="mb-3 text-footnote font-semibold uppercase tracking-wide text-muted-foreground">按分类</h2>
          <ul className="flex flex-col gap-2.5">
            {byCategory.map(({ category, amount }) => {
              const c = EXPENSE_CATEGORIES[category];
              const Icon = c.icon;
              const pct = Math.round((amount / (totalAll || 1)) * 100);
              return (
                <li key={category} className="grid grid-cols-[1.25rem_3.5rem_1fr_auto] items-center gap-2 text-subhead">
                  <Icon className="size-4" style={{ color: c.color }} />
                  <span className="text-muted-foreground">{c.label}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-fill">
                    <span className="block h-full rounded-full" style={{ width: `${(amount / maxCat) * 100}%`, background: c.color }} />
                  </span>
                  <span className="tabular-nums">
                    {formatMoney(amount, homeCurrency, { compact: true })} <span className="text-caption text-label-tertiary">{pct}%</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 按天：单序列柱状图 */}
      {days.length > 1 && (
        <section className="rounded-2xl bg-card p-4 card-shadow">
          <h2 className="mb-1 text-footnote font-semibold uppercase tracking-wide text-muted-foreground">按天</h2>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDay} margin={{ top: 8, right: 4, left: -20, bottom: 0 }} barCategoryGap="30%">
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--label-tertiary)" }} interval={byDay.length > 12 ? Math.ceil(byDay.length / 8) : 0} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--label-tertiary)" }} tickFormatter={(v: number) => (v >= 10000 ? `${(v / 10000).toFixed(0)}万` : String(v))} width={56} />
                <Tooltip
                  cursor={{ fill: "var(--fill)", radius: 6 }}
                  content={({ active, payload }) =>
                    active && payload?.[0] ? (
                      <div className="glass rounded-xl px-3 py-2 text-footnote">
                        <p className="text-muted-foreground">{(payload[0].payload as { label: string }).label}</p>
                        <p className="font-semibold tabular-nums">{formatMoney(Math.round((payload[0].value as number) * 100), homeCurrency)}</p>
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
                  {byDay.map((d, i) => (
                    <Cell key={i} fill={d.amount > 0 ? "var(--ios-blue)" : "var(--fill)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* 明细 */}
      <section className="flex flex-col gap-4">
        {grouped.length === 0 && <p className="rounded-2xl bg-card px-4 py-8 text-center text-subhead text-muted-foreground card-shadow">没有符合条件的花费</p>}
        {grouped.map(([dayIdx, list]) => {
          const day = days.find((d) => d.index === dayIdx);
          const sum = list.reduce((a, e) => a + e.amountHomeMinor, 0);
          return (
            <div key={dayIdx}>
              <div className="mb-1.5 flex items-baseline justify-between px-1">
                <h3 className="text-footnote font-semibold text-muted-foreground">
                  Day {dayIdx}
                  {day ? ` · ${fmt.date(day.date, timezone)}` : ""}
                </h3>
                <span className="text-footnote tabular-nums text-muted-foreground">{formatMoney(sum, homeCurrency)}</span>
              </div>
              <ul className="divide-y divide-border/60 rounded-2xl bg-card card-shadow">
                {list.map((e) => {
                  const c = EXPENSE_CATEGORIES[e.category];
                  const Icon = e.isBaby ? Baby : c.icon;
                  const foreign = e.currency !== homeCurrency;
                  return (
                    <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-fill">
                        <Icon className="size-[18px]" style={{ color: c.color }} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-callout">{e.title}</span>
                        <span className="block truncate text-caption text-muted-foreground">
                          {fmt.time(e.paidAt, timezone)}
                          {e.stopName ? ` · ${e.stopName}` : ""}
                          {showTrip && e.tripTitle ? ` · ${e.tripTitle}` : ""}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block text-callout font-medium tabular-nums">{formatMoney(e.amountMinor, e.currency, { showCode: foreign })}</span>
                        {foreign && <span className="block text-caption tabular-nums text-label-tertiary">≈ {formatMoney(e.amountHomeMinor, homeCurrency)}</span>}
                      </span>
                      {canEdit && onDelete && (
                        <button
                          type="button"
                          disabled={pending}
                          aria-label="删除"
                          onClick={() =>
                            start(async () => {
                              await onDelete(e.tripId, e.id);
                              toast.success("已删除");
                            })
                          }
                          className="-mr-2 rounded-full p-2 text-label-tertiary active:bg-fill"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-caption text-muted-foreground">{label}</p>
      <p className="text-headline">
        {value} {sub && <span className="text-caption font-normal text-label-tertiary">{sub}</span>}
      </p>
    </div>
  );
}

function FilterChip({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-footnote font-medium transition-colors", active ? "bg-foreground text-background" : "bg-card text-muted-foreground card-shadow")}>
      {icon}
      {label}
    </button>
  );
}
