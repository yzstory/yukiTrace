import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

/** 数据访问层：每个需要登录的 Server Component / Action 先调用 */
export const verifySession = cache(async () => {
  const session = await getSession();
  if (!session?.userId) redirect("/login");
  return { userId: session.userId };
});

export const getCurrentUser = cache(async () => {
  const { userId } = await verifySession();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, avatarKey: true },
  });
  if (!user) redirect("/login");
  return user;
});

/** 校验用户对某旅程是否有访问权，返回角色 */
export async function requireTripAccess(tripId: string, minRole: "VIEWER" | "EDITOR" | "OWNER" = "VIEWER") {
  const { userId } = await verifySession();
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    select: { id: true, ownerId: true, members: { where: { userId }, select: { role: true } } },
  });
  if (!trip) redirect("/trips");
  const role = trip.ownerId === userId ? "OWNER" : trip.members[0]?.role;
  if (!role) redirect("/trips");
  const rank = { VIEWER: 0, EDITOR: 1, OWNER: 2 } as const;
  if (rank[role] < rank[minRole]) redirect(`/trips/${tripId}`);
  return { userId, role };
}
