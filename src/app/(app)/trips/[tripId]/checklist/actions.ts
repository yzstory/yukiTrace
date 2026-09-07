"use server";

import { verifySession } from "@/lib/dal";
import { asActionResult } from "@/lib/api/errors";
import * as checklist from "@/lib/services/checklist";

export async function toggleChecklistItem(tripId: string, id: string, checked: boolean) {
  const actor = await verifySession();
  await checklist.toggleChecklistItem(actor, tripId, id, checked);
}

export async function addChecklistItem(tripId: string, group: string, text: string) {
  const actor = await verifySession();
  if (!text.trim()) return;
  await asActionResult(() => checklist.addChecklistItem(actor, tripId, group, text));
}

export async function deleteChecklistItem(tripId: string, id: string) {
  const actor = await verifySession();
  await checklist.deleteChecklistItem(actor, tripId, id);
}

export async function applyDefaultTemplate(tripId: string) {
  const actor = await verifySession();
  await checklist.applyDefaultTemplate(actor, tripId);
}

export async function resetChecks(tripId: string) {
  const actor = await verifySession();
  await checklist.resetChecks(actor, tripId);
}
