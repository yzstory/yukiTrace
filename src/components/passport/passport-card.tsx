import Link from "next/link";
import { ChevronRight, Stamp as StampIcon } from "lucide-react";

/** 「我」页顶部的护照入口卡 */
export function PassportCard({ babyName, cities, pending }: { babyName: string | null; cities: number; pending: number }) {
  return (
    <Link href="/passport" className="pressable paper mb-6 flex items-center gap-4 rounded-3xl p-4 card-shadow">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <StampIcon className="size-7" strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="eyebrow block">Passport</span>
        <span className="block truncate font-display text-[1.25rem] font-semibold leading-tight">{babyName ?? "宝宝"}的旅行护照</span>
        <span className="block text-caption text-muted-foreground">
          {cities === 0 ? "还没有城市，去旅程里加一站" : `${cities} 座城市${pending > 0 ? ` · ${pending} 枚待盖章` : " · 都盖过了"}`}
        </span>
      </span>
      {pending > 0 && <span className="rounded-full bg-brand px-2 py-0.5 text-caption font-semibold text-white">{pending}</span>}
      <ChevronRight className="size-4 shrink-0 text-label-tertiary" />
    </Link>
  );
}
