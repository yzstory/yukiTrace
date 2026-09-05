"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

export function Sidebar({ user }: { user: { name: string; email: string } }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border/60 bg-sidebar px-3 py-5 md:flex">
      <Link href="/trips" className="mb-8 flex items-center gap-2.5 px-2">
        <Image src="/icons/icon-192.png" alt="" width={36} height={36} className="size-9 rounded-xl" priority />
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
                "pressable relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-callout font-medium transition-[transform,background-color,color] duration-[160ms] ease-[var(--ease-out)]",
                active ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-sidebar-accent"
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
              <span>{label}</span>
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
