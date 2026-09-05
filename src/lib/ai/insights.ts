import "server-only";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/currency";
import { EXPENSE_CATEGORIES } from "@/lib/entry-types";
import { tripDays } from "@/lib/date";
import type { ExpenseCategory } from "@/generated/prisma/enums";

export type Insight = { tone: "neutral" | "up" | "down" | "warn"; text: string };

/**
 * 纯统计得出的洞察，不调用模型：稳定、免费、可解释。
 * AI 只在用户主动提问时介入。
 */
export async function tripInsights(tripId: string): Promise<Insight[]> {
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    include: { expenses: { select: { amountCnyMinor: true, amountHomeMinor: true, category: true, isBaby: true, paidAt: true, title: true, currency: true, amountMinor: true } } },
  });
  if (!trip || trip.expenses.length === 0) return [];

  const out: Insight[] = [];
  const days = tripDays(trip.startDate, trip.endDate);
  const total = trip.expenses.reduce((a, e) => a + e.amountCnyMinor, 0);
  const perDay = Math.round(total / Math.max(days, 1));

  // 与上一段旅程比日均
  const prev = await db.trip.findFirst({
    where: { ownerId: trip.ownerId, startDate: { lt: trip.startDate }, NOT: { id: tripId } },
    orderBy: { startDate: "desc" },
    include: { expenses: { select: { amountCnyMinor: true } } },
  });
  if (prev && prev.expenses.length > 0) {
    const prevTotal = prev.expenses.reduce((a, e) => a + e.amountCnyMinor, 0);
    const prevPerDay = Math.round(prevTotal / Math.max(tripDays(prev.startDate, prev.endDate), 1));
    if (prevPerDay > 0) {
      const diff = Math.round(((perDay - prevPerDay) / prevPerDay) * 100);
      if (Math.abs(diff) >= 15) {
        out.push({
          tone: diff > 0 ? "up" : "down",
          text: `日均 ${formatMoney(perDay, "CNY", { compact: true })}，比「${prev.title}」${diff > 0 ? "高" : "低"} ${Math.abs(diff)}%`,
        });
      }
    }
  }

  // 占比最高的分类
  const byCat = new Map<ExpenseCategory, number>();
  trip.expenses.forEach((e) => byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amountCnyMinor));
  const top = Array.from(byCat).sort((a, b) => b[1] - a[1])[0];
  if (top && total > 0) {
    const pct = Math.round((top[1] / total) * 100);
    if (pct >= 40) out.push({ tone: "neutral", text: `${EXPENSE_CATEGORIES[top[0]].label}占了 ${pct}%，是这趟的大头` });
  }

  // 宝宝相关占比
  const baby = trip.expenses.filter((e) => e.isBaby).reduce((a, e) => a + e.amountCnyMinor, 0);
  if (baby > 0 && total > 0) {
    out.push({ tone: "neutral", text: `${trip.babyName ?? "宝宝"}相关 ${formatMoney(baby, "CNY", { compact: true })}，占 ${Math.round((baby / total) * 100)}%` });
  }

  // 疑似重复记账：同名同额且 30 分钟内
  const sorted = [...trip.expenses].sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime());
  const dupes = sorted.filter((e, i) => {
    const p = sorted[i - 1];
    return p && p.title === e.title && p.amountMinor === e.amountMinor && e.paidAt.getTime() - p.paidAt.getTime() < 30 * 60_000;
  });
  if (dupes.length > 0) out.push({ tone: "warn", text: `有 ${dupes.length} 笔疑似重复：${dupes.slice(0, 2).map((d) => d.title).join("、")}` });

  // 单笔异常：超过日均 3 倍
  const big = trip.expenses.filter((e) => e.amountCnyMinor > perDay * 3).sort((a, b) => b.amountCnyMinor - a.amountCnyMinor)[0];
  if (big && perDay > 0) out.push({ tone: "neutral", text: `最大一笔是「${big.title}」${formatMoney(big.amountMinor, big.currency, { showCode: true })}` });

  return out.slice(0, 4);
}
