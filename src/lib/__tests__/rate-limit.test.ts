import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// rate-limit 依赖 server-only，测试环境下打桩掉
vi.mock("server-only", () => ({}));

const { rateLimit } = await import("@/lib/rate-limit");

describe("滑动窗口限流", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("配额内放行，超出拒绝", () => {
    const key = `k-${Math.random()}`;
    for (let i = 0; i < 3; i++) expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterS).toBeGreaterThan(0);
  });

  it("剩余次数递减", () => {
    const key = `k-${Math.random()}`;
    expect(rateLimit(key, 3, 60_000).remaining).toBe(2);
    expect(rateLimit(key, 3, 60_000).remaining).toBe(1);
    expect(rateLimit(key, 3, 60_000).remaining).toBe(0);
  });

  it("不同 key 互不影响", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    rateLimit(a, 1, 60_000);
    expect(rateLimit(a, 1, 60_000).ok).toBe(false);
    expect(rateLimit(b, 1, 60_000).ok).toBe(true);
  });

  it("窗口滑过后恢复", () => {
    const key = `k-${Math.random()}`;
    rateLimit(key, 1, 60_000);
    expect(rateLimit(key, 1, 60_000).ok).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(rateLimit(key, 1, 60_000).ok).toBe(true);
  });

  it("窗口内滑动而非整段重置", () => {
    const key = `k-${Math.random()}`;
    rateLimit(key, 2, 60_000);
    vi.advanceTimersByTime(30_000);
    rateLimit(key, 2, 60_000);
    expect(rateLimit(key, 2, 60_000).ok).toBe(false);
    // 第一次命中过期后，又能再放行一次
    vi.advanceTimersByTime(30_001);
    expect(rateLimit(key, 2, 60_000).ok).toBe(true);
  });
});
