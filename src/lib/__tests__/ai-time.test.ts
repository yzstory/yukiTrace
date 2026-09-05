import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
// tools.ts 顶部会 import db/amap 等服务端模块，这里只测纯函数，打桩掉重依赖
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/amap", () => ({ searchPoi: vi.fn(), amapConfigured: () => false }));
vi.mock("@/app/(app)/trips/[tripId]/actions", () => ({ getRate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { parseAiTime } = await import("@/lib/ai/tools");

// 旅程：2026-09-05 ～ 2026-09-08，东八区；「现在」是旅程期间
const ctx = {
  tz: "Asia/Shanghai",
  start: new Date("2026-09-05T00:00:00Z"),
  end: new Date("2026-09-08T00:00:00Z"),
  now: new Date("2026-09-05T05:57:00Z"), // 北京 13:57
};

describe("AI 给出的时间解析", () => {
  it("没有时区偏移时按旅程时区解析，而不是 UTC", () => {
    const d = parseAiTime("2026-09-05T13:57", ctx);
    expect(d.toISOString()).toBe("2026-09-05T05:57:00.000Z");
  });

  it("带偏移的 ISO 原样解析", () => {
    expect(parseAiTime("2026-09-05T13:57:00+08:00", ctx).toISOString()).toBe("2026-09-05T05:57:00.000Z");
  });

  it("模型把年份猜成 2025 → 纠正到旅程所在年份，保留月日时分", () => {
    const d = parseAiTime("2025-09-05T13:57", ctx);
    expect(d.toISOString()).toBe("2026-09-05T05:57:00.000Z");
  });

  it("年份差两年同样纠正", () => {
    expect(parseAiTime("2024-09-05T05:57", ctx).toISOString()).toBe("2026-09-04T21:57:00.000Z");
  });

  it("纠正年份后仍不在范围内，且现在在旅程期间 → 用现在", () => {
    // 月日都错（1 月），改年份也救不回来
    expect(parseAiTime("2025-01-15T10:00", ctx).toISOString()).toBe(ctx.now.toISOString());
  });

  it("空值 / 垃圾字符串用现在", () => {
    expect(parseAiTime(undefined, ctx)).toBe(ctx.now);
    expect(parseAiTime("下午三点", ctx)).toBe(ctx.now);
  });

  it("范围内的时间不动", () => {
    const d = parseAiTime("2026-09-07T09:30", ctx);
    expect(d.toISOString()).toBe("2026-09-07T01:30:00.000Z");
  });
});
