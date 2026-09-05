"use client";

import { useMemo } from "react";
import type { MapPoint } from "./types";

/**
 * 无高德 Key 时的降级视图：把坐标等距投影到 SVG 上画一张极简路线图。
 * 也用于分享页与总结页的装饰。
 */
export function RouteSketch({ points, onSelect, selectedId, className }: { points: MapPoint[]; onSelect?: (id: string) => void; selectedId?: string | null; className?: string }) {
  const W = 800;
  const H = 520;
  const PAD = 60;
  const layout = useMemo(() => {
    if (points.length === 0) return [];
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const midLat = (minLat + maxLat) / 2;
    const kx = Math.cos((midLat * Math.PI) / 180);
    const spanX = Math.max((maxLng - minLng) * kx, 0.0005);
    const spanY = Math.max(maxLat - minLat, 0.0005);
    const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
    const ox = (W - spanX * scale) / 2;
    const oy = (H - spanY * scale) / 2;
    return points.map((p) => ({ ...p, x: ox + (p.lng - minLng) * kx * scale, y: H - (oy + (p.lat - minLat) * scale) }));
  }, [points]);

  if (layout.length === 0) {
    return <div className={`flex items-center justify-center text-subhead text-muted-foreground ${className ?? ""}`}>还没有站点</div>;
  }

  const path = layout.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label="路线示意图">
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeOpacity="0.06" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#grid)" />
      <path d={path} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="1 10" />
      {layout.map((p, i) => {
        const next = layout[i + 1];
        return next ? <line key={`l${p.id}`} x1={p.x} y1={p.y} x2={next.x} y2={next.y} stroke={p.color} strokeWidth="2.5" strokeLinecap="round" opacity="0.9" /> : null;
      })}
      {layout.map((p) => {
        const sel = p.id === selectedId;
        return (
          <g key={p.id} onClick={() => onSelect?.(p.id)} className={onSelect ? "cursor-pointer" : ""}>
            <circle cx={p.x} cy={p.y} r={sel ? 18 : 14} fill={p.color} stroke="white" strokeWidth="3" />
            <text x={p.x} y={p.y + 4.5} textAnchor="middle" fontSize="13" fontWeight="700" fill="white">
              {p.index}
            </text>
            <text x={p.x} y={p.y - 22} textAnchor="middle" fontSize="13" fontWeight="600" fill="currentColor" opacity="0.8">
              {p.name.length > 10 ? p.name.slice(0, 10) + "…" : p.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
