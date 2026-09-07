import "server-only";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertTripAccess } from "@/lib/access";
import { badRequest, forbidden, notFound } from "@/lib/api/errors";
import type { Actor } from "./shared";

function refresh(tripId: string) {
  revalidatePath(`/trips/${tripId}/members`);
  revalidatePath("/trips");
}

/** 成员与有效邀请 */
export async function listMembers(actor: Actor, tripId: string) {
  const role = await assertTripAccess(actor.userId, tripId);
  const trip = await db.trip.findUniqueOrThrow({
    where: { id: tripId },
    select: {
      ownerId: true,
      members: { orderBy: { joinedAt: "asc" }, select: { userId: true, role: true, joinedAt: true, user: { select: { name: true, email: true } } } },
      invites: { where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, orderBy: { createdAt: "desc" }, select: { id: true, token: true, uses: true, maxUses: true, expiresAt: true, createdAt: true } },
    },
  });
  return {
    role,
    members: trip.members.map((m) => ({ userId: m.userId, name: m.user.name, email: m.user.email, role: m.role, joinedAt: m.joinedAt, isOwner: m.userId === trip.ownerId })),
    invites: role === "OWNER" ? trip.invites : [],
  };
}

/** 生成邀请链接：加入的都是家人（可编辑），30 天有效，不限人数。只读访问走分享链接。 */
export async function createInvite(actor: Actor, tripId: string) {
  await assertTripAccess(actor.userId, tripId, "OWNER");
  const token = crypto.randomBytes(12).toString("base64url");
  await db.tripInvite.create({
    data: { tripId, token, role: "EDITOR", createdById: actor.userId, maxUses: null, expiresAt: new Date(Date.now() + 30 * 86400_000) },
  });
  refresh(tripId);
  return { token };
}

export async function revokeInvite(actor: Actor, tripId: string, id: string) {
  await assertTripAccess(actor.userId, tripId, "OWNER");
  await db.tripInvite.deleteMany({ where: { id, tripId } });
  refresh(tripId);
}

export async function removeMember(actor: Actor, tripId: string, memberUserId: string) {
  await assertTripAccess(actor.userId, tripId, "OWNER");
  const trip = await db.trip.findUniqueOrThrow({ where: { id: tripId }, select: { ownerId: true } });
  if (memberUserId === trip.ownerId || memberUserId === actor.userId) throw badRequest("不能移除旅程所有者");
  await db.tripMember.deleteMany({ where: { tripId, userId: memberUserId } });
  refresh(tripId);
}

/** 自己退出旅程（所有者不可退出，需先删除旅程） */
export async function leaveTrip(actor: Actor, tripId: string) {
  const trip = await db.trip.findUnique({ where: { id: tripId }, select: { ownerId: true } });
  if (!trip) throw notFound("旅程不存在");
  if (trip.ownerId === actor.userId) throw forbidden("所有者不能退出自己的旅程");
  await db.tripMember.deleteMany({ where: { tripId, userId: actor.userId } });
  refresh(tripId);
}

/** 邀请预览：不需要登录 */
export async function inviteInfo(token: string) {
  const invite = await db.tripInvite.findUnique({
    where: { token },
    include: { trip: { select: { id: true, title: true, startDate: true, endDate: true, timezone: true, babyName: true } }, createdBy: { select: { name: true } } },
  });
  if (!invite) throw notFound("邀请不存在或已被撤销");
  if (invite.expiresAt && invite.expiresAt < new Date()) throw badRequest("邀请已过期");
  if (invite.maxUses != null && invite.uses >= invite.maxUses) throw badRequest("邀请次数已用完");
  return invite;
}

/** 接受邀请：已是成员或所有者直接返回旅程 id */
export async function acceptInvite(actor: Actor, token: string) {
  const invite = await inviteInfo(token);
  const tripId = invite.trip.id;
  const owner = await db.trip.findUniqueOrThrow({ where: { id: tripId }, select: { ownerId: true } });
  if (owner.ownerId === actor.userId) return { tripId };
  const existing = await db.tripMember.findUnique({ where: { tripId_userId: { tripId, userId: actor.userId } } });
  if (existing) return { tripId };
  await db.$transaction([
    db.tripMember.create({ data: { tripId, userId: actor.userId, role: invite.role } }),
    db.tripInvite.update({ where: { id: invite.id }, data: { uses: { increment: 1 } } }),
  ]);
  refresh(tripId);
  return { tripId };
}
