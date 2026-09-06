/// <reference types="@amap/amap-jsapi-types" />
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { RouteSketch } from "./route-sketch";
import type { MapPoint, MapPath } from "./types";

declare global {
  interface Window {
    _AMapSecurityConfig?: { securityJsCode: string };
  }
}

import type { MapViewHandle } from "./map-view-types";

export type AMapViewHandle = MapViewHandle;

export type AmapClientConfig = { key: string; securityCode: string };

export function AMapView({
  points,
  paths,
  selectedId,
  onSelect,
  onReady,
  className,
  amap,
}: {
  points: MapPoint[];
  paths: MapPath[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onReady?: (h: AMapViewHandle) => void;
  className?: string;
  /** 由服务端在运行时读取并传入，避免构建期内联导致部署后改配置不生效 */
  amap?: AmapClientConfig;
}) {
  const key = amap?.key || process.env.NEXT_PUBLIC_AMAP_JS_KEY;
  const securityCode = amap?.securityCode || process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<AMap.Map | null>(null);
  const markersRef = useRef<Map<string, AMap.Marker>>(new Map());
  const overlaysRef = useRef<AMap.Polyline[]>([]);
  const moverRef = useRef<AMap.Marker | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(key ? "loading" : "error");

  // 初始化地图
  useEffect(() => {
    if (!key || !containerRef.current) return;
    let cancelled = false;
    if (securityCode) {
      window._AMapSecurityConfig = { securityJsCode: securityCode };
    }
    import("@amap/amap-jsapi-loader")
      .then((mod) => mod.load({ key, version: "2.0", plugins: ["AMap.MoveAnimation"] }))
      .then((AMapNs: typeof AMap) => {
        if (cancelled || !containerRef.current) return;
        const map = new AMapNs.Map(containerRef.current, {
          viewMode: "2D",
          zoom: 11,
          mapStyle: "amap://styles/whitesmoke",
          showLabel: true,
          features: ["bg", "road", "building", "point"],
        });
        mapRef.current = map;
        setStatus("ready");
      })
      .catch((e) => {
        console.error("[amap] load failed", e);
        setStatus("error");
      });
    return () => {
      cancelled = true;
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, [key, securityCode]);

  // 渲染标记与路线
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    const AMapNs = window.AMap;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current.clear();
    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];

    for (const path of paths) {
      if (path.points.length < 2) continue;
      const line = new AMapNs.Polyline({
        path: path.points.map(([lng, lat]) => new AMapNs.LngLat(lng, lat)),
        strokeColor: path.color,
        strokeWeight: 4,
        strokeOpacity: 0.9,
        lineJoin: "round",
        lineCap: "round",
        showDir: true,
      });
      line.setMap(map);
      overlaysRef.current.push(line);
    }

    for (const p of points) {
      const el = document.createElement("div");
      el.className = "yt-marker";
      el.innerHTML = `<span style="background:${p.color}">${p.index}</span>`;
      const marker = new AMapNs.Marker({
        position: new AMapNs.LngLat(p.lng, p.lat),
        content: el,
        offset: new AMapNs.Pixel(-16, -16),
        title: p.name,
        extData: p.id,
      });
      marker.on("click", () => onSelect?.(p.id));
      marker.setMap(map);
      markersRef.current.set(p.id, marker);
    }
    if (points.length > 0) {
      map.setFitView(Array.from(markersRef.current.values()), false, [60, 60, 60, 60]);
    }
  }, [points, paths, status, onSelect]);

  // 选中态
  useEffect(() => {
    markersRef.current.forEach((m, id) => {
      const el = m.getContent() as HTMLElement | undefined;
      if (el && typeof el === "object") el.classList.toggle("is-selected", id === selectedId);
    });
  }, [selectedId, points]);

  const replay = useCallback(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    const AMapNs = window.AMap;
    const all = paths.flatMap((p) => p.points);
    if (all.length < 2) return;
    moverRef.current?.setMap(null);
    const el = document.createElement("div");
    el.className = "yt-mover";
    const mover = new AMapNs.Marker({ position: new AMapNs.LngLat(all[0][0], all[0][1]), content: el, offset: new AMapNs.Pixel(-10, -10) });
    mover.setMap(map);
    moverRef.current = mover;
    const lngLats = all.map(([lng, lat]) => new AMapNs.LngLat(lng, lat));
    const durationMs = Math.min(Math.max(all.length * 800, 4000), 20000);
    // moveAlong 的 duration 为每段时长
    mover.moveAlong(lngLats, { duration: Math.round(durationMs / (all.length - 1)), autoRotation: false });
    // MoveAnimation 事件不在类型声明里
    type Evented = { on: (name: string, cb: (e: { passedPath?: AMap.LngLat[] }) => void) => void };
    (mover as unknown as Evented).on("moving", (e) => {
      const last = e.passedPath?.[e.passedPath.length - 1];
      if (last) map.setCenter(last, true);
    });
    (mover as unknown as Evented).on("movealong", () => {
      setTimeout(() => {
        mover.setMap(null);
        map.setFitView(Array.from(markersRef.current.values()), false, [60, 60, 60, 60]);
      }, 600);
    });
  }, [paths, status]);

  const focus = useCallback((id: string) => {
    const m = markersRef.current.get(id);
    const map = mapRef.current;
    if (m && map) map.setZoomAndCenter(Math.max(map.getZoom(), 13), m.getPosition()!, false, 400);
  }, []);

  useEffect(() => {
    onReady?.({ replay, focus });
  }, [onReady, replay, focus]);

  if (status === "error") {
    return (
      <div className={`relative overflow-hidden bg-card text-foreground ${className ?? ""}`}>
        <RouteSketch points={points} onSelect={onSelect} selectedId={selectedId} className="h-full w-full" />
        {!key && (
          <p className="absolute inset-x-0 bottom-0 glass px-4 py-2 text-center text-caption text-muted-foreground">
            未配置高德 Key，当前为路线示意图。在服务器 .env 填写 AMAP_JS_KEY 与 AMAP_SECURITY_CODE 后重启即可显示真实地图。
          </p>
        )}
      </div>
    );
  }
  return (
    <div className={`relative ${className ?? ""}`}>
      <div ref={containerRef} className="h-full w-full" />
      {status === "loading" && (
        <div className="absolute inset-0 bg-card text-foreground">
          <RouteSketch points={points} className="h-full w-full opacity-70" />
        </div>
      )}
    </div>
  );
}
