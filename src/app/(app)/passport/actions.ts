"use server";

import { verifySession } from "@/lib/dal";
import { asActionResult } from "@/lib/api/errors";
import * as passport from "@/lib/services/passport";

export type InkResult = { error?: string; line?: string; city?: string };

/** 盖一枚章 */
export async function inkStamp(city: string): Promise<InkResult> {
  const actor = await verifySession();
  return asActionResult(() => passport.inkStamp(actor, city));
}

/** 把所有还没盖的章一次盖完，最多 12 枚（AI 逐个写文案） */
export async function inkAll(): Promise<{ error?: string; inked: number }> {
  const actor = await verifySession();
  const r = await asActionResult(() => passport.inkAll(actor));
  return "error" in r ? { error: r.error, inked: 0 } : r;
}
