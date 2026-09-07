import "server-only";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertTripAccess } from "@/lib/access";
import type { Actor } from "./shared";

const refresh = (tripId: string) => revalidatePath(`/trips/${tripId}/edit`);

export async function listShareLinks(actor: Actor, tripId: string) {
  await assertTripAccess(actor.userId, tripId, "EDITOR");
  return db.shareLink.findMany({ where: { tripId }, orderBy: { createdAt: "desc" }, select: { id: true, token: true, hideExpense: true, expiresAt: true, createdAt: true } });
}

export async function createShareLink(actor: Actor, tripId: string, hideExpense: boolean) {
  await assertTripAccess(actor.userId, tripId, "EDITOR");
  const token = crypto.randomBytes(12).toString("base64url");
  const link = await db.shareLink.create({ data: { tripId, token, hideExpense } });
  refresh(tripId);
  return { id: link.id, token };
}

export async function revokeShareLink(actor: Actor, tripId: string, id: string) {
  await assertTripAccess(actor.userId, tripId, "EDITOR");
  await db.shareLink.deleteMany({ where: { id, tripId } });
  refresh(tripId);
}

export async function toggleShareExpense(actor: Actor, tripId: string, id: string, hideExpense: boolean) {
  await assertTripAccess(actor.userId, tripId, "EDITOR");
  await db.shareLink.updateMany({ where: { id, tripId }, data: { hideExpense } });
  refresh(tripId);
}
