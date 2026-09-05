"use client";

import Link from "next/link";
import Image from "next/image";
import { CalendarDays, Footprints, Wallet, Baby } from "lucide-react";
import { formatMoney } from "@/lib/currency";
import { fmt, tripDays, babyAge } from "@/lib/date";

export type TripCardData = {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  startDate: Date;
  endDate: Date;
  homeCurrency: string;
  babyName: string | null;
  babyBirthDate: Date | null;
  stopCount: number;
  totalHomeMinor: number;
  cities: string[];
};

const GRADIENTS = [
  "from-ios-blue/80 to-ios-indigo/80",
  "from-ios-orange/80 to-ios-pink/80",
  "from-ios-teal/80 to-ios-green/80",
  "from-ios-purple/80 to-ios-pink/70",
];

export function TripCard({ trip, index }: { trip: TripCardData; index: number }) {
  const gradient = GRADIENTS[index % GRADIENTS.length];
  return (
    <Link href={`/trips/${trip.id}`} className="pressable block overflow-hidden rounded-3xl bg-card card-shadow">
      <div className={`relative aspect-[16/10] w-full bg-gradient-to-br ${gradient}`}>
          {trip.coverUrl ? (
            <Image src={trip.coverUrl} alt={trip.title} fill sizes="(max-width: 768px) 100vw, 720px" className="object-cover" unoptimized />
          ) : (
            <Footprints className="absolute right-6 top-6 size-16 text-white/30" strokeWidth={1.5} />
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent p-5 pt-16 text-white">
            <p className="text-footnote font-medium text-white/80">
              {fmt.date(trip.startDate)} – {fmt.date(trip.endDate)} · {tripDays(trip.startDate, trip.endDate)} 天
            </p>
            <h2 className="mt-0.5 text-title-1 text-white">{trip.title}</h2>
            {trip.cities.length > 0 && <p className="mt-0.5 truncate text-subhead text-white/85">{trip.cities.join(" · ")}</p>}
          </div>
      </div>
      <div className="flex items-center gap-4 px-5 py-3.5 text-footnote text-muted-foreground">
          <Stat icon={Footprints} text={`${trip.stopCount} 站`} />
          <Stat icon={Wallet} text={formatMoney(trip.totalHomeMinor, trip.homeCurrency, { compact: true })} />
          {trip.babyBirthDate && (
            <Stat icon={Baby} text={`${trip.babyName ?? "宝宝"} ${babyAge(trip.babyBirthDate, trip.startDate)}`} />
          )}
          <span className="ml-auto flex items-center gap-1">
            <CalendarDays className="size-3.5" />
            {fmt.monthYear(trip.startDate)}
          </span>
      </div>
    </Link>
  );
}

function Stat({ icon: Icon, text }: { icon: typeof Footprints; text: string }) {
  return (
    <span className="flex items-center gap-1">
      <Icon className="size-3.5" />
      {text}
    </span>
  );
}
