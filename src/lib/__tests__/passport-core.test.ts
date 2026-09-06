import { describe, it, expect } from "vitest";
import { deriveStamps, hueFor, tiltFor, templateLine, earthPercent } from "../passport-core";

const stop = (tripId: string, city: string | null, at: string, name = city ?? "x") => ({ tripId, city, arriveAt: new Date(at), name, lat: 0, lng: 0 });

describe("deriveStamps", () => {
  it("每座城市一枚，落在首次到访的旅程，并统计到访次数", () => {
    const stamps = deriveStamps([
      stop("t2", "青岛", "2026-09-04T02:00:00Z", "栈桥"),
      stop("t1", "烟台", "2026-03-01T02:00:00Z", "蓬莱阁"),
      stop("t1", "青岛", "2026-03-02T02:00:00Z", "八大关"),
      stop("t1", "青岛", "2026-03-02T05:00:00Z", "五四广场"),
      stop("t1", null, "2026-03-03T02:00:00Z", "无城市"),
      stop("t3", " 青岛 ", "2027-01-01T02:00:00Z", "海边"),
    ]);
    expect(stamps.map((s) => s.city)).toEqual(["烟台", "青岛"]);
    const qd = stamps[1];
    expect(qd.firstTripId).toBe("t1");
    expect(qd.firstAt.toISOString()).toBe("2026-03-02T02:00:00.000Z");
    expect(qd.tripCount).toBe(3);
    expect(qd.stopCount).toBe(4);
    // 只收首访旅程的站点名
    expect(qd.stopNames).toEqual(["八大关", "五四广场"]);
  });

  it("没有城市的站点不生成章", () => {
    expect(deriveStamps([stop("t1", null, "2026-01-01T00:00:00Z"), stop("t1", "  ", "2026-01-01T00:00:00Z")])).toEqual([]);
  });
});

describe("hue / tilt", () => {
  it("同一城市稳定，不同城市大概率不同，范围合法", () => {
    expect(hueFor("青岛")).toBe(hueFor("青岛"));
    expect(hueFor("青岛")).not.toBe(hueFor("烟台"));
    for (const c of ["青岛", "东京", "Paris", "乌鲁木齐"]) {
      expect(hueFor(c)).toBeGreaterThanOrEqual(0);
      expect(hueFor(c)).toBeLessThan(360);
      expect(Math.abs(tiltFor(c))).toBeLessThanOrEqual(8);
    }
  });
});

describe("templateLine", () => {
  it("第一座城市优先，其次带月龄，最后兜底", () => {
    expect(templateLine({ city: "青岛", babyName: "小满", babyAge: "1 岁 1 个月", isFirstCity: true })).toBe("小满的第一座城市");
    expect(templateLine({ city: "青岛", babyName: "小满", babyAge: "1 岁 1 个月", isFirstCity: false })).toBe("1 岁 1 个月的小满，到此一游");
    expect(templateLine({ city: "青岛", babyName: null, babyAge: null, isFirstCity: false })).toBe("宝宝来过青岛");
  });
});

describe("earthPercent", () => {
  it("按地球周长折算，一位小数", () => {
    expect(earthPercent(0)).toBe(0);
    expect(earthPercent(40_075_000)).toBe(100);
    expect(earthPercent(4_007_500)).toBe(10);
    expect(earthPercent(1_234_000)).toBe(3.1);
  });
});
