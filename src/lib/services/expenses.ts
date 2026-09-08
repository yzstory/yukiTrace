import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { auditedDb } from "@/lib/activity";
import { assertTripAccess } from "@/lib/access";
import { badRequest, notFound } from "@/lib/api/errors";
import { ExpenseCategory } from "@/generated/prisma/enums";
import { CURRENCIES, toMinor, convertMinor, FALLBACK_RATES_TO_CNY } from "@/lib/currency";
import { parseInTz } from "@/lib/date";
import { flag, optStr, reqStr, type Input } from "./input";
import { entryTz, parse, refreshTrip, scheduleReindex, type Actor } from "./shared";

const expenseSchema = z.object({
  title: reqStr("请填写名称", 120),
  amount: reqStr("请填写金额", 30),
  currency: optStr,
  category: z.nativeEnum(ExpenseCategory).default("OTHER"),
  isBaby: flag.default(false),
  paidAt: reqStr("请选择时间"),
  stopId: optStr,
  entryId: optStr,
  note: optStr,
  rate: optStr,
});
export type ExpenseInput = z.input<typeof expenseSchema>;

/** 汇率：DB 缓存 → 免费 API → 离线兜底 */
export async function getRate(from: string, to: string, at: Date): Promise<number> {
  if (from === to) return 1;
  const day = new Date(Date.UTC(at.getFullYear(), at.getMonth(), at.getDate()));
  const cached = await db.exchangeRate.findUnique({ where: { date_base_quote: { date: day, base: from, quote: to } } });
  if (cached) return cached.rate;
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const json = (await res.json()) as { rates: Record<string, number> };
      const rate = json.rates[to];
      if (rate) {
        await db.exchangeRate.upsert({
          where: { date_base_quote: { date: day, base: from, quote: to } },
          update: { rate },
          create: { date: day, base: from, quote: to, rate },
        });
        return rate;
      }
    }
  } catch {
    /* fall through */
  }
  const f = FALLBACK_RATES_TO_CNY[from];
  const t = FALLBACK_RATES_TO_CNY[to];
  return f && t ? f / t : 1;
}

/** 组装一条花费的写入数据：币种校验、最小单位、主币种与人民币折算 */
export async function buildExpense(input: {
  tripId: string; userId: string; amount: string; currency?: string; category?: ExpenseCategory; isBaby: boolean;
  title: string; note?: string | null; paidAt: Date; stopId: string | null; entryId: string | null; rate?: number;
}) {
  const trip = await db.trip.findUnique({ where: { id: input.tripId }, select: { homeCurrency: true } });
  if (!trip) throw notFound("旅程不存在");
  const currency = input.currency && CURRENCIES.some((c) => c.code === input.currency) ? input.currency : trip.homeCurrency;
  const amountMinor = toMinor(input.amount, currency);
  if (!(amountMinor > 0)) throw badRequest("金额需要大于 0");
  const rate = input.rate ?? (await getRate(currency, trip.homeCurrency, input.paidAt));
  const amountHomeMinor = convertMinor(amountMinor, currency, trip.homeCurrency, rate);
  const cnyRate = currency === "CNY" ? 1 : await getRate(currency, "CNY", input.paidAt);
  const amountCnyMinor = convertMinor(amountMinor, currency, "CNY", cnyRate);
  return {
    tripId: input.tripId, stopId: input.stopId, entryId: input.entryId, paidById: input.userId,
    amountMinor, currency, amountHomeMinor, amountCnyMinor, rate,
    category: input.isBaby ? ("BABY" as ExpenseCategory) : (input.category ?? "OTHER"),
    isBaby: input.isBaby, title: input.title, note: input.note ?? null, paidAt: input.paidAt,
  };
}

export async function createExpense(actor: Actor, tripId: string, input: Input) {
  await assertTripAccess(actor.userId, tripId, "EDITOR");
  const d = parse(expenseSchema, input);
  const data = await buildExpense({
    tripId, userId: actor.userId, amount: d.amount, currency: d.currency || undefined, category: d.category, isBaby: d.isBaby,
    title: d.title, note: d.note || null, paidAt: parseInTz(d.paidAt, await entryTz(tripId, d.stopId || null)),
    stopId: d.stopId || null, entryId: d.entryId || null, rate: d.rate ? parseFloat(d.rate) : undefined,
  });
  const expense = await auditedDb({ tripId, userId: actor.userId }).expense.create({ data });
  refreshTrip(tripId);
  scheduleReindex(tripId);
  return { id: expense.id, amountHomeMinor: data.amountHomeMinor, currency: data.currency, rate: data.rate };
}

/** 整体替换一笔花费：币种、汇率与两种折算金额都按新值重算 */
export async function updateExpense(actor: Actor, tripId: string, expenseId: string, input: Input) {
  await assertTripAccess(actor.userId, tripId, "EDITOR");
  const existing = await db.expense.findFirst({ where: { id: expenseId, tripId }, select: { paidById: true } });
  if (!existing) throw notFound("花费不存在");
  const d = parse(expenseSchema, input);
  const built = await buildExpense({
    tripId, userId: actor.userId, amount: d.amount, currency: d.currency || undefined, category: d.category, isBaby: d.isBaby,
    title: d.title, note: d.note || null, paidAt: parseInTz(d.paidAt, await entryTz(tripId, d.stopId || null)),
    stopId: d.stopId || null, entryId: d.entryId || null, rate: d.rate ? parseFloat(d.rate) : undefined,
  });
  // 付款人保持原样：改一笔账不等于换人付钱
  const data = { ...built, paidById: existing.paidById };
  await auditedDb({ tripId, userId: actor.userId }).expense.update({ where: { id: expenseId, tripId }, data });
  refreshTrip(tripId);
  scheduleReindex(tripId);
  return { id: expenseId, amountHomeMinor: data.amountHomeMinor, currency: data.currency, rate: data.rate };
}

export async function deleteExpense(actor: Actor, tripId: string, expenseId: string) {
  await assertTripAccess(actor.userId, tripId, "EDITOR");
  await auditedDb({ tripId, userId: actor.userId }).expense.delete({ where: { id: expenseId, tripId } });
  refreshTrip(tripId);
}
