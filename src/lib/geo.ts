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
