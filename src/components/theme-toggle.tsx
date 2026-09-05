"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, SunMoon } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "浅色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon },
  { value: "system", label: "跟随系统", icon: SunMoon },
] as const;

const noopSubscribe = () => () => {};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // 服务端渲染时 theme 未知，挂载前不高亮任何一项，避免 hydration 不一致
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  return (
    <div className="flex rounded-xl bg-fill p-1">
      {OPTIONS.map((o) => {
        const Icon = o.icon;
        const active = mounted && (theme ?? "system") === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => setTheme(o.value)}
            className={cn("relative flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-subhead font-medium transition-colors", active ? "text-foreground" : "text-muted-foreground")}
          >
            {active && <motion.span layoutId="theme-active" className="absolute inset-0 rounded-lg bg-card shadow-sm" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            <Icon className="relative size-4" />
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
