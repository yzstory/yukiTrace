"use server";

import { verifySession } from "@/lib/dal";
import { asActionResult } from "@/lib/api/errors";
import { issueToken, revokeToken } from "@/lib/services/tokens";

/** 设置页只签发只读的 MCP 令牌；读写的 API 令牌由 /api/v1/auth/login 签发 */
export async function issueMcpToken(name: string): Promise<{ token?: string; error?: string }> {
  const actor = await verifySession();
  return asActionResult(() => issueToken(actor, name, "mcp"));
}

export async function revokeMcpToken(id: string) {
  const actor = await verifySession();
  await revokeToken(actor, id);
}
