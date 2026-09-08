import "server-only";
import { log } from "@/lib/logger";

/**
 * 进程内滑动窗口限流。单实例部署足够；将来多实例再换 Redis。
 */
type Bucket = { hits: number[]; };
const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterS: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  // 定期清理，避免 key 无限增长
  if (now - lastSweep > 60_000) {
    for (const [k, b] of buckets) {
      if (b.hits.length === 0 || now - b.hits[b.hits.length - 1] > windowMs) buckets.delete(k);
    }
    lastSweep = now;
  }

  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket);
    const retryAfterS = Math.max(1, Math.ceil((windowMs - (now - bucket.hits[0])) / 1000));
    log.warn("rate limit hit", { key, limit, retryAfterS });
    return { ok: false, remaining: 0, retryAfterS };
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { ok: true, remaining: limit - bucket.hits.length, retryAfterS: 0 };
}

/** 各接口的配额 */
export const LIMITS = {
  aiChat: { limit: 30, windowMs: 60 * 60_000 },
  aiReceipt: { limit: 20, windowMs: 60 * 60_000 },
  aiGenerate: { limit: 20, windowMs: 60 * 60_000 },
  upload: { limit: 200, windowMs: 60 * 60_000 },
  /** /api/v1 的写接口（小程序 / App / 脚本）：手记一笔账远达不到，批量脚本会被挡下 */
  apiWrite: { limit: 120, windowMs: 60_000 },
  login: { limit: 10, windowMs: 10 * 60_000 },
} as const;

export function tooManyRequests(r: RateLimitResult, message = "操作太频繁，请稍后再试") {
  return Response.json({ error: `${message}（约 ${r.retryAfterS} 秒后可重试）` }, { status: 429, headers: { "Retry-After": String(r.retryAfterS) } });
}
