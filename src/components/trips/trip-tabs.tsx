"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function TripTabs({ tripId }: { tripId: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: `/trips/${tripId}`, label: "时间线" },
    { href: `/trips/${tripId}/map`, label: "地图" },
    { href: `/trips/${tripId}/ledger`, label: "账本" },
    { href: `/trips/${tripId}/photos`, label: "照片" },
    { href: `/trips/${tripId}/album`, label: "相册" },
  ];
  return (
    <nav className="mb-5 flex rounded-xl bg-fill p-1">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link key={t.href} href={t.href} className={cn("pressable flex-1 rounded-lg py-1.5 text-center text-subhead font-medium transition-[transform,background-color,color,box-shadow] duration-[160ms] ease-[var(--ease-out)]", active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
