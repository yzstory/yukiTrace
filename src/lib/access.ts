import "server-only";
import { db } from "@/lib/db";
import { forbidden, notFound } from "@/lib/api/errors";

export type Role = "VIEWER" | "EDITOR" | "OWNER";
const RANK: Record<Role, number> = { VIEWER: 0, EDITOR: 1, OWNER: 2 };

/** 用户对旅程的角色；无权访问返回 null（旅程不存在也是 null，不区分以免探测） */
export async function tripRole(userId: string, tripId: string): Promise<Role | null> {
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    select: { ownerId: true, members: { where: { userId }, select: { role: true } } },
  });
  if (!trip) return null;
  return trip.ownerId === userId ? "OWNER" : (trip.members[0]?.role ?? null);
}

/** 服务层用：不够权限直接抛 ApiError（404 看不到 / 403 不能改） */
export async function assertTripAccess(userId: string, tripId: string, minRole: Role = "VIEWER") {
  const role = await tripRole(userId, tripId);
  if (!role) throw notFound("旅程不存在或没有访问权");
  if (RANK[role] < RANK[minRole]) throw forbidden(minRole === "OWNER" ? "只有旅程所有者可以这样做" : "没有编辑权限");
  return role;
}

/** Prisma where 片段：用户可见的旅程 */
export const visibleTrips = (userId: string) => ({ OR: [{ ownerId: userId }, { members: { some: { userId } } }] });
