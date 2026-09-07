"use server";

import { verifySession } from "@/lib/dal";
import { asActionResult } from "@/lib/api/errors";
import * as records from "@/lib/services/records";

const ok = (run: () => Promise<unknown>) => asActionResult(async () => { await run(); return { ok: true as const }; });

export async function loadRecord(tripId: string, kind: string, refId: string) {
  const actor = await verifySession();
  return records.loadRecord(actor, tripId, kind, refId);
}
export async function editRecord(tripId: string, kind: string, refId: string, version: string, values: Record<string, string>) {
  const actor = await verifySession();
  return ok(() => records.editRecord(actor, tripId, kind, refId, version, values));
}
export async function removeRecord(tripId: string, kind: string, refId: string, version: string) {
  const actor = await verifySession();
  return ok(() => records.removeRecord(actor, tripId, kind, refId, version));
}
export async function undoRecord(tripId: string, id: string) {
  const actor = await verifySession();
  return ok(() => records.undoRecord(actor, tripId, id));
}
export async function confirmRecord(tripId: string, kind: string, refId: string, version: string) {
  const actor = await verifySession();
  return ok(() => records.confirmRecord(actor, tripId, kind, refId, version));
}
