"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTheme } from "next-themes";
import type { Map as MLMap, Marker as MLMarker, GeoJSONSource } from "maplibre-gl";
import { RouteSketch } from "./route-sketch";
import type { MapPoint, MapPath } from "./types";
import type { MapViewHandle } from "./map-view-types";

/**
 * 境外站点用 MapLibre + 免费矢量瓦片（高德海外数据较弱）。
 * 样式地址可由 NEXT_PUBLIC_MAP_STYLE_URL 覆盖，默认用 OpenFreeMap（无需 Key）。
 */
const STYLE_LIGHT = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/positron";
const STYLE_DARK = process.env.NEXT_PUBLIC_MAP_STYLE_DARK_URL || "https://tiles.openfreemap.org/styles/dark";

export function MapLibreView({
  points,
  paths,
  selectedId,
  onSelect,
  onReady,
  className,
}: {
  points: MapPoint[];
  paths: MapPath[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onReady?: (h: MapViewHandle) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<Map<string, MLMarker>>(new Map());
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let map: MLMap | null = null;

    void (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        await import("maplibre-gl/dist/maplibre-gl.css");
        if (cancelled || !containerRef.current) return;
        map = new maplibre.Map({
          container: containerRef.current,
          style: resolvedTheme === "dark" ? STYLE_DARK : STYLE_LIGHT,
          center: points[0] ? [points[0].lng, points[0].lat] : [139.7, 35.68],
          zoom: 10,
          attributionControl: { compact: true },
        });
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        mapRef.current = map;
        map.on("load", () => !cancelled && setStatus("ready"));
        map.on("error", () => !cancelled && setStatus("error"));
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // 主题切换时重建地图（换样式会丢图层，重建更简单可靠）
  }, [resolvedTheme, points]);

  // 标记与路线
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    let cancelled = false;

    void (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled || !mapRef.current) return;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();

      for (const p of points) {
        const el = document.createElement("div");
        el.className = "yt-marker";
        el.innerHTML = `<span style="background:${p.color}">${p.index}</span>`;
        el.addEventListener("click", () => onSelect?.(p.id));
        const marker = new maplibre.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
        markersRef.current.set(p.id, marker);
      }

      const src = "yt-routes";
      const data = {
        type: "FeatureCollection" as const,
        features: paths
          .filter((p) => p.points.length >= 2)
          .map((p) => ({
            type: "Feature" as const,
            properties: { color: p.color },
            geometry: { type: "LineString" as const, coordinates: p.points },
          })),
      };
      const existing = map.getSource(src);
      if (existing && "setData" in existing) {
        (existing as GeoJSONSource).setData(data);
      } else {
        map.addSource(src, { type: "geojson", data });
        map.addLayer({
          id: "yt-routes-line",
          type: "line",
          source: src,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": ["get", "color"], "line-width": 4, "line-opacity": 0.9 },
        });
      }

      if (points.length > 0) {
        const bounds = new maplibre.LngLatBounds();
        points.forEach((p) => bounds.extend([p.lng, p.lat]));
        map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 0 });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [points, paths, status, onSelect]);

  useEffect(() => {
    markersRef.current.forEach((m, id) => m.getElement().classList.toggle("is-selected", id === selectedId));
  }, [selectedId, points, status]);

  const focus = useCallback((id: string) => {
    const m = markersRef.current.get(id);
    const map = mapRef.current;
    if (m && map) map.easeTo({ center: m.getLngLat(), zoom: Math.max(map.getZoom(), 13), duration: 400 });
  }, []);

  const replay = useCallback(() => {
    const map = mapRef.current;
    const all = paths.flatMap((p) => p.points);
    if (!map || all.length < 2) return;
    let i = 0;
    const step = () => {
      if (i >= all.length || !mapRef.current) return;
      map.easeTo({ center: all[i] as [number, number], duration: 700 });
      i++;
      setTimeout(step, 750);
    };
    step();
  }, [paths]);

  useEffect(() => {
    onReady?.({ replay, focus });
  }, [onReady, replay, focus]);

  if (status === "error") {
    return (
      <div className={`relative overflow-hidden bg-card text-foreground ${className ?? ""}`}>
        <RouteSketch points={points} onSelect={onSelect} selectedId={selectedId} className="h-full w-full" />
      </div>
    );
  }

  return (
    <div className={`relative ${className ?? ""}`}>
      <div ref={containerRef} className="h-full w-full" />
      {status === "loading" && <div className="absolute inset-0 animate-pulse bg-fill" />}
    </div>
  );
}
