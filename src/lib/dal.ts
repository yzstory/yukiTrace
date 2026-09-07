import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { tripRole, type Role } from "@/lib/access";

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

const RANK: Record<Role, number> = { VIEWER: 0, EDITOR: 1, OWNER: 2 };

/** 校验用户对某旅程是否有访问权，返回角色；页面语境下不够权限就跳转 */
export async function requireTripAccess(tripId: string, minRole: Role = "VIEWER") {
  const { userId } = await verifySession();
  const role = await tripRole(userId, tripId);
  if (!role) redirect("/trips");
  if (RANK[role] < RANK[minRole]) redirect(`/trips/${tripId}`);
  return { userId, role };
}
