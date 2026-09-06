"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { Footprints, Wallet, Baby, MapPin } from "lucide-react";
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
  timezone: string;
  babyName: string | null;
  babyBirthDate: Date | null;
  stopCount: number;
  totalHomeMinor: number;
  cities: string[];
};

/* 无封面时的暖色渐变，按序号轮换 */
const GRADIENTS = [
  "from-[oklch(0.62_0.16_40)] via-[oklch(0.7_0.14_60)] to-[oklch(0.82_0.1_80)]",
  "from-[oklch(0.5_0.1_165)] via-[oklch(0.62_0.09_170)] to-[oklch(0.8_0.06_150)]",
  "from-[oklch(0.5_0.12_260)] via-[oklch(0.6_0.12_235)] to-[oklch(0.8_0.07_210)]",
  "from-[oklch(0.5_0.14_320)] via-[oklch(0.65_0.15_10)] to-[oklch(0.82_0.1_50)]",
];

export function TripCard({ trip, index }: { trip: TripCardData; index: number }) {
  const gradient = GRADIENTS[index % GRADIENTS.length];
  const days = tripDays(trip.startDate, trip.endDate);
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 28, delay: Math.min(index, 4) * 0.06 }}
      whileTap={{ scale: 0.985 }}
    >
      <Link href={`/trips/${trip.id}`} className={`group relative block aspect-[4/5] overflow-hidden rounded-3xl bg-gradient-to-br photo-shadow ${gradient}`}>
        {trip.coverUrl ? (
          <Image
            src={trip.coverUrl}
            alt={trip.title}
            fill
            sizes="(max-width: 768px) 100vw, 720px"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            unoptimized
          />
        ) : (
          <Footprints className="absolute right-6 top-6 size-20 text-white/25" strokeWidth={1.4} />
        )}

        {/* 顶部：日期眉标 + 天数 */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-5 text-white">
          <span className="font-display text-[15px] italic tracking-wide text-white/90 drop-shadow">
            {fmt.date(trip.startDate, trip.timezone)} – {fmt.date(trip.endDate, trip.timezone)}
          </span>
          <span className="rounded-full bg-white/18 px-2.5 py-1 text-[12px] font-semibold text-white backdrop-blur-md">{days} 天</span>
        </div>

        {/* 底部：遮罩 + 标题 + 城市 + 统计 chips */}
        <div className="absolute inset-x-0 bottom-0 scrim p-5 pt-24 text-white">
          {trip.cities.length > 0 && (
            <p className="mb-1 flex items-center gap-1 text-[13px] text-white/85">
              <MapPin className="size-3.5" /> {trip.cities.join(" · ")}
            </p>
          )}
          <h2 className="font-display text-[2rem] font-semibold leading-[1.1] tracking-tight text-white">{trip.title}</h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip icon={Footprints} text={`${trip.stopCount} 站`} />
            <Chip icon={Wallet} text={formatMoney(trip.totalHomeMinor, trip.homeCurrency, { compact: true })} />
            {trip.babyBirthDate && <Chip icon={Baby} text={`${trip.babyName ?? "宝宝"} ${babyAge(trip.babyBirthDate, trip.startDate)}`} />}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function Chip({ icon: Icon, text }: { icon: typeof Footprints; text: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/16 px-2.5 py-1 text-[12px] font-medium text-white backdrop-blur-md">
      <Icon className="size-3.5" /> {text}
    </span>
  );
}
