"use server";

/**
 * 旅程内记录的 Server Actions：只做「取会话 → 调服务层 → 收成表单状态」。
 * 业务逻辑都在 src/lib/services/*，与 /api/v1 共用。
 */
import { verifySession } from "@/lib/dal";
import { asActionResult } from "@/lib/api/errors";
import { fromForm } from "@/lib/services/input";
import * as stops from "@/lib/services/stops";
import * as entries from "@/lib/services/entries";
import * as expenses from "@/lib/services/expenses";
import * as daily from "@/lib/services/daily";
import type { ActionState } from "@/app/(app)/trips/actions";

export type { ActionState };

const ok = async (run: () => Promise<unknown>): Promise<ActionState> => asActionResult(async () => { await run(); return { ok: true }; });

// ───────────────────────── 站点 ─────────────────────────

export async function createStop(tripId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await verifySession();
  return ok(() => stops.createStop(actor, tripId, fromForm(formData)));
}

export async function updateStop(tripId: string, stopId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await verifySession();
  return ok(() => stops.updateStop(actor, tripId, stopId, fromForm(formData)));
}

export async function deleteStop(tripId: string, stopId: string) {
  const actor = await verifySession();
  await stops.deleteStop(actor, tripId, stopId);
}

// ───────────────────────── 条目 ─────────────────────────

export async function createEntry(tripId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await verifySession();
  return ok(() => entries.createEntry(actor, tripId, fromForm(formData)));
}

export async function updateEntry(tripId: string, entryId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await verifySession();
  return ok(() => entries.updateEntry(actor, tripId, entryId, fromForm(formData)));
}

export async function deleteEntry(tripId: string, entryId: string) {
  const actor = await verifySession();
  await entries.deleteEntry(actor, tripId, entryId);
}

// ───────────────────────── 花费 ─────────────────────────

export async function createExpense(tripId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await verifySession();
  return ok(() => expenses.createExpense(actor, tripId, fromForm(formData)));
}

export async function deleteExpense(tripId: string, expenseId: string) {
  const actor = await verifySession();
  await expenses.deleteExpense(actor, tripId, expenseId);
}

// ───────────────────────── 照片 ─────────────────────────

export async function deletePhoto(tripId: string, photoId: string) {
  const actor = await verifySession();
  await daily.deletePhoto(actor, tripId, photoId);
}

export async function updatePhotoCaption(tripId: string, photoId: string, caption: string) {
  const actor = await verifySession();
  await daily.updatePhotoCaption(actor, tripId, photoId, caption);
}

// ───────────────────────── 宝宝状态 ─────────────────────────

export async function createBabyLog(tripId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await verifySession();
  return ok(() => daily.createBabyLog(actor, tripId, fromForm(formData)));
}

export async function deleteBabyLog(tripId: string, id: string) {
  const actor = await verifySession();
  await daily.deleteBabyLog(actor, tripId, id);
}

// ───────────────────────── 日记 ─────────────────────────

export async function upsertDailyNote(tripId: string, date: string, content: string) {
  const actor = await verifySession();
  await daily.upsertDailyNote(actor, tripId, date, content);
}
