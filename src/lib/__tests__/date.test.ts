import { describe, it, expect } from "vitest";
import { fmt, parseInTz, dayIndex, tripDays, babyAge, timezoneLabel } from "@/lib/date";

describe("时区格式化", () => {
  const utc = new Date("2026-10-01T05:10:00.000Z");

  it("同一时刻在不同时区显示不同的钟点", () => {
    expect(fmt.time(utc, "Asia/Tokyo")).toBe("14:10");
    expect(fmt.time(utc, "Asia/Shanghai")).toBe("13:10");
    expect(fmt.time(utc, "UTC")).toBe("05:10");
  });

  it("省略时区参数时按东八区", () => {
    expect(fmt.time(utc)).toBe("13:10");
  });

  it("跨日边界按目标时区判断日期", () => {
    const late = new Date("2026-09-30T23:30:00.000Z"); // 上海次日 07:30
    expect(fmt.date(late, "Asia/Shanghai")).toBe("10月1日");
    expect(fmt.date(late, "UTC")).toBe("9月30日");
  });
});

describe("表单时间解析", () => {
  it("按指定时区把本地时间转成 UTC", () => {
    expect(parseInTz("2026-10-01T14:10", "Asia/Tokyo").toISOString()).toBe("2026-10-01T05:10:00.000Z");
    expect(parseInTz("2026-10-01T07:30", "Asia/Shanghai").toISOString()).toBe("2026-09-30T23:30:00.000Z");
  });

  it("与格式化互为逆运算", () => {
    const tz = "America/New_York";
    const iso = parseInTz("2026-07-04T20:00", tz);
    expect(fmt.inputDateTime(iso, tz)).toBe("2026-07-04T20:00");
  });
});

describe("旅程分天", () => {
  const start = new Date("2026-10-01");

  it("天数含首尾", () => {
    expect(tripDays("2026-10-01", "2026-10-05")).toBe(5);
    expect(tripDays("2026-10-01", "2026-10-01")).toBe(1);
  });

  it("按旅程时区归属，不受服务器时区影响", () => {
    const tokyoMorning = new Date("2026-10-01T23:00:00.000Z"); // 东京次日 08:00
    expect(dayIndex(start, tokyoMorning, "Asia/Tokyo")).toBe(2);
    expect(dayIndex(start, tokyoMorning, "UTC")).toBe(1);
  });
});

describe("宝宝月龄", () => {
  it("按天/月/年分级描述", () => {
    expect(babyAge("2025-06-15", "2025-06-30")).toBe("15 天");
    expect(babyAge("2025-06-15", "2026-02-15")).toBe("8 个月");
    expect(babyAge("2025-06-15", "2026-09-15")).toBe("1 岁 3 个月");
    expect(babyAge("2025-06-15", "2027-06-15")).toBe("2 岁");
  });
});

describe("时区标签", () => {
  it("已知时区给中文名，未知给原值", () => {
    expect(timezoneLabel("Asia/Tokyo")).toContain("东京");
    expect(timezoneLabel("Mars/Olympus")).toBe("Mars/Olympus");
    expect(timezoneLabel(null)).toContain("北京");
  });
});
