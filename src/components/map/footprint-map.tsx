"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MapView, type AmapClientConfig } from "./map-view";
import type { MapPoint, MapPath } from "./types";

type Trip = { id: string; title: string; color: string; stops: Array<{ id: string; name: string; lat: number; lng: number }> };

export function FootprintMap({ trips, className, amap }: { trips: Trip[]; className?: string; amap?: AmapClientConfig }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const points: MapPoint[] = useMemo(
    () => trips.flatMap((t, ti) => t.stops.map((s, i) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, index: i + 1, group: ti, color: t.color, subtitle: t.title, href: `/trips/${t.id}/map` }))),
    [trips]
  );
  const paths: MapPath[] = useMemo(() => trips.map((t, ti) => ({ group: ti, color: t.color, points: t.stops.map((s) => [s.lng, s.lat] as [number, number]) })), [trips]);
  const onSelect = useCallback(
    (id: string) => {
      setSelected(id);
      const p = points.find((x) => x.id === id);
      if (p?.href) router.push(p.href);
    },
    [points, router]
  );
  return <MapView points={points} paths={paths} selectedId={selected} onSelect={onSelect} className={className} amap={amap} />;
}
