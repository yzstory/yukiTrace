import { describe, it, expect } from "vitest";
import { haversine, formatDistance, formatDuration, suggestMode, isInChina, wgs84ToGcj02, dayColor } from "@/lib/geo";

const PVG = { lat: 31.1443, lng: 121.8083 };
const CTS = { lat: 42.7752, lng: 141.6923 };

describe("距离计算", () => {
  it("上海到札幌约 2180 km", () => {
    const d = haversine(PVG, CTS);
    expect(d).toBeGreaterThan(2_100_000);
    expect(d).toBeLessThan(2_250_000);
  });

  it("同一点距离为 0", () => {
    expect(haversine(PVG, PVG)).toBe(0);
  });

  it("对称", () => {
    expect(haversine(PVG, CTS)).toBe(haversine(CTS, PVG));
  });
});

describe("格式化", () => {
  it("按量级切换单位", () => {
    expect(formatDistance(850)).toBe("850 m");
    expect(formatDistance(1500)).toBe("1.5 km");
    expect(formatDistance(2_180_000)).toBe("2,180 km");
  });

  it("时长按小时分钟", () => {
    expect(formatDuration(600)).toBe("10 分钟");
    expect(formatDuration(3600)).toBe("1 小时");
    expect(formatDuration(4560)).toBe("1 小时 16 分");
  });
});

describe("出行方式推荐", () => {
  it("短距离步行、中距离驾车、超长直线", () => {
    expect(suggestMode(800)).toBe("WALKING");
    expect(suggestMode(50_000)).toBe("DRIVING");
    expect(suggestMode(2_180_000)).toBe("STRAIGHT");
  });
});

describe("坐标转换", () => {
  it("中国大陆坐标发生偏移", () => {
    const g = wgs84ToGcj02({ lat: 31.2304, lng: 121.4737 });
    expect(g.lat).not.toBe(31.2304);
    // 偏移量应在数百米量级，不能离谱
    expect(haversine({ lat: 31.2304, lng: 121.4737 }, g)).toBeLessThan(1000);
  });

  it("境外坐标原样返回", () => {
    const tokyo = { lat: 35.6762, lng: 139.6503 };
    expect(wgs84ToGcj02(tokyo)).toEqual(tokyo);
  });

  it("台湾地区不做偏移", () => {
    const taipei = { lat: 25.033, lng: 121.5654 };
    expect(wgs84ToGcj02(taipei)).toEqual(taipei);
  });

  it("范围判断", () => {
    expect(isInChina({ lat: 31.2, lng: 121.5 })).toBe(true);
    expect(isInChina({ lat: 35.68, lng: 139.65 })).toBe(false);
  });
});

describe("按天配色", () => {
  it("前 8 天各不相同，之后折叠为灰", () => {
    expect(dayColor(1)).not.toBe(dayColor(2));
    expect(dayColor(9)).toBe(dayColor(8));
  });
});
