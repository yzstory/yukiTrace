import Link from "next/link";
import { Footprints } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { FootprintMap } from "@/components/map/footprint-map";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { DAY_COLORS, formatDistance, haversine } from "@/lib/geo";
import { fmt } from "@/lib/date";
import { getAmapClientConfig } from "@/lib/amap-client-config";

export const metadata = { title: "足迹" };

export default async function MapPage() {
  const { userId } = await verifySession();
  const trips = await db.trip.findMany({
    where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    orderBy: { startDate: "asc" },
    include: { stops: { orderBy: [{ arriveAt: "asc" }, { order: "asc" }], select: { id: true, name: true, lat: true, lng: true, city: true } } },
  });

  const colored = trips.map((t, i) => ({ ...t, color: i < DAY_COLORS.length - 1 ? DAY_COLORS[i] : DAY_COLORS[DAY_COLORS.length - 1] }));
  const cities = new Set<string>();
  let totalM = 0;
  for (const t of trips) {
    t.stops.forEach((s) => s.city && cities.add(s.city));
    for (let i = 1; i < t.stops.length; i++) totalM += haversine(t.stops[i - 1], t.stops[i]);
  }
  const stopCount = trips.reduce((a, t) => a + t.stops.length, 0);

  return (
    <>
      <PageHeader title="足迹" subtitle="Footprints" />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Kpi value={String(trips.length)} label="段旅程" />
        <Kpi value={String(cities.size)} label="座城市" />
        <Kpi value={stopCount ? formatDistance(totalM) : "—"} label="直线里程" />
      </div>
      <div className="overflow-hidden rounded-3xl bg-card card-shadow">
        <FootprintMap
          amap={getAmapClientConfig()}
          className="h-[52dvh] min-h-80 w-full"
          trips={colored.map((t) => ({ id: t.id, title: t.title, color: t.color, stops: t.stops.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng })) }))}
        />
      </div>
      <ul className="mt-5 flex flex-col gap-2">
        {colored.map((t) => (
          <li key={t.id}>
            <Link href={`/trips/${t.id}/map`} className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 card-shadow">
              <span className="size-3 rounded-full" style={{ background: t.color }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-callout font-medium">{t.title}</span>
                <span className="block text-caption text-muted-foreground">
                  {fmt.monthYear(t.startDate)} · {t.stops.length} 站
                </span>
              </span>
              <Footprints className="size-4 text-label-tertiary" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function Kpi({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-card px-3 py-3 text-center card-shadow">
      <p className="display-number whitespace-nowrap text-[1.5rem] leading-none">{value}</p>
      <p className="text-caption text-muted-foreground">{label}</p>
    </div>
  );
}
