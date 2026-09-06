"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Download, Loader2, Sparkles, Stamp as StampIcon } from "lucide-react";
import { toast } from "sonner";
import { Stamp } from "./stamp";
import { inkStamp, inkAll } from "@/app/(app)/passport/actions";
import { formatDistance } from "@/lib/geo";
import type { Passport, PassportStamp } from "@/lib/passport";

type Serialized = Omit<PassportStamp, "firstAt" | "inkedAt"> & { firstAt: string; inkedAt: string | null };
export type PassportView = Omit<Passport, "stamps"> & { stamps: Serialized[] };

export function PassportBook({ passport, canInk }: { passport: PassportView; canInk: boolean }) {
  const [pending, start] = useTransition();
  const [busyCity, setBusyCity] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justInked, setJustInked] = useState<Record<string, string | null>>({});
  const bookRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const reduce = useReducedMotion();
  const pendingCount = passport.stamps.filter((s) => !s.inkedAt && !justInked[s.city]).length;

  function ink(city: string) {
    if (pending) return;
    setBusyCity(city);
    start(async () => {
      try {
        const r = await inkStamp(city);
        if (r.error) toast.error(r.error);
        else {
          setJustInked((m) => ({ ...m, [city]: r.line ?? null }));
          router.refresh();
        }
      } catch {
        toast.error("盖章失败，再试一次");
      } finally {
        setBusyCity(null);
      }
    });
  }

  function inkEverything() {
    if (pending) return;
    setBusyCity("*");
    start(async () => {
      try {
        const r = await inkAll();
        if (r.error) toast.error(r.error);
        else {
          toast.success(r.inked ? `盖了 ${r.inked} 枚章` : "都盖过了");
          router.refresh();
        }
      } catch {
        toast.error("盖章失败，再试一次");
      } finally {
        setBusyCity(null);
      }
    });
  }

  async function save() {
    if (!bookRef.current) return;
    setSaving(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(bookRef.current, { pixelRatio: 2, cacheBust: true, backgroundColor: "#f8f4ee" });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${passport.babyName ?? "宝宝"}的旅行护照.png`;
      a.click();
      toast.success("护照已保存为图片");
    } catch (e) {
      console.error(e);
      toast.error("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div ref={bookRef} className="paper overflow-hidden rounded-[28px] p-5 card-shadow">
        <header className="mb-5 flex items-end justify-between">
          <div>
            <p className="eyebrow">Passport</p>
            <h2 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight">{passport.babyName ?? "宝宝"}的旅行护照</h2>
          </div>
          <StampIcon className="size-8 text-brand/60" strokeWidth={1.6} />
        </header>

        <div className="mb-5 grid grid-cols-4 gap-2 rounded-2xl bg-card/70 px-3 py-3 text-center">
          <Stat value={`${passport.stats.cities}`} label="城市" />
          <Stat value={`${passport.stats.trips}`} label="旅程" />
          <Stat value={passport.stats.distanceM ? formatDistance(passport.stats.distanceM) : "—"} label="里程" />
          <Stat value={`${passport.stats.flights}`} label="飞行" />
        </div>
        {passport.stats.earthPercent > 0 && (
          <p className="mb-5 text-center font-display text-[15px] italic text-muted-foreground">已经走了绕地球一圈的 {passport.stats.earthPercent}%</p>
        )}

        {passport.stamps.length === 0 ? (
          <p className="rounded-2xl bg-card/70 px-4 py-10 text-center text-subhead text-muted-foreground">还没有城市。去旅程里添加带城市的站点，这里就会出现第一枚章。</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {passport.stamps.map((s) => {
              const inked = !!s.inkedAt || s.city in justInked;
              const line = s.city in justInked ? justInked[s.city] : s.line;
              const fresh = s.city in justInked;
              return (
                <li key={s.city} className="relative overflow-hidden rounded-2xl bg-card/80 p-3 pb-2.5">
                  {s.photoUrl && (
                    <Image src={s.photoUrl} alt="" fill sizes="200px" className="object-cover opacity-[0.16] saturate-[0.6]" unoptimized />
                  )}
                  <button
                    type="button"
                    disabled={!canInk || inked || pending}
                    onClick={() => ink(s.city)}
                    className="relative mx-auto flex size-[150px] items-center justify-center disabled:cursor-default"
                    aria-label={inked ? `${s.city}，已盖章` : `给 ${s.city} 盖章`}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={inked ? "inked" : "blank"}
                        initial={fresh && !reduce ? { scale: 1.7, opacity: 0, rotate: s.tilt - 14 } : false}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 520, damping: 22, mass: 0.9 }}
                        className="block"
                      >
                        <Stamp city={s.city} dateText={s.dateText} ageText={s.babyAgeText} hue={s.hue} tilt={s.tilt} inked={inked} />
                      </motion.span>
                    </AnimatePresence>
                    {busyCity === s.city && (
                      <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60">
                        <Loader2 className="size-6 animate-spin text-brand" />
                      </span>
                    )}
                  </button>
                  <div className="relative mt-1 min-h-[2.5rem] text-center">
                    {inked ? (
                      <p className="text-footnote leading-snug text-foreground/85">{line ?? s.tripTitle}</p>
                    ) : (
                      <p className="text-caption text-muted-foreground">{s.tripTitle}</p>
                    )}
                    {s.tripCount > 1 && <p className="mt-0.5 text-caption text-muted-foreground">去过 {s.tripCount} 次</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex gap-2">
        {canInk && pendingCount > 0 && (
          <button
            type="button"
            disabled={pending}
            onClick={inkEverything}
            className="pressable flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-callout font-medium text-primary-foreground disabled:opacity-50"
          >
            {busyCity === "*" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} 全部盖章（{pendingCount}）
          </button>
        )}
        <button
          type="button"
          disabled={saving || passport.stamps.length === 0}
          onClick={save}
          className="pressable flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-card text-callout font-medium card-shadow disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} 保存为图片
        </button>
      </div>
      <p className="px-1 text-center text-caption text-muted-foreground">
        章落在第一次到访的旅程上，文案由 AI 根据当天的记录写。想改文案，去 <Link href="/trips" className="text-primary">旅程</Link> 里补充记录后重新盖。
      </p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="display-number whitespace-nowrap text-[1.125rem] leading-none">{value}</p>
      <p className="mt-1 text-caption text-muted-foreground">{label}</p>
    </div>
  );
}
