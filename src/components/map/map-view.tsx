"use client";

import { useMemo } from "react";
import { AMapView, type AmapClientConfig } from "./amap-view";
import { MapLibreView } from "./maplibre-view";
import { isInChina } from "@/lib/geo";
import type { MapPoint, MapPath } from "./types";
import type { MapViewHandle } from "./map-view-types";

/**
 * 按站点位置选地图：国内用高德（数据准），境外用 MapLibre（高德海外数据弱）。
 * 两者接口一致，上层组件无需关心。
 */
export function MapView(props: {
  points: MapPoint[];
  paths: MapPath[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onReady?: (h: MapViewHandle) => void;
  className?: string;
  amap?: AmapClientConfig;
}) {
  const overseas = useMemo(() => {
    if (props.points.length === 0) return false;
    const outside = props.points.filter((p) => !isInChina(p)).length;
    // 多数站点在境外时切换；国内外混合的旅程仍用高德，避免国内段掉精度
    return outside > props.points.length / 2;
  }, [props.points]);

  return overseas ? <MapLibreView {...props} /> : <AMapView {...props} />;
}

export type { MapViewHandle, AmapClientConfig };
