import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BackButton } from "@/components/layout/back-button";
import { TripHero } from "@/components/trips/trip-hero";
import { TripTabs } from "@/components/trips/trip-tabs";
import { Timeline } from "@/components/timeline/timeline";
import { QuickAdd } from "@/components/quick-add/quick-add";
import { TidySheet } from "@/components/records/tidy-sheet";
import { tidyReport } from "@/lib/tidy";
import { unstampedCitiesForTrip } from "@/lib/passport";
import { StampNudge } from "@/components/passport/stamp-nudge";
import { aiConfigured } from "@/lib/ai/model";
import { requireTripAccess } from "@/lib/dal";
import { db } from "@/lib/db";
import { tripDetail } from "@/lib/services/trips";
import { isApiError } from "@/lib/api/errors";
import { dayIndex, tripDays, dayDate } from "@/lib/date";
import type { TDay, TTrip } from "@/components/timeline/types";

export async function generateMetadata(props: PageProps<"/trips/[tripId]">): Promise<Metadata> {
  const { tripId } = await props.params;
  const trip = await db.trip.findUnique({ where: { id: tripId }, select: { title: true } });
  return { title: trip?.title ?? "旅程" };
}

export default async function TripPage(props: PageProps<"/trips/[tripId]">) {
  const { tripId } = await props.params;
  const { role, userId } = await requireTripAccess(tripId);
  const canEdit = role !== "VIEWER";

  // 与 /api/v1/trips/[tripId] 同一份数据；这里只负责按天分组
  const detail = await tripDetail({ userId }, tripId).catch((e) => {
    if (isApiError(e) && e.status === 404) notFound();
    throw e;
  });
  const { trip, stops } = detail;
  const tidy = await tidyReport(trip.id);
  const unstamped = await unstampedCitiesForTrip(userId, trip.id);

  const n = tripDays(trip.startDate, trip.endDate);
  const days: TDay[] = Array.from({ length: n }, (_, i) => ({
    index: i + 1,
    date: dayDate(trip.startDate, i + 1),
    note: detail.dailyNotes.find((d) => dayIndex(trip.startDate, d.date) === i + 1)?.content || null,
    aiDraft: detail.dailyNotes.find((d) => dayIndex(trip.startDate, d.date) === i + 1)?.aiDraft ?? null,
    stops: [],
    looseEntries: [],
    looseExpenses: [],
    loosePhotos: [],
    babyLogs: [],
    totalHomeMinor: 0,
  }));
  const dayFor = (d: Date) => {
    const idx = Math.min(Math.max(dayIndex(trip.startDate, d, trip.timezone), 1), n);
    return days[idx - 1];
  };
  for (const s of stops) {
    const d = dayFor(s.arriveAt);
    d.stops.push(s);
    d.totalHomeMinor += s.expenses.reduce((a, e) => a + e.amountHomeMinor, 0) + s.entries.reduce((a, en) => a + en.expenses.reduce((b, e) => b + e.amountHomeMinor, 0), 0);
  }
  for (const e of detail.looseEntries) {
    const d = dayFor(e.startAt);
    d.looseEntries.push(e);
    d.totalHomeMinor += e.expenses.reduce((a, x) => a + x.amountHomeMinor, 0);
  }
  for (const e of detail.looseExpenses) {
    const d = dayFor(e.paidAt);
    d.looseExpenses.push(e);
    d.totalHomeMinor += e.amountHomeMinor;
  }
  for (const p of detail.loosePhotos) dayFor(p.takenAt ?? trip.startDate).loosePhotos.push(p);
  for (const b of detail.babyLogs) dayFor(b.at).babyLogs.push({ id: b.id, type: b.type as TDay["babyLogs"][number]["type"], at: b.at, note: b.note });

  const ttrip: TTrip = {
    id: trip.id,
    title: trip.title,
    homeCurrency: trip.homeCurrency,
    startDate: trip.startDate,
    endDate: trip.endDate,
    babyName: trip.babyName,
    babyBirthDate: trip.babyBirthDate,
    canEdit,
    aiConfigured: aiConfigured(),
    timezone: trip.timezone,
    multiMember: trip.memberCount > 1,
  };

  return (
    <>
      <BackButton href="/trips" label="旅程" />
      <TripHero
        trip={{
          id: trip.id,
          title: trip.title,
          description: trip.description,
          coverUrl: trip.coverUrl,
          startDate: trip.startDate,
          endDate: trip.endDate,
          homeCurrency: trip.homeCurrency,
          timezone: trip.timezone,
          babyName: trip.babyName,
          babyBirthDate: trip.babyBirthDate,
          travelers: trip.travelers,
          stopCount: stops.length,
          totalHomeMinor: detail.totalHomeMinor,
          totalDistanceM: detail.totalDistanceM,
          canEdit,
        }}
        tidy={<TidySheet tripId={trip.id} report={tidy} canEdit={canEdit} />}
        tidyCount={tidy.count}
      />
      <TripTabs tripId={trip.id} />
      <StampNudge cities={unstamped} />
      <Timeline days={days} trip={ttrip} />
      {canEdit && (
        <QuickAdd
          tripId={trip.id}
          stops={stops.map((s) => ({ id: s.id, name: s.name, arriveAt: s.arriveAt }))}
          homeCurrency={trip.homeCurrency}
          tripStart={trip.startDate}
          tripEnd={trip.endDate}
          timezone={trip.timezone}
          aiEnabled={aiConfigured()}
        />
      )}
    </>
  );
}
