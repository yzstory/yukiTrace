import "server-only";
import crypto from "node:crypto";
import { db } from "@/lib/db";

export type TokenScope = "mcp" | "api";
/** 前缀即用途：trc_ 只读 MCP，tra_ 读写 API。两者互不通用。 */
const PREFIX: Record<TokenScope, string> = { mcp: "trc_", api: "tra_" };
export const TOKEN_LIMIT = 10;

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** 生成新令牌，明文只返回这一次 */
export async function createToken(userId: string, name: string, scope: TokenScope) {
  const raw = PREFIX[scope] + crypto.randomBytes(24).toString("base64url");
  await db.mcpToken.create({
    data: { userId, name: name.trim() || "未命名", tokenHash: hashToken(raw), prefix: raw.slice(0, 10), scope },
  });
  return raw;
}

export const createMcpToken = (userId: string, name: string) => createToken(userId, name, "mcp");

/** 校验 Authorization: Bearer <token>，只接受指定用途的令牌，返回 userId */
export async function verifyToken(header: string | null, scope: TokenScope): Promise<{ userId: string; tokenId: string } | null> {
  const raw = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!raw?.startsWith(PREFIX[scope])) return null;
  const row = await db.mcpToken.findUnique({ where: { tokenHash: hashToken(raw) }, select: { id: true, userId: true, scope: true } });
  if (!row || row.scope !== scope) return null;
  await db.mcpToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return { userId: row.userId, tokenId: row.id };
}

export async function verifyMcpToken(header: string | null): Promise<string | null> {
  return (await verifyToken(header, "mcp"))?.userId ?? null;
}
