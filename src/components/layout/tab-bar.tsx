"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

/** 悬浮胶囊底栏：离底边留出安全区，当前项用品牌色胶囊标出 */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+0.625rem)] md:hidden">
      <div className="pointer-events-auto glass flex w-full max-w-md items-stretch justify-around rounded-full p-1.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-[11px] font-medium transition-colors",
                active ? "text-brand" : "text-label-secondary"
              )}
            >
              {active && (
                <motion.span
                  layoutId="tab-active"
                  className="absolute inset-0 rounded-full bg-brand-soft"
                  transition={{ type: "spring", stiffness: 450, damping: 36 }}
                />
              )}
              <motion.span whileTap={{ scale: 0.85 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} className="relative">
                <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 2} />
              </motion.span>
              <span className="relative leading-none">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
