import Link from "next/link";
import { Plus, Footprints } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { TripCard, type TripCardData } from "@/components/trips/trip-card";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { imageUrl } from "@/lib/storage";
import { onThisDay } from "@/lib/ai/on-this-day";
import { OnThisDayCard } from "@/components/trips/on-this-day-card";

export const metadata = { title: "旅程" };

export default async function TripsPage() {
  const { userId } = await verifySession();
  const memories = await onThisDay(userId);
  const trips = await db.trip.findMany({
    where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    orderBy: { startDate: "desc" },
    include: {
      _count: { select: { stops: true } },
      expenses: { select: { amountHomeMinor: true } },
      stops: { select: { city: true }, distinct: ["city"], where: { city: { not: null } }, take: 4 },
    },
  });

  const cards: TripCardData[] = trips.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    coverUrl: t.coverKey ? imageUrl(t.coverKey, { w: 1200 }) : null,
    startDate: t.startDate,
    endDate: t.endDate,
    homeCurrency: t.homeCurrency,
    timezone: t.timezone,
    babyName: t.babyName,
    babyBirthDate: t.babyBirthDate,
    stopCount: t._count.stops,
    totalHomeMinor: t.expenses.reduce((s, e) => s + e.amountHomeMinor, 0),
    cities: t.stops.map((s) => s.city!).filter(Boolean),
  }));

  return (
    <>
      <PageHeader
        title="旅程"
        subtitle="Trace"
        action={
          <Button asChild size="icon" className="size-10 rounded-full float-shadow">
            <Link href="/trips/new" aria-label="新建旅程">
              <Plus className="size-5" strokeWidth={2.4} />
            </Link>
          </Button>
        }
      />
      <OnThisDayCard items={memories} />
      {cards.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-5">
          {cards.map((c, i) => (
            <TripCard key={c.id} trip={c} index={i} />
          ))}
        </div>
      )}
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center rounded-3xl bg-card px-6 py-14 text-center card-shadow">
      <span className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Footprints className="size-8" />
      </span>
      <h2 className="text-title-2">还没有旅程</h2>
      <p className="mt-1 max-w-xs text-subhead text-muted-foreground">创建第一段旅程，开始记录带宝宝出发的每一站。</p>
      <Button asChild className="mt-6 h-11 rounded-xl px-6 text-callout font-semibold">
        <Link href="/trips/new">
          <Plus className="size-4" /> 新建旅程
        </Link>
      </Button>
    </div>
  );
}
