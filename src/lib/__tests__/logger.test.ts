import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));
const { log } = await import("@/lib/logger");

function captured(fn: () => void, method: "log" | "warn" | "error" = "log") {
  const spy = vi.spyOn(console, method).mockImplementation(() => {});
  fn();
  const line = spy.mock.calls.at(-1)?.[0] as string | undefined;
  spy.mockRestore();
  return line ? JSON.parse(line) : null;
}

describe("结构化日志", () => {
  beforeEach(() => vi.stubEnv("LOG_LEVEL", "debug"));
  afterEach(() => vi.unstubAllEnvs());

  it("输出 JSON 且带时间与级别", () => {
    const o = captured(() => log.info("hello", { userId: "u1" }));
    expect(o.level).toBe("info");
    expect(o.msg).toBe("hello");
    expect(o.userId).toBe("u1");
    expect(typeof o.t).toBe("string");
  });

  it("敏感字段被脱敏", () => {
    const o = captured(() => log.info("x", { password: "hunter2", apiKey: "sk-live", token: "t", userId: "u1" }));
    expect(o.password).toBe("[redacted]");
    expect(o.apiKey).toBe("[redacted]");
    expect(o.token).toBe("[redacted]");
    expect(o.userId).toBe("u1");
  });

  it("Error 展开为可读字段而不是 {}", () => {
    const o = captured(() => log.error("boom", { err: new Error("db down") }), "error");
    expect(o.err.message).toBe("db down");
    expect(o.err.name).toBe("Error");
  });

  it("timer 记录耗时", () => {
    const done = log.timer("op");
    const o = captured(() => done({ extra: 1 }));
    expect(typeof o.ms).toBe("number");
    expect(o.extra).toBe(1);
  });
});
