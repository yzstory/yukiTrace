"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireTripAccess } from "@/lib/dal";

export async function createShareLink(tripId: string, hideExpense: boolean) {
  await requireTripAccess(tripId, "EDITOR");
  const token = crypto.randomBytes(12).toString("base64url");
  await db.shareLink.create({ data: { tripId, token, hideExpense } });
  revalidatePath(`/trips/${tripId}/edit`);
}

export async function revokeShareLink(tripId: string, id: string) {
  await requireTripAccess(tripId, "EDITOR");
  await db.shareLink.delete({ where: { id, tripId } });
  revalidatePath(`/trips/${tripId}/edit`);
}

export async function toggleShareExpense(tripId: string, id: string, hideExpense: boolean) {
  await requireTripAccess(tripId, "EDITOR");
  await db.shareLink.update({ where: { id, tripId }, data: { hideExpense } });
  revalidatePath(`/trips/${tripId}/edit`);
}
