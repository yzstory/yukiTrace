import { PageHeader } from "@/components/layout/page-header";
import { TripForm } from "@/components/trips/trip-form";
import { createTrip } from "@/app/(app)/trips/actions";
import { BackButton } from "@/components/layout/back-button";

export const metadata = { title: "新建旅程" };

export default function NewTripPage() {
  return (
    <>
      <BackButton href="/trips" label="旅程" />
      <PageHeader title="新建旅程" />
      <TripForm action={createTrip} submitLabel="创建旅程" />
    </>
  );
}
