"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Pencil, Footprints, Wallet, Baby, Users, ImagePlus, Route, ListChecks, Sparkle } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { formatMoney } from "@/lib/currency";
import { formatDistance } from "@/lib/geo";
import { fmt, tripDays, babyAge } from "@/lib/date";
import { PhotoUploader } from "@/components/quick-add/photo-uploader";

export type TripHeroData = {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  startDate: Date;
  endDate: Date;
  homeCurrency: string;
  babyName: string | null;
  babyBirthDate: Date | null;
  travelers: string[];
  stopCount: number;
  totalHomeMinor: number;
  totalDistanceM: number;
  canEdit: boolean;
};

export function TripHero({ trip }: { trip: TripHeroData }) {
  const [coverOpen, setCoverOpen] = useState(false);
  return (
    <section className="mb-6 overflow-hidden rounded-3xl bg-card card-shadow">
      <div className="relative aspect-[16/9] w-full bg-gradient-to-br from-ios-blue/80 to-ios-indigo/80">
        {trip.coverUrl ? (
          <Image src={trip.coverUrl} alt={trip.title} fill sizes="(max-width: 768px) 100vw, 720px" className="object-cover" priority unoptimized />
        ) : (
          <Footprints className="absolute right-6 top-6 size-20 text-white/25" strokeWidth={1.5} />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/25 to-transparent p-5 pt-20 text-white">
          <p className="text-footnote font-medium text-white/80">
            {fmt.dateFull(trip.startDate)} – {fmt.date(trip.endDate)} · {tripDays(trip.startDate, trip.endDate)} 天
          </p>
          <h1 className="mt-0.5 text-large-title text-white">{trip.title}</h1>
          {trip.description && <p className="mt-1 text-subhead text-white/85">{trip.description}</p>}
        </div>
        <div className="absolute right-3 top-3 flex gap-2 safe-top">
          <Link href={`/trips/${trip.id}/summary`} className="pressable glass rounded-full p-2 text-foreground" aria-label="旅程总结">
            <Sparkle className="size-4" />
          </Link>
          {trip.canEdit && (
            <>
            <button type="button" onClick={() => setCoverOpen(true)} className="pressable glass rounded-full p-2 text-foreground" aria-label="更换封面">
              <ImagePlus className="size-4" />
            </button>
            <Link href={`/trips/${trip.id}/checklist`} className="pressable glass rounded-full p-2 text-foreground" aria-label="出行清单">
              <ListChecks className="size-4" />
            </Link>
            <Link href={`/trips/${trip.id}/edit`} className="pressable glass rounded-full p-2 text-foreground" aria-label="编辑旅程">
              <Pencil className="size-4" />
            </Link>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border/60 px-2 py-3 text-center">
        <Stat icon={Footprints} value={`${trip.stopCount}`} label="站" />
        <Stat icon={Route} value={trip.totalDistanceM ? formatDistance(trip.totalDistanceM) : "—"} label="里程" />
        <Stat icon={Wallet} value={formatMoney(trip.totalHomeMinor, trip.homeCurrency, { compact: true })} label="花费" />
      </div>

      {(trip.travelers.length > 0 || trip.babyBirthDate) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-5 py-3 text-footnote text-muted-foreground">
          {trip.babyBirthDate && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ios-teal/15 px-2.5 py-1 font-medium text-ios-teal">
              <Baby className="size-3.5" /> {trip.babyName ?? "宝宝"} · 出发时 {babyAge(trip.babyBirthDate, trip.startDate)}
            </span>
          )}
          {trip.travelers.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" /> {trip.travelers.join("、")}
            </span>
          )}
        </div>
      )}

      <Drawer open={coverOpen} onOpenChange={setCoverOpen}>
        <DrawerContent className="rounded-t-3xl bg-background">
          <DrawerHeader>
            <DrawerTitle>更换封面</DrawerTitle>
            <DrawerDescription className="sr-only">上传一张封面图</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <PhotoUploader tripId={trip.id} stops={[]} purpose="cover" onDone={() => setCoverOpen(false)} />
          </div>
        </DrawerContent>
      </Drawer>
    </section>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof Footprints; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2">
      <Icon className="size-4 text-label-tertiary" />
      <span className="text-headline tabular-nums">{value}</span>
      <span className="text-caption text-muted-foreground">{label}</span>
    </div>
  );
}
