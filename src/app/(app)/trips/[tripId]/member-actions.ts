"use server";

import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { asActionResult } from "@/lib/api/errors";
import * as members from "@/lib/services/members";

export type MemberActionState = { error?: string; ok?: boolean } | undefined;

/** 生成邀请链接：加入的都是家人（可编辑），30 天有效，不限人数。只读访问走分享链接。 */
export async function createInvite(tripId: string): Promise<{ token?: string; error?: string }> {
  const actor = await verifySession();
  return asActionResult(() => members.createInvite(actor, tripId));
}

export async function revokeInvite(tripId: string, id: string) {
  const actor = await verifySession();
  await members.revokeInvite(actor, tripId, id);
}

export async function removeMember(tripId: string, memberUserId: string) {
  const actor = await verifySession();
  await asActionResult(() => members.removeMember(actor, tripId, memberUserId));
}

/** 自己退出旅程（所有者不可退出，需先删除旅程） */
export async function leaveTrip(tripId: string) {
  const actor = await verifySession();
  const r = await asActionResult(() => members.leaveTrip(actor, tripId));
  if (r && "error" in r) redirect(`/trips/${tripId}/members`);
  redirect("/trips");
}

/** 接受邀请 */
export async function acceptInvite(token: string): Promise<{ error?: string; tripId?: string }> {
  const actor = await verifySession();
  return asActionResult(() => members.acceptInvite(actor, token));
}
