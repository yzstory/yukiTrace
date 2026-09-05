"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export function TripTabs({ tripId }: { tripId: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: `/trips/${tripId}`, label: "时间线" },
    { href: `/trips/${tripId}/map`, label: "地图" },
    { href: `/trips/${tripId}/ledger`, label: "账本" },
    { href: `/trips/${tripId}/photos`, label: "照片" },
  ];
  return (
    <nav className="mb-5 flex rounded-xl bg-fill p-1">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link key={t.href} href={t.href} className={cn("relative flex-1 rounded-lg py-1.5 text-center text-subhead font-medium transition-colors", active ? "text-foreground" : "text-muted-foreground")}>
            {active && <motion.span layoutId="trip-tab" className="absolute inset-0 rounded-lg bg-card shadow-sm" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            <span className="relative">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
