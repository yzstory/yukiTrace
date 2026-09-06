"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { CalendarHeart } from "lucide-react";
import type { OnThisDayItem } from "@/lib/ai/on-this-day";

/** 那年今日：琥珀色纸片，横向故事条 */
export function OnThisDayCard({ items }: { items: OnThisDayItem[] }) {
  if (items.length === 0) return null;
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="mb-6 overflow-hidden rounded-3xl bg-amber-soft card-shadow"
    >
      <div className="flex items-baseline justify-between px-5 pt-4">
        <p className="eyebrow flex items-center gap-1.5">
          <CalendarHeart className="size-3.5" /> On this day
        </p>
        <span className="text-footnote text-muted-foreground">那年今日</span>
      </div>
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-5 pb-5 pt-3">
        {items.map((it) => (
          <Link key={`${it.year}-${it.tripId}`} href={`/trips/${it.tripId}`} className="w-40 shrink-0">
            <span className="relative block aspect-[4/5] overflow-hidden rounded-2xl bg-gradient-to-br from-brand/70 to-amber/70 photo-shadow">
              {it.photoUrl && <Image src={it.photoUrl} alt="" fill sizes="160px" className="object-cover" unoptimized />}
              <span className="absolute inset-x-0 bottom-0 scrim p-2.5 pt-10 text-white">
                <span className="font-display block text-[13px] italic text-white/85">{it.yearsAgo} 年前</span>
                <span className="block truncate text-[15px] font-semibold leading-tight">{it.stopName}</span>
              </span>
            </span>
            <span className="mt-1.5 block truncate text-caption text-muted-foreground">
              {it.city ?? it.tripTitle}
              {it.babyAgeText ? ` · ${it.babyAgeText}` : ""}
            </span>
          </Link>
        ))}
      </div>
    </motion.section>
  );
}
