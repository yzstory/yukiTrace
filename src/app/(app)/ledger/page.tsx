import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { formatMoney } from "@/lib/currency";
import { EXPENSE_CATEGORIES } from "@/lib/entry-types";
import { fmt, tripDays } from "@/lib/date";
import type { ExpenseCategory } from "@/generated/prisma/enums";

export const metadata = { title: "账本" };

export default async function LedgerPage() {
  const { userId } = await verifySession();
  const trips = await db.trip.findMany({
    where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    orderBy: { startDate: "desc" },
    include: { expenses: { select: { amountHomeMinor: true, amountCnyMinor: true, category: true, isBaby: true, paidAt: true } } },
  });

  // 跨旅程统一按人民币汇总（每笔花费落库时已折算 amountCnyMinor）
  const year = new Date().getFullYear();
  const all = trips.flatMap((t) => t.expenses);
  const total = all.reduce((a, e) => a + e.amountCnyMinor, 0);
  const thisYear = all.filter((e) => e.paidAt.getFullYear() === year).reduce((a, e) => a + e.amountCnyMinor, 0);
  const baby = all.filter((e) => e.isBaby).reduce((a, e) => a + e.amountCnyMinor, 0);
  const byCat = new Map<ExpenseCategory, number>();
  all.forEach((e) => byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amountCnyMinor));
  const cats = Array.from(byCat.entries()).sort((a, b) => b[1] - a[1]);
  const maxCat = cats[0]?.[1] ?? 1;

  return (
    <>
      <PageHeader title="账本" subtitle="All trips" />
      <section className="rounded-3xl bg-card p-5 card-shadow">
        <p className="eyebrow">{year} · Travel spend</p>
        <p className="mt-1 display-number text-[2.75rem] leading-none">{formatMoney(thisYear, "CNY")}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/60 pt-4">
          <Kpi label="累计" value={formatMoney(total, "CNY", { compact: true })} />
          <Kpi label="宝宝相关" value={formatMoney(baby, "CNY", { compact: true })} />
          <Kpi label="旅程" value={`${trips.length} 段`} />
        </div>
      </section>

      {cats.length > 0 && (
        <section className="mt-4 rounded-2xl bg-card p-4 card-shadow">
          <h2 className="mb-3 text-footnote font-semibold uppercase tracking-wide text-muted-foreground">累计按分类</h2>
          <ul className="flex flex-col gap-2.5">
            {cats.map(([c, amount]) => {
              const cfg = EXPENSE_CATEGORIES[c];
              const Icon = cfg.icon;
              return (
                <li key={c} className="grid grid-cols-[1.25rem_3.5rem_1fr_auto] items-center gap-2 text-subhead">
                  <Icon className="size-4" style={{ color: cfg.color }} />
                  <span className="text-muted-foreground">{cfg.label}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-fill">
                    <span className="block h-full rounded-full" style={{ width: `${(amount / maxCat) * 100}%`, background: cfg.color }} />
                  </span>
                  <span className="tabular-nums">{formatMoney(amount, "CNY", { compact: true })}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <h2 className="mb-2 mt-6 px-1 text-footnote font-semibold uppercase tracking-wide text-muted-foreground">按旅程</h2>
      <ul className="flex flex-col gap-2">
        {trips.map((t) => {
          const sum = t.expenses.reduce((a, e) => a + e.amountHomeMinor, 0);
          const days = tripDays(t.startDate, t.endDate);
          return (
            <li key={t.id}>
              <Link href={`/trips/${t.id}/ledger`} className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 card-shadow">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-callout font-medium">{t.title}</span>
                  <span className="block text-caption text-muted-foreground">
                    {fmt.monthYear(t.startDate)} · {days} 天 · 日均 {formatMoney(Math.round(sum / days), t.homeCurrency, { compact: true })}
                  </span>
                </span>
                <span className="text-callout font-semibold tabular-nums">{formatMoney(sum, t.homeCurrency)}</span>
                <ChevronRight className="size-4 text-label-tertiary" />
              </Link>
            </li>
          );
        })}
        {trips.length === 0 && <li className="rounded-2xl bg-card px-4 py-8 text-center text-subhead text-muted-foreground card-shadow">还没有旅程</li>}
      </ul>
    </>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-caption text-muted-foreground">{label}</p>
      <p className="text-headline">{value}</p>
    </div>
  );
}
