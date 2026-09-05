"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { CalendarHeart } from "lucide-react";
import type { OnThisDayItem } from "@/lib/ai/on-this-day";

export function OnThisDayCard({ items }: { items: OnThisDayItem[] }) {
  if (items.length === 0) return null;
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="mb-5 overflow-hidden rounded-3xl bg-card card-shadow"
    >
      <h2 className="flex items-center gap-1.5 px-4 pt-3.5 text-footnote font-semibold uppercase tracking-wide text-muted-foreground">
        <CalendarHeart className="size-3.5 text-ios-pink" /> 那年今日
      </h2>
      <div className="no-scrollbar flex gap-3 overflow-x-auto p-4 pt-2.5">
        {items.map((it) => (
          <Link key={`${it.year}-${it.tripId}`} href={`/trips/${it.tripId}`} className="w-40 shrink-0">
            <span className="relative block aspect-[4/5] overflow-hidden rounded-2xl bg-gradient-to-br from-ios-pink/70 to-ios-purple/70">
              {it.photoUrl && <Image src={it.photoUrl} alt="" fill sizes="160px" className="object-cover" unoptimized />}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-8 text-white">
                <span className="block text-caption font-semibold">{it.yearsAgo} 年前的今天</span>
                <span className="block truncate text-footnote">{it.stopName}</span>
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
