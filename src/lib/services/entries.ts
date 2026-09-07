import "server-only";
import { z } from "zod";
import { auditedDb } from "@/lib/activity";
import { assertTripAccess } from "@/lib/access";
import { badRequest } from "@/lib/api/errors";
import { EntryType, ExpenseCategory } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import type { InputJsonValue } from "@/generated/prisma/internal/prismaNamespace";
import { parseInTz } from "@/lib/date";
import { flag, jsonObject, optStr, reqStr, type Input } from "./input";
import { entryTz, parse, refreshTrip, scheduleReindex, type Actor } from "./shared";
import { buildExpense } from "./expenses";

const entrySchema = z.object({
  type: z.nativeEnum(EntryType),
  title: reqStr("请填写标题", 120),
  stopId: optStr,
  note: optStr,
  startAt: reqStr("请选择时间"),
  endAt: optStr,
  meta: z.unknown().optional(),
  // 可选：同时记一笔花费
  amount: optStr,
  currency: optStr,
  category: z.nativeEnum(ExpenseCategory).optional(),
  isBaby: flag.default(false),
});
export type EntryInput = z.input<typeof entrySchema>;

function metaOf(value: unknown) {
  try {
    return jsonObject(value, "附加信息格式错误");
  } catch (e) {
    throw badRequest((e as Error).message);
  }
}

export async function createEntry(actor: Actor, tripId: string, input: Input) {
  await assertTripAccess(actor.userId, tripId, "EDITOR");
  const audited = auditedDb({ tripId, userId: actor.userId });
  const d = parse(entrySchema, input);
  const meta = metaOf(d.meta);
  const tz = await entryTz(tripId, d.stopId || null);
  const startAt = parseInTz(d.startAt, tz);

  const entry = await audited.entry.create({
    data: {
      tripId, stopId: d.stopId || null, type: d.type, title: d.title, note: d.note || null,
      startAt, endAt: d.endAt ? parseInTz(d.endAt, tz) : null, meta: meta ? (meta as InputJsonValue) : undefined,
    },
  });

  let expenseId: string | null = null;
  if (d.amount && parseFloat(d.amount) > 0) {
    const data = await buildExpense({
      tripId, userId: actor.userId, amount: d.amount, currency: d.currency || undefined, category: d.category, isBaby: d.isBaby,
      title: d.title, paidAt: startAt, stopId: d.stopId || null, entryId: entry.id,
    });
    expenseId = (await audited.expense.create({ data })).id;
  }

  refreshTrip(tripId);
  scheduleReindex(tripId);
  return { id: entry.id, expenseId };
}

export async function updateEntry(actor: Actor, tripId: string, entryId: string, input: Input) {
  await assertTripAccess(actor.userId, tripId, "EDITOR");
  const d = parse(entrySchema, input);
  const meta = metaOf(d.meta);
  const tz = await entryTz(tripId, d.stopId || null);
  await auditedDb({ tripId, userId: actor.userId }).entry.update({
    where: { id: entryId, tripId },
    data: {
      stopId: d.stopId || null, type: d.type, title: d.title, note: d.note || null,
      startAt: parseInTz(d.startAt, tz), endAt: d.endAt ? parseInTz(d.endAt, tz) : null,
      meta: meta ? (meta as InputJsonValue) : Prisma.DbNull,
    },
  });
  refreshTrip(tripId);
  scheduleReindex(tripId);
  return { id: entryId };
}

export async function deleteEntry(actor: Actor, tripId: string, entryId: string) {
  await assertTripAccess(actor.userId, tripId, "EDITOR");
  await auditedDb({ tripId, userId: actor.userId }).entry.delete({ where: { id: entryId, tripId } });
  refreshTrip(tripId);
}
