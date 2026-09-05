"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <div className="glass mx-auto flex max-w-lg items-stretch justify-around border-t border-border/60 safe-bottom">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-caption font-medium transition-colors",
                active ? "text-primary" : "text-label-tertiary"
              )}
            >
              <motion.span whileTap={{ scale: 0.85 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}>
                <Icon className="size-6" strokeWidth={active ? 2.4 : 2} />
              </motion.span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
