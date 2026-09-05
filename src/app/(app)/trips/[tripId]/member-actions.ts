"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireTripAccess, verifySession } from "@/lib/dal";
import { MemberRole } from "@/generated/prisma/enums";

export type MemberActionState = { error?: string; ok?: boolean } | undefined;

/** 生成邀请链接 */
export async function createInvite(tripId: string, role: MemberRole, days: number, maxUses: number | null) {
  const { userId } = await requireTripAccess(tripId, "OWNER");
  const token = crypto.randomBytes(12).toString("base64url");
  await db.tripInvite.create({
    data: {
      tripId,
      token,
      role,
      createdById: userId,
      maxUses,
      expiresAt: days > 0 ? new Date(Date.now() + days * 86400_000) : null,
    },
  });
  revalidatePath(`/trips/${tripId}/members`);
}

export async function revokeInvite(tripId: string, id: string) {
  await requireTripAccess(tripId, "OWNER");
  await db.tripInvite.delete({ where: { id, tripId } });
  revalidatePath(`/trips/${tripId}/members`);
}

export async function changeMemberRole(tripId: string, memberUserId: string, role: MemberRole) {
  const { userId } = await requireTripAccess(tripId, "OWNER");
  if (memberUserId === userId) return; // 不能改自己
  const trip = await db.trip.findUniqueOrThrow({ where: { id: tripId }, select: { ownerId: true } });
  if (memberUserId === trip.ownerId) return; // 不能改所有者
  await db.tripMember.update({ where: { tripId_userId: { tripId, userId: memberUserId } }, data: { role } });
  revalidatePath(`/trips/${tripId}/members`);
}

export async function removeMember(tripId: string, memberUserId: string) {
  const { userId } = await requireTripAccess(tripId, "OWNER");
  const trip = await db.trip.findUniqueOrThrow({ where: { id: tripId }, select: { ownerId: true } });
  if (memberUserId === trip.ownerId || memberUserId === userId) return;
  await db.tripMember.delete({ where: { tripId_userId: { tripId, userId: memberUserId } } });
  revalidatePath(`/trips/${tripId}/members`);
}

/** 自己退出旅程（所有者不可退出，需先转让或删除旅程） */
export async function leaveTrip(tripId: string) {
  const { userId } = await verifySession();
  const trip = await db.trip.findUnique({ where: { id: tripId }, select: { ownerId: true } });
  if (!trip || trip.ownerId === userId) redirect(`/trips/${tripId}/members`);
  await db.tripMember.deleteMany({ where: { tripId, userId } });
  revalidatePath("/trips");
  redirect("/trips");
}

/** 接受邀请 */
export async function acceptInvite(token: string): Promise<{ error?: string; tripId?: string }> {
  const { userId } = await verifySession();
  const invite = await db.tripInvite.findUnique({ where: { token }, include: { trip: { select: { id: true, ownerId: true } } } });
  if (!invite) return { error: "邀请不存在或已被撤销" };
  if (invite.expiresAt && invite.expiresAt < new Date()) return { error: "邀请已过期" };
  if (invite.maxUses != null && invite.uses >= invite.maxUses) return { error: "邀请次数已用完" };

  const tripId = invite.trip.id;
  if (invite.trip.ownerId === userId) return { tripId };

  const existing = await db.tripMember.findUnique({ where: { tripId_userId: { tripId, userId } } });
  if (existing) return { tripId };

  await db.$transaction([
    db.tripMember.create({ data: { tripId, userId, role: invite.role } }),
    db.tripInvite.update({ where: { id: invite.id }, data: { uses: { increment: 1 } } }),
  ]);
  revalidatePath("/trips");
  return { tripId };
}
