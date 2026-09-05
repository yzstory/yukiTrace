import { describe, it, expect } from "vitest";
import { toMinor, fromMinor, formatMoney, convertMinor, currencyInfo } from "@/lib/currency";

describe("最小单位换算", () => {
  it("按币种小数位取整", () => {
    expect(toMinor("128.5", "CNY")).toBe(12850);
    expect(toMinor(2800, "JPY")).toBe(2800); // 日元没有小数位
    expect(toMinor("0.1", "CNY")).toBe(10);
  });

  it("避免浮点误差", () => {
    // 0.1 + 0.2 类问题：分开记三笔 19.99 应当恰好是 5997 分
    const total = [1, 2, 3].reduce((a) => a + toMinor("19.99", "CNY"), 0);
    expect(total).toBe(5997);
  });

  it("未知币种按两位小数处理", () => {
    expect(currencyInfo("XYZ").minorUnit).toBe(2);
    expect(toMinor("1.23", "XYZ")).toBe(123);
  });

  it("非法输入归零而不是 NaN", () => {
    expect(toMinor("abc", "CNY")).toBe(0);
    expect(toMinor("", "CNY")).toBe(0);
  });

  it("往返一致", () => {
    expect(fromMinor(toMinor("99.99", "CNY"), "CNY")).toBeCloseTo(99.99, 5);
    expect(fromMinor(toMinor(1500, "KRW"), "KRW")).toBe(1500);
  });
});

describe("跨币种折算", () => {
  it("日元换人民币按小数位差正确进位", () => {
    // 2800 日元（minorUnit 0），汇率 0.048 → 134.4 元 → 13440 分
    expect(convertMinor(2800, "JPY", "CNY", 0.048)).toBe(13440);
  });

  it("同币种汇率为 1 时保持不变", () => {
    expect(convertMinor(12850, "CNY", "CNY", 1)).toBe(12850);
  });

  it("人民币换日元丢弃小数", () => {
    expect(convertMinor(10000, "CNY", "JPY", 20.8)).toBe(2080);
  });
});

describe("金额格式化", () => {
  it("带货币符号与千分位", () => {
    expect(formatMoney(680000, "CNY")).toBe("¥6,800.00");
    expect(formatMoney(2800, "JPY")).toBe("¥2,800");
  });

  it("compact 模式省略小数", () => {
    expect(formatMoney(680000, "CNY", { compact: true })).toBe("¥6,800");
  });

  it("showCode 只对非人民币附加代码", () => {
    expect(formatMoney(2800, "JPY", { showCode: true })).toBe("¥2,800 JPY");
    expect(formatMoney(100, "CNY", { showCode: true })).toBe("¥1.00");
  });
});
