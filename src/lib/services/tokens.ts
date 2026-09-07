import "server-only";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { badRequest } from "@/lib/api/errors";
import { createToken, TOKEN_LIMIT, type TokenScope } from "@/lib/mcp-tokens";
import type { Actor } from "./shared";

export async function listTokens(actor: Actor) {
  return db.mcpToken.findMany({ where: { userId: actor.userId }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, prefix: true, scope: true, lastUsedAt: true, createdAt: true } });
}

/** 签发令牌：mcp 只读、api 读写；每人最多 10 个 */
export async function issueToken(actor: Actor, name: string, scope: TokenScope) {
  const count = await db.mcpToken.count({ where: { userId: actor.userId } });
  if (count >= TOKEN_LIMIT) throw badRequest("令牌数量已达上限，请先删除一些");
  const token = await createToken(actor.userId, name, scope);
  revalidatePath("/settings/mcp");
  return { token };
}

export async function revokeToken(actor: Actor, id: string) {
  await db.mcpToken.deleteMany({ where: { id, userId: actor.userId } });
  revalidatePath("/settings/mcp");
}
