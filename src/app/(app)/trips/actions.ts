"use server";

import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { asActionResult } from "@/lib/api/errors";
import { fromForm } from "@/lib/services/input";
import * as trips from "@/lib/services/trips";

export type ActionState = { error?: string; ok?: boolean } | undefined;

export async function createTrip(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await verifySession();
  const r = await asActionResult(() => trips.createTrip(actor, fromForm(formData)));
  if ("error" in r) return r;
  redirect(`/trips/${r.id}`);
}

export async function updateTrip(tripId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await verifySession();
  const r = await asActionResult(() => trips.updateTrip(actor, tripId, fromForm(formData)));
  if ("error" in r) return r;
  redirect(`/trips/${tripId}`);
}

export async function deleteTrip(tripId: string) {
  const actor = await verifySession();
  await trips.deleteTrip(actor, tripId);
  redirect("/trips");
}

export async function setTripCover(tripId: string, coverKey: string | null) {
  const actor = await verifySession();
  await trips.setTripCover(actor, tripId, coverKey);
}
