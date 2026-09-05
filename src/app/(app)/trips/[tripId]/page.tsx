import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BackButton } from "@/components/layout/back-button";
import { TripHero } from "@/components/trips/trip-hero";
import { TripTabs } from "@/components/trips/trip-tabs";
import { Timeline } from "@/components/timeline/timeline";
import { QuickAdd } from "@/components/quick-add/quick-add";
import { AiChat } from "@/components/ai/ai-chat";
import { aiConfigured } from "@/lib/ai/model";
import { requireTripAccess } from "@/lib/dal";
import { db } from "@/lib/db";
import { imageUrl } from "@/lib/storage";
import { dayIndex, tripDays, dayDate } from "@/lib/date";
import type { TDay, TEntry, TExpense, TPhoto, TStop, TTrip } from "@/components/timeline/types";

export async function generateMetadata(props: PageProps<"/trips/[tripId]">): Promise<Metadata> {
  const { tripId } = await props.params;
  const trip = await db.trip.findUnique({ where: { id: tripId }, select: { title: true } });
  return { title: trip?.title ?? "旅程" };
}

export default async function TripPage(props: PageProps<"/trips/[tripId]">) {
  const { tripId } = await props.params;
  const { role } = await requireTripAccess(tripId);
  const canEdit = role !== "VIEWER";

  const trip = await db.trip.findUnique({
    where: { id: tripId },
    include: {
      stops: {
        orderBy: [{ arriveAt: "asc" }, { order: "asc" }],
        include: {
          entries: { orderBy: { startAt: "asc" }, include: { expenses: true, photos: { orderBy: { takenAt: "asc" } } } },
          expenses: { where: { entryId: null }, orderBy: { paidAt: "asc" } },
          photos: { where: { entryId: null }, orderBy: { takenAt: "asc" } },
          legsTo: true,
        },
      },
      entries: { where: { stopId: null }, orderBy: { startAt: "asc" }, include: { expenses: true, photos: true } },
      expenses: { where: { stopId: null, entryId: null }, orderBy: { paidAt: "asc" } },
      photos: { where: { stopId: null, entryId: null }, orderBy: { takenAt: "asc" } },
      dailyNotes: true,
      babyLogs: { orderBy: { at: "asc" } },
    },
  });
  if (!trip) notFound();

  const toPhoto = (p: (typeof trip.photos)[number]): TPhoto => ({
    id: p.id,
    url: imageUrl(p.ossKey, { w: 1600 }),
    thumbUrl: imageUrl(p.ossKey, { w: 300 }),
    width: p.width,
    height: p.height,
    caption: p.caption,
    takenAt: p.takenAt,
  });
  const toExpense = (e: (typeof trip.expenses)[number]): TExpense => ({
    id: e.id,
    title: e.title,
    amountMinor: e.amountMinor,
    currency: e.currency,
    amountHomeMinor: e.amountHomeMinor,
    category: e.category,
    isBaby: e.isBaby,
    paidAt: e.paidAt,
  });
  const toEntry = (e: (typeof trip.entries)[number]): TEntry => ({
    id: e.id,
    type: e.type,
    title: e.title,
    note: e.note,
    startAt: e.startAt,
    endAt: e.endAt,
    meta: (e.meta as Record<string, unknown> | null) ?? null,
    expenses: e.expenses.map(toExpense),
    photos: e.photos.map(toPhoto),
  });

  const stops: TStop[] = trip.stops.map((s, i) => {
    const prev = trip.stops[i - 1];
    const legs = prev ? s.legsTo.filter((l) => l.fromStopId === prev.id) : [];
    const best = legs.find((l) => l.mode === "DRIVING") ?? legs.find((l) => l.mode === "WALKING") ?? legs.find((l) => l.mode === "STRAIGHT") ?? null;
    return {
      id: s.id,
      name: s.name,
      type: s.type,
      lat: s.lat,
      lng: s.lng,
      address: s.address,
      city: s.city,
      arriveAt: s.arriveAt,
      leaveAt: s.leaveAt,
      note: s.note,
      babyTags: s.babyTags,
      weather: (s.weather as TStop["weather"]) ?? null,
      entries: s.entries.map(toEntry),
      expenses: s.expenses.map(toExpense),
      photos: s.photos.map(toPhoto),
      legFromPrev: best ? { mode: best.mode, distanceM: best.distanceM, durationS: best.durationS } : null,
    };
  });

  const totalDistanceM = stops.reduce((a, s) => a + (s.legFromPrev?.distanceM ?? 0), 0);

  const n = tripDays(trip.startDate, trip.endDate);
  const days: TDay[] = Array.from({ length: n }, (_, i) => ({
    index: i + 1,
    date: dayDate(trip.startDate, i + 1),
    note: trip.dailyNotes.find((d) => dayIndex(trip.startDate, d.date) === i + 1)?.content || null,
    aiDraft: trip.dailyNotes.find((d) => dayIndex(trip.startDate, d.date) === i + 1)?.aiDraft ?? null,
    stops: [],
    looseEntries: [],
    looseExpenses: [],
    loosePhotos: [],
    babyLogs: [],
    totalHomeMinor: 0,
  }));
  const dayFor = (d: Date) => {
    const idx = Math.min(Math.max(dayIndex(trip.startDate, d), 1), n);
    return days[idx - 1];
  };
  for (const s of stops) {
    const d = dayFor(s.arriveAt);
    d.stops.push(s);
    d.totalHomeMinor += s.expenses.reduce((a, e) => a + e.amountHomeMinor, 0) + s.entries.reduce((a, en) => a + en.expenses.reduce((b, e) => b + e.amountHomeMinor, 0), 0);
  }
  for (const e of trip.entries.map(toEntry)) {
    const d = dayFor(e.startAt);
    d.looseEntries.push(e);
    d.totalHomeMinor += e.expenses.reduce((a, x) => a + x.amountHomeMinor, 0);
  }
  for (const e of trip.expenses.map(toExpense)) {
    const d = dayFor(e.paidAt);
    d.looseExpenses.push(e);
    d.totalHomeMinor += e.amountHomeMinor;
  }
  for (const p of trip.photos.map(toPhoto)) dayFor(p.takenAt ?? trip.startDate).loosePhotos.push(p);
  for (const b of trip.babyLogs) dayFor(b.at).babyLogs.push({ id: b.id, type: b.type, at: b.at, note: b.note });

  const totalHomeMinor = days.reduce((a, d) => a + d.totalHomeMinor, 0);

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
  };

  return (
    <>
      <BackButton href="/trips" label="旅程" />
      <TripHero
        trip={{
          id: trip.id,
          title: trip.title,
          description: trip.description,
          coverUrl: trip.coverKey ? imageUrl(trip.coverKey, { w: 1600 }) : null,
          startDate: trip.startDate,
          endDate: trip.endDate,
          homeCurrency: trip.homeCurrency,
          babyName: trip.babyName,
          babyBirthDate: trip.babyBirthDate,
          travelers: trip.travelers,
          stopCount: stops.length,
          totalHomeMinor,
          totalDistanceM,
          canEdit,
        }}
      />
      <TripTabs tripId={trip.id} />
      <Timeline days={days} trip={ttrip} />
      <AiChat tripId={trip.id} homeCurrency={trip.homeCurrency} configured={aiConfigured()} canEdit={canEdit} />
      {canEdit && (
        <QuickAdd
          tripId={trip.id}
          stops={stops.map((s) => ({ id: s.id, name: s.name, arriveAt: s.arriveAt }))}
          homeCurrency={trip.homeCurrency}
          tripStart={trip.startDate}
          tripEnd={trip.endDate}
        />
      )}
    </>
  );
}
