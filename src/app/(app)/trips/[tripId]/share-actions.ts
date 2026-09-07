"use server";

import { verifySession } from "@/lib/dal";
import * as share from "@/lib/services/share";

export async function createShareLink(tripId: string, hideExpense: boolean) {
  const actor = await verifySession();
  await share.createShareLink(actor, tripId, hideExpense);
}

export async function revokeShareLink(tripId: string, id: string) {
  const actor = await verifySession();
  await share.revokeShareLink(actor, tripId, id);
}

export async function toggleShareExpense(tripId: string, id: string, hideExpense: boolean) {
  const actor = await verifySession();
  await share.toggleShareExpense(actor, tripId, id, hideExpense);
}
