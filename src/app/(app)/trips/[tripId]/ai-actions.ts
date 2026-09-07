"use server";

import { verifySession } from "@/lib/dal";
import { asActionResult } from "@/lib/api/errors";
import * as ai from "@/lib/services/ai";

/** 生成某一天的日记草稿（不直接覆盖已有日记，写入 aiDraft） */
export async function generateDailyDraft(tripId: string, date: string, tone: "default" | "to_baby" = "default"): Promise<{ draft?: string; error?: string }> {
  const actor = await verifySession();
  return asActionResult(() => ai.generateDailyDraft(actor, tripId, date, tone));
}

/** 家庭日记：把当天所有成员各自记录的内容合成一段共同的日记 */
export async function generateFamilyDigest(tripId: string, date: string): Promise<{ draft?: string; error?: string }> {
  const actor = await verifySession();
  return asActionResult(() => ai.generateFamilyDigest(actor, tripId, date));
}

/** 生成整段旅程的游记与总结要点 */
export async function generateTripSummary(tripId: string): Promise<{ text?: string; error?: string }> {
  const actor = await verifySession();
  return asActionResult(() => ai.generateTripSummary(actor, tripId));
}

/** 出行前装备清单建议：写入 ChecklistItem */
export async function generatePackingList(tripId: string): Promise<{ count?: number; error?: string }> {
  const actor = await verifySession();
  return asActionResult(() => ai.generatePackingList(actor, tripId));
}
