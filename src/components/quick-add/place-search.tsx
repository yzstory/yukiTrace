"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, LocateFixed, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { wgs84ToGcj02 } from "@/lib/geo";

export type PlacePick = { name: string; lat: number; lng: number; address?: string; city?: string; amapPoiId?: string };
type Poi = { id: string; name: string; address: string; city: string; lat: number; lng: number };

export function PlaceSearch({ onPick, initial }: { onPick: (p: PlacePick) => void; initial?: PlacePick | null }) {
  const [q, setQ] = useState(initial?.name ?? "");
  const [results, setResults] = useState<Poi[]>([]);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [picked, setPicked] = useState<PlacePick | null>(initial ?? null);
  const [manual, setManual] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function search(text: string) {
    clearTimeout(timer.current);
    if (!text.trim()) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/amap/search?q=${encodeURIComponent(text)}`);
        const json = (await res.json()) as { results: Poi[]; configured: boolean };
        setConfigured(json.configured);
        setResults(json.results);
        if (!json.configured) setManual(true);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  function pick(p: PlacePick) {
    setPicked(p);
    setQ(p.name);
    setResults([]);
    onPick(p);
  }

  function locate() {
    if (!navigator.geolocation) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false);
        const g = wgs84ToGcj02({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        pick({ name: q || "当前位置", lat: g.lat, lng: g.lng });
        setManual(true);
      },
      () => setLoading(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-label-tertiary" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (picked) setPicked(null);
            search(e.target.value);
          }}
          placeholder="搜索地点，或直接输入名称"
          className="h-11 rounded-xl bg-fill-secondary pl-9 pr-10 text-body"
          autoComplete="off"
        />
        <button type="button" onClick={locate} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-primary active:bg-primary/10" aria-label="使用当前位置">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
        </button>
      </div>

      {results.length > 0 && (
        <ul className="max-h-56 overflow-y-auto rounded-xl bg-card card-shadow">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => pick({ name: r.name, lat: r.lat, lng: r.lng, address: r.address, city: r.city, amapPoiId: r.id })}
                className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left active:bg-fill"
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block truncate text-callout">{r.name}</span>
                  <span className="block truncate text-caption text-muted-foreground">
                    {r.city} {r.address}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {configured === false && !picked && (
        <p className="text-caption text-muted-foreground">未配置高德 Key，暂时无法搜索。可以点右侧定位图标，或手动填写坐标。</p>
      )}

      <button type="button" onClick={() => setManual((v) => !v)} className="self-start text-caption text-primary">
        {manual ? "收起坐标" : "手动填写坐标"}
      </button>
      <div className={cn("grid grid-cols-2 gap-2", !manual && "hidden")}>
        <Input
          type="number"
          step="any"
          name="lat"
          placeholder="纬度 lat"
          value={picked?.lat ?? ""}
          onChange={(e) => setPicked((p) => ({ ...(p ?? { name: q, lng: 0 }), name: q || p?.name || "", lat: parseFloat(e.target.value) }))}
          onBlur={() => picked && Number.isFinite(picked.lat) && Number.isFinite(picked.lng) && onPick({ ...picked, name: q || picked.name })}
          className="h-10 rounded-xl bg-fill-secondary"
        />
        <Input
          type="number"
          step="any"
          name="lng"
          placeholder="经度 lng"
          value={picked?.lng ?? ""}
          onChange={(e) => setPicked((p) => ({ ...(p ?? { name: q, lat: 0 }), name: q || p?.name || "", lng: parseFloat(e.target.value) }))}
          onBlur={() => picked && Number.isFinite(picked.lat) && Number.isFinite(picked.lng) && onPick({ ...picked, name: q || picked.name })}
          className="h-10 rounded-xl bg-fill-secondary"
        />
      </div>
      {!manual && picked && (
        <>
          <input type="hidden" name="lat" value={picked.lat} />
          <input type="hidden" name="lng" value={picked.lng} />
        </>
      )}
      <input type="hidden" name="name" value={q} />
      <input type="hidden" name="address" value={picked?.address ?? ""} />
      <input type="hidden" name="city" value={picked?.city ?? ""} />
      <input type="hidden" name="amapPoiId" value={picked?.amapPoiId ?? ""} />
    </div>
  );
}
