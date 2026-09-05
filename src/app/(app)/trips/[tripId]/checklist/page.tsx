import { notFound } from "next/navigation";
import { BackButton } from "@/components/layout/back-button";
import { Checklist } from "@/components/checklist/checklist";
import { requireTripAccess } from "@/lib/dal";
import { db } from "@/lib/db";
import { aiConfigured } from "@/lib/ai/model";

export const metadata = { title: "出行清单" };

export default async function ChecklistPage(props: PageProps<"/trips/[tripId]/checklist">) {
  const { tripId } = await props.params;
  const { role } = await requireTripAccess(tripId);
  const trip = await db.trip.findUnique({ where: { id: tripId }, select: { title: true, checklist: { orderBy: { order: "asc" } } } });
  if (!trip) notFound();
  return (
    <>
      <BackButton href={`/trips/${tripId}`} label={trip.title} />
      <h1 className="mb-4 text-large-title">出行清单</h1>
      <Checklist tripId={tripId} items={trip.checklist} canEdit={role !== "VIEWER"} aiConfigured={aiConfigured()} />
    </>
  );
}
