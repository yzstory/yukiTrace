import { notFound } from "next/navigation";
import { BackButton } from "@/components/layout/back-button";
import { TripTabs } from "@/components/trips/trip-tabs";
import { PhotoGrid, type GalleryDay } from "@/components/photos/photo-grid";
import { requireTripAccess } from "@/lib/dal";
import { db } from "@/lib/db";
import { imageUrl } from "@/lib/storage";
import { dayIndex, tripDays, dayDate } from "@/lib/date";
import { deletePhoto } from "@/app/(app)/trips/[tripId]/actions";
import { setTripCover } from "@/app/(app)/trips/actions";

export const metadata = { title: "照片" };

export default async function TripPhotosPage(props: PageProps<"/trips/[tripId]/photos">) {
  const { tripId } = await props.params;
  const { role } = await requireTripAccess(tripId);
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    include: { photos: { orderBy: [{ takenAt: "asc" }, { createdAt: "asc" }], include: { stop: { select: { name: true, arriveAt: true } } } } },
  });
  if (!trip) notFound();
  const n = tripDays(trip.startDate, trip.endDate);
  const days: GalleryDay[] = Array.from({ length: n }, (_, i) => ({ index: i + 1, date: dayDate(trip.startDate, i + 1), photos: [] }));
  for (const p of trip.photos) {
    const at = p.takenAt ?? p.stop?.arriveAt ?? trip.startDate;
    const di = Math.min(Math.max(dayIndex(trip.startDate, at, trip.timezone), 1), n);
    days[di - 1].photos.push({
      id: p.id,
      url: imageUrl(p.ossKey, { w: 1600 }),
      thumbUrl: imageUrl(p.ossKey, { w: 400 }),
      width: p.width,
      height: p.height,
      caption: p.caption ?? p.aiCaption,
      firstMoment: p.firstMoment,
      takenAt: p.takenAt,
      stopName: p.stop?.name ?? null,
    });
  }

  async function onDelete(id: string) {
    "use server";
    await deletePhoto(tripId, id);
  }
  async function onSetCover(id: string) {
    "use server";
    const photo = await db.photo.findUnique({ where: { id, tripId }, select: { ossKey: true } });
    if (photo) await setTripCover(tripId, photo.ossKey);
  }

  return (
    <>
      <BackButton href="/trips" label="旅程" />
      <h1 className="mb-3 text-title-1">{trip.title}</h1>
      <TripTabs tripId={tripId} />
      <PhotoGrid days={days} timezone={trip.timezone} canEdit={role !== "VIEWER"} onDelete={onDelete} onSetCover={onSetCover} />
    </>
  );
}
