"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { createMcpToken } from "@/lib/mcp-tokens";

export async function issueMcpToken(name: string): Promise<{ token?: string; error?: string }> {
  const { userId } = await verifySession();
  const count = await db.mcpToken.count({ where: { userId } });
  if (count >= 10) return { error: "令牌数量已达上限，请先删除一些" };
  const token = await createMcpToken(userId, name);
  revalidatePath("/settings/mcp");
  return { token };
}

export async function revokeMcpToken(id: string) {
  const { userId } = await verifySession();
  await db.mcpToken.deleteMany({ where: { id, userId } });
  revalidatePath("/settings/mcp");
}
