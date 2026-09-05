export type LatLng = { lat: number; lng: number };

const R = 6371000;

/** Haversine 直线距离（米） */
export function haversine(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${m} m`;
  if (m < 10000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m / 1000).toLocaleString("zh-CN")} km`;
}

export function formatDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h === 0) return `${m} 分钟`;
  if (m === 0) return `${h} 小时`;
  return `${h} 小时 ${m} 分`;
}

/** 根据直线距离推荐出行方式 */
export function suggestMode(distanceM: number): "WALKING" | "DRIVING" | "STRAIGHT" {
  if (distanceM < 2000) return "WALKING";
  if (distanceM < 500000) return "DRIVING";
  return "STRAIGHT";
}

/** 判断坐标是否在中国大陆范围内（粗略），用于决定高德是否可用 */
export function isInChina({ lat, lng }: LatLng): boolean {
  return lat >= 18 && lat <= 54 && lng >= 73 && lng <= 135;
}

// ── WGS-84 → GCJ-02（高德/国测局坐标），仅中国大陆范围内需要 ──
const A = 6378245.0;
const EE = 0.00669342162296594323;

function transformLat(x: number, y: number) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin((y / 3.0) * Math.PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((y / 12.0) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30.0)) * 2.0) / 3.0;
  return ret;
}
function transformLng(x: number, y: number) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin((x / 3.0) * Math.PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((x / 12.0) * Math.PI) + 300.0 * Math.sin((x / 30.0) * Math.PI)) * 2.0) / 3.0;
  return ret;
}

/** GPS（WGS-84）坐标转高德坐标；不在中国大陆范围内则原样返回 */
export function wgs84ToGcj02(p: LatLng): LatLng {
  if (!isInChina(p)) return p;
  // 港澳台等地高德亦使用 WGS-84，这里粗略排除台湾
  if (p.lng > 119.5 && p.lng < 122.5 && p.lat > 21.5 && p.lat < 25.5) return p;
  const dLat0 = transformLat(p.lng - 105.0, p.lat - 35.0);
  const dLng0 = transformLng(p.lng - 105.0, p.lat - 35.0);
  const radLat = (p.lat / 180.0) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  const dLat = (dLat0 * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * Math.PI);
  const dLng = (dLng0 * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * Math.PI);
  return { lat: +(p.lat + dLat).toFixed(6), lng: +(p.lng + dLng).toFixed(6) };
}

/** 按天分配的固定颜色序列（最多 8 天循环时折叠为灰） */
export const DAY_COLORS = ["#007AFF", "#FF9500", "#34C759", "#AF52DE", "#FF2D55", "#5AC8FA", "#FFCC00", "#8E8E93"];
export function dayColor(index: number) {
  return index - 1 < DAY_COLORS.length ? DAY_COLORS[index - 1] : DAY_COLORS[DAY_COLORS.length - 1];
}
