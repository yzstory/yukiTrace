import "server-only";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { verifyToken } from "@/lib/mcp-tokens";

export type Principal = { userId: string; via: "token"; tokenId: string } | { userId: string; via: "cookie" };

/**
 * 请求身份：优先 Bearer API 令牌（小程序 / App），其次会话 cookie（浏览器）。
 * MCP 令牌（trc_）在这里不算数，它只能进 /api/mcp 且只读。
 */
export async function authenticate(req: Request | NextRequest): Promise<Principal | null> {
  const header = req.headers.get("authorization");
  if (header) {
    const hit = await verifyToken(header, "api");
    return hit ? { userId: hit.userId, via: "token", tokenId: hit.tokenId } : null;
  }
  const session = await getSession();
  return session?.userId ? { userId: session.userId, via: "cookie" } : null;
}

/** 老路由的最小改动：只要 userId */
export async function requestUserId(req: Request | NextRequest): Promise<string | null> {
  return (await authenticate(req))?.userId ?? null;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}
