import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { TripForm } from "@/components/trips/trip-form";
import { BackButton } from "@/components/layout/back-button";
import { DeleteTripButton } from "@/components/trips/delete-trip-button";
import { updateTrip } from "@/app/(app)/trips/actions";
import { requireTripAccess } from "@/lib/dal";
import { db } from "@/lib/db";

export const metadata = { title: "编辑旅程" };

export default async function EditTripPage(props: PageProps<"/trips/[tripId]/edit">) {
  const { tripId } = await props.params;
  const { role } = await requireTripAccess(tripId, "EDITOR");
  const trip = await db.trip.findUnique({ where: { id: tripId } });
  if (!trip) notFound();
  const action = updateTrip.bind(null, tripId);
  return (
    <>
      <BackButton href={`/trips/${tripId}`} label={trip.title} />
      <PageHeader title="编辑旅程" />
      <TripForm action={action} initial={trip} submitLabel="保存" />
      {role === "OWNER" && <DeleteTripButton tripId={tripId} title={trip.title} />}
    </>
  );
}
