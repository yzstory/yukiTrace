"use server";

import { verifySession } from "@/lib/dal";
import { asActionResult } from "@/lib/api/errors";
import * as organize from "@/lib/services/organize";

export async function keepDuplicates(tripId: string, fingerprint: string): Promise<{ error?: string; ok?: boolean }> {
  const actor = await verifySession();
  return asActionResult(async () => { await organize.keepDuplicates(actor, tripId, fingerprint); return { ok: true }; });
}

export async function retryPhotoAnalysis(tripId: string, photoId: string): Promise<{ error?: string; ok?: boolean }> {
  const actor = await verifySession();
  return asActionResult(async () => { await organize.retryPhotoAnalysis(actor, tripId, photoId); return { ok: true }; });
}

/** 一键整理：把能自动判断的做掉，剩下的留给人 */
export async function autoTidy(tripId: string): Promise<{ error?: string; linked?: number; analyzed?: number }> {
  const actor = await verifySession();
  return asActionResult(() => organize.autoTidy(actor, tripId));
}
