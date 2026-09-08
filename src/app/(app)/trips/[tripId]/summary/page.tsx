import { BackButton } from "@/components/layout/back-button";
import { SummarySlides } from "@/components/summary/summary-slides";
import { requireTripAccess } from "@/lib/dal";
import { tripSummary } from "@/lib/services/review";

export const metadata = { title: "旅程总结" };

export default async function SummaryPage(props: PageProps<"/trips/[tripId]/summary">) {
  const { tripId } = await props.params;
  const { userId } = await requireTripAccess(tripId);
  // 与 /api/v1/trips/{id}/summary 同一份数据
  const data = await tripSummary({ userId }, tripId);

  return (
    <>
      <BackButton href={`/trips/${tripId}`} label={data.title} />
      <h1 className="mb-4 text-large-title">旅程总结</h1>
      <SummarySlides data={data} />
    </>
  );
}
