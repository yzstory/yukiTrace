import "server-only";
import crypto from "node:crypto";
import { db } from "@/lib/db";

const PREFIX = "trc_";

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** 生成新令牌，明文只返回这一次 */
export async function createMcpToken(userId: string, name: string) {
  const raw = PREFIX + crypto.randomBytes(24).toString("base64url");
  await db.mcpToken.create({
    data: { userId, name: name.trim() || "未命名", tokenHash: hashToken(raw), prefix: raw.slice(0, 10) },
  });
  return raw;
}

/** 校验 Authorization: Bearer <token>，返回 userId */
export async function verifyMcpToken(header: string | null): Promise<string | null> {
  const raw = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!raw?.startsWith(PREFIX)) return null;
  const row = await db.mcpToken.findUnique({ where: { tokenHash: hashToken(raw) }, select: { id: true, userId: true } });
  if (!row) return null;
  await db.mcpToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return row.userId;
}
