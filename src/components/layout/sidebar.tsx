"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Footprints } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

export function Sidebar({ user }: { user: { name: string; email: string } }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border/60 bg-sidebar px-3 py-5 md:flex">
      <Link href="/trips" className="mb-8 flex items-center gap-2.5 px-2">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Footprints className="size-5" strokeWidth={2.2} />
        </span>
        <span className="text-headline">Trace</span>
      </Link>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-callout font-medium transition-colors",
                active ? "text-primary" : "text-foreground/80 hover:bg-sidebar-accent"
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl bg-primary/10"
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
              <Icon className="relative size-5" strokeWidth={active ? 2.4 : 2} />
              <span className="relative">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-3 rounded-xl px-2 py-2">
        <span className="flex size-9 items-center justify-center rounded-full bg-fill text-subhead font-semibold">
          {user.name.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-subhead font-medium">{user.name}</p>
          <p className="truncate text-caption text-muted-foreground">{user.email}</p>
        </div>
      </div>
    </aside>
  );
}
