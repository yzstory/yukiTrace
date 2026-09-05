import { notFound } from "next/navigation";
import { TripMap, type TripMapStop } from "@/components/map/trip-map";
import { requireTripAccess } from "@/lib/dal";
import { db } from "@/lib/db";
import { imageUrl } from "@/lib/storage";
import { dayIndex, tripDays, dayDate } from "@/lib/date";
import { dayColor } from "@/lib/geo";

export const metadata = { title: "地图" };

export default async function TripMapPage(props: PageProps<"/trips/[tripId]/map">) {
  const { tripId } = await props.params;
  await requireTripAccess(tripId);
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    include: {
      stops: {
        orderBy: [{ arriveAt: "asc" }, { order: "asc" }],
        include: { photos: { orderBy: { takenAt: "asc" }, take: 6, select: { id: true, ossKey: true } }, entries: { select: { title: true } }, legsTo: true },
      },
    },
  });
  if (!trip) notFound();

  const n = tripDays(trip.startDate, trip.endDate);
  const stops: TripMapStop[] = trip.stops.map((s, i) => {
    const di = Math.min(Math.max(dayIndex(trip.startDate, s.arriveAt), 1), n);
    const prev = trip.stops[i - 1];
    const legs = prev ? s.legsTo.filter((l) => l.fromStopId === prev.id) : [];
    const best = legs.find((l) => l.mode === "DRIVING") ?? legs.find((l) => l.mode === "WALKING") ?? legs.find((l) => l.mode === "STRAIGHT") ?? null;
    return {
      id: s.id,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      index: i + 1,
      group: di,
      color: dayColor(di),
      dayIndex: di,
      arriveAt: s.arriveAt,
      address: s.address,
      photos: s.photos.map((p) => ({ id: p.id, thumbUrl: imageUrl(p.ossKey, { w: 300 }) })),
      entryTitles: s.entries.map((e) => e.title),
      legFromPrev: best ? { distanceM: best.distanceM, durationS: best.durationS, mode: best.mode } : null,
    };
  });
  const usedDays = Array.from(new Set(stops.map((s) => s.dayIndex))).sort((a, b) => a - b);
  const days = usedDays.map((i) => ({ index: i, date: dayDate(trip.startDate, i), color: dayColor(i) }));

  return <TripMap tripId={tripId} stops={stops} days={days} homeLabel={trip.title} />;
}
