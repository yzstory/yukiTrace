"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Pencil, Footprints, Wallet, Baby, Users, ImagePlus, Route, ListChecks, Sparkle, MoreHorizontal, BookImage } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  timezone: string;
  babyName: string | null;
  babyBirthDate: Date | null;
  travelers: string[];
  stopCount: number;
  totalHomeMinor: number;
  totalDistanceM: number;
  canEdit: boolean;
};

export function TripHero({ trip, tidy, tidyCount = 0 }: { trip: TripHeroData; tidy?: React.ReactNode; tidyCount?: number }) {
  const [coverOpen, setCoverOpen] = useState(false);
  const [tidyOpen, setTidyOpen] = useState(false);
  return (
    <section className="mb-6 overflow-hidden rounded-3xl bg-card photo-shadow">
      <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-[oklch(0.62_0.16_40)] via-[oklch(0.7_0.14_60)] to-[oklch(0.82_0.1_80)]">
        {trip.coverUrl ? (
          <Image src={trip.coverUrl} alt={trip.title} fill sizes="(max-width: 768px) 100vw, 720px" className="object-cover" priority unoptimized />
        ) : (
          <Footprints className="absolute right-6 top-6 size-20 text-white/25" strokeWidth={1.5} />
        )}
        <div className="absolute inset-x-0 bottom-0 scrim p-5 pt-24 text-white">
          <p className="font-display text-[15px] italic tracking-wide text-white/85">
            {fmt.dateFull(trip.startDate, trip.timezone)} – {fmt.date(trip.endDate, trip.timezone)} · {tripDays(trip.startDate, trip.endDate)} 天
          </p>
          <h1 className="mt-1 font-display text-[2.25rem] font-semibold leading-[1.1] tracking-tight text-white">{trip.title}</h1>
          {trip.description && <p className="mt-1 text-subhead text-white/85">{trip.description}</p>}
        </div>
        <div className="absolute right-3 top-3 flex gap-2 safe-top">
          <Link href={`/trips/${trip.id}/summary`} className="pressable glass flex h-9 items-center gap-1.5 rounded-full px-3 text-footnote font-medium text-foreground" aria-label="旅程总结">
            <Sparkle className="size-4" /> 总结
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger className="pressable glass flex size-9 items-center justify-center rounded-full text-foreground" aria-label="更多">
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44 rounded-xl">
              {tidy && (
                <DropdownMenuItem onClick={() => setTidyOpen(true)}>
                  <ListChecks className="size-4" /> 旅程整理
                  {tidyCount > 0 && <span className="ml-auto rounded-full bg-brand-soft px-1.5 text-caption font-medium text-brand">{tidyCount}</span>}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link href={`/trips/${trip.id}/members`}>
                  <Users className="size-4" /> 成员与邀请
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/trips/${trip.id}/album`}>
                  <BookImage className="size-4" /> 打印相册
                </Link>
              </DropdownMenuItem>
              {trip.canEdit && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href={`/trips/${trip.id}/checklist`}>
                      <ListChecks className="size-4" /> 出行清单
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCoverOpen(true)}>
                    <ImagePlus className="size-4" /> 更换封面
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/trips/${trip.id}/edit`}>
                      <Pencil className="size-4" /> 编辑旅程
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border/60 px-2 py-4 text-center">
        <Stat icon={Footprints} value={`${trip.stopCount}`} label="站" />
        <Stat icon={Route} value={trip.totalDistanceM ? formatDistance(trip.totalDistanceM) : "—"} label="里程" />
        <Stat icon={Wallet} value={formatMoney(trip.totalHomeMinor, trip.homeCurrency, { compact: true })} label="花费" />
      </div>

      {(trip.travelers.length > 0 || trip.babyBirthDate) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-5 py-3 text-footnote text-muted-foreground">
          {trip.babyBirthDate && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sage-soft px-2.5 py-1 font-medium text-sage">
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

      {tidy && (
        <Drawer open={tidyOpen} onOpenChange={setTidyOpen}>
          <DrawerContent className="h-[88dvh] rounded-t-3xl bg-background">
            <DrawerHeader className="pb-1">
              <DrawerTitle className="text-headline">旅程整理</DrawerTitle>
              <DrawerDescription className="text-caption">先一键整理，再核对剩下的。每条记录都能看到是谁、什么时候改的。</DrawerDescription>
            </DrawerHeader>
            {tidy}
          </DrawerContent>
        </Drawer>
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
      <span className="display-number text-[1.375rem] leading-none">{value}</span>
      <span className="text-caption text-muted-foreground">{label}</span>
    </div>
  );
}
