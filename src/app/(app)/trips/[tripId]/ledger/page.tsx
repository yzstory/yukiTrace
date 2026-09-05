import { notFound } from "next/navigation";
import { BackButton } from "@/components/layout/back-button";
import { TripTabs } from "@/components/trips/trip-tabs";
import { LedgerView, type LedgerExpense } from "@/components/ledger/ledger-view";
import { requireTripAccess } from "@/lib/dal";
import { db } from "@/lib/db";
import { dayIndex, tripDays, dayDate } from "@/lib/date";
import { deleteExpense } from "@/app/(app)/trips/[tripId]/actions";
import { tripInsights } from "@/lib/ai/insights";
import { InsightsRow } from "@/components/ledger/insights-row";
import { Download } from "lucide-react";

export const metadata = { title: "账本" };

export default async function TripLedgerPage(props: PageProps<"/trips/[tripId]/ledger">) {
  const { tripId } = await props.params;
  const { role } = await requireTripAccess(tripId);
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    include: { expenses: { orderBy: { paidAt: "desc" }, include: { stop: { select: { name: true } }, entry: { select: { stop: { select: { name: true } } } } } } },
  });
  if (!trip) notFound();
  const insights = await tripInsights(tripId);
  const n = tripDays(trip.startDate, trip.endDate);
  const days = Array.from({ length: n }, (_, i) => ({ index: i + 1, date: dayDate(trip.startDate, i + 1) }));
  const expenses: LedgerExpense[] = trip.expenses.map((e) => ({
    id: e.id,
    title: e.title,
    amountMinor: e.amountMinor,
    currency: e.currency,
    amountHomeMinor: e.amountHomeMinor,
    category: e.category,
    isBaby: e.isBaby,
    paidAt: e.paidAt,
    dayIndex: Math.min(Math.max(dayIndex(trip.startDate, e.paidAt, trip.timezone), 1), n),
    stopName: e.stop?.name ?? e.entry?.stop?.name ?? null,
    tripId,
  }));

  async function onDelete(tid: string, id: string) {
    "use server";
    await deleteExpense(tid, id);
  }

  return (
    <>
      <BackButton href="/trips" label="旅程" />
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-title-1">{trip.title}</h1>
        <a href={`/api/export/${tripId}?kind=expenses`} className="flex items-center gap-1 rounded-full bg-card px-3 py-1.5 text-footnote font-medium text-primary card-shadow" download>
          <Download className="size-3.5" /> 导出 CSV
        </a>
      </div>
      <TripTabs tripId={tripId} />
      <div className="mb-5">
        <InsightsRow insights={insights} />
      </div>
      <LedgerView expenses={expenses} days={days} homeCurrency={trip.homeCurrency} timezone={trip.timezone} canEdit={role !== "VIEWER"} onDelete={onDelete} />
    </>
  );
}
