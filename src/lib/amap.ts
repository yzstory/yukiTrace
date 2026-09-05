import "server-only";
import type { LatLng } from "@/lib/geo";

const KEY = () => process.env.AMAP_WEB_SERVICE_KEY;
const BASE = "https://restapi.amap.com";

export function amapConfigured() {
  return Boolean(KEY());
}

async function get<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const key = KEY();
  if (!key) return null;
  const url = new URL(path, BASE);
  url.search = new URLSearchParams({ key, ...params }).toString();
  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return null;
    const json = (await res.json()) as T & { status?: string; info?: string };
    if (json.status !== "1") {
      console.warn("[amap]", path, json.info);
      return null;
    }
    return json;
  } catch (e) {
    console.warn("[amap] fetch failed", e);
    return null;
  }
}

export type PoiResult = {
  id: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  type: string;
};

/** POI 关键字搜索（输入提示） */
export async function searchPoi(keywords: string, city?: string): Promise<PoiResult[]> {
  type Resp = { tips: Array<{ id: string; name: string; district: string; address: string | unknown[]; location: string | unknown[]; typecode?: string }> };
  const data = await get<Resp>("/v3/assistant/inputtips", {
    keywords,
    ...(city ? { city, citylimit: "false" } : {}),
    datatype: "poi",
  });
  if (!data) return [];
  return data.tips
    .filter((t) => typeof t.location === "string" && t.location.includes(","))
    .map((t) => {
      const [lng, lat] = (t.location as string).split(",").map(Number);
      return {
        id: t.id,
        name: t.name,
        address: typeof t.address === "string" ? t.address : "",
        city: t.district ?? "",
        lat,
        lng,
        type: t.typecode ?? "",
      };
    });
}

/** 逆地理编码：坐标 → 地址 */
export async function reverseGeocode(p: LatLng): Promise<{ address: string; city: string; adcode: string | null } | null> {
  type Resp = { regeocode: { formatted_address: string | unknown[]; addressComponent: { city: string | unknown[]; province: string; adcode?: string | unknown[] } } };
  const data = await get<Resp>("/v3/geocode/regeo", { location: `${p.lng},${p.lat}`, extensions: "base" });
  if (!data) return null;
  const c = data.regeocode.addressComponent;
  const city = typeof c.city === "string" && c.city ? c.city : c.province;
  const address = typeof data.regeocode.formatted_address === "string" ? data.regeocode.formatted_address : "";
  const adcode = typeof c.adcode === "string" && c.adcode ? c.adcode : null;
  return { address, city, adcode };
}

export type RouteResult = { distanceM: number; durationS: number; polyline?: string };

/** 驾车路径规划 */
export async function drivingRoute(from: LatLng, to: LatLng): Promise<RouteResult | null> {
  type Resp = { route: { paths: Array<{ distance: string; duration: string; steps: Array<{ polyline: string }> }> } };
  const data = await get<Resp>("/v3/direction/driving", {
    origin: `${from.lng},${from.lat}`,
    destination: `${to.lng},${to.lat}`,
    strategy: "0",
    extensions: "base",
  });
  const path = data?.route.paths[0];
  if (!path) return null;
  return {
    distanceM: Number(path.distance),
    durationS: Number(path.duration),
    polyline: path.steps.map((s) => s.polyline).join(";"),
  };
}

/** 步行路径规划 */
export async function walkingRoute(from: LatLng, to: LatLng): Promise<RouteResult | null> {
  type Resp = { route: { paths: Array<{ distance: string; duration: string; steps: Array<{ polyline: string }> }> } };
  const data = await get<Resp>("/v3/direction/walking", {
    origin: `${from.lng},${from.lat}`,
    destination: `${to.lng},${to.lat}`,
  });
  const path = data?.route.paths[0];
  if (!path) return null;
  return {
    distanceM: Number(path.distance),
    durationS: Number(path.duration),
    polyline: path.steps.map((s) => s.polyline).join(";"),
  };
}

export type WeatherInfo = { weather: string; temperature: string; winddirection: string; humidity: string };

/** 实况天气（adcode） */
export async function liveWeather(adcode: string): Promise<WeatherInfo | null> {
  type Resp = { lives: WeatherInfo[] };
  const data = await get<Resp>("/v3/weather/weatherInfo", { city: adcode, extensions: "base" });
  return data?.lives[0] ?? null;
}
