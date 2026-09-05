"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus, MapPin, Wallet, Camera, ChevronLeft } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { ENTRY_TYPES, ENTRY_TYPE_ORDER } from "@/lib/entry-types";
import type { EntryType } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { StopForm } from "./stop-form";
import { EntryForm, type StopOption } from "./entry-form";
import { ExpenseForm } from "./expense-form";
import { PhotoUploader } from "./photo-uploader";

type Mode = { kind: "menu" } | { kind: "stop" } | { kind: "entry"; type: EntryType } | { kind: "expense" } | { kind: "photo" };

export function QuickAdd({ tripId, stops, homeCurrency, tripStart, tripEnd }: { tripId: string; stops: StopOption[]; homeCurrency: string; tripStart: Date; tripEnd: Date }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: "menu" });

  // 默认时间：若今天在旅程范围内用现在，否则用最后一个站点时间或旅程首日 10:00
  const now = new Date();
  const inRange = now >= tripStart && now <= new Date(tripEnd.getTime() + 86400000);
  const lastStop = stops[stops.length - 1];
  const defaultTime = inRange ? now : lastStop ? new Date(lastStop.arriveAt.getTime() + 3600000) : new Date(new Date(tripStart).setHours(10, 0, 0, 0));
  const defaultStopId = inRange ? undefined : lastStop?.id;

  const close = useCallback(() => {
    setOpen(false);
    setTimeout(() => setMode({ kind: "menu" }), 300);
  }, []);

  const title =
    mode.kind === "menu" ? "记录" : mode.kind === "stop" ? "添加站点" : mode.kind === "entry" ? `记录${ENTRY_TYPES[mode.type].label}` : mode.kind === "expense" ? "记一笔" : "上传照片";

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        aria-label="快速记录"
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-5 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground float-shadow md:bottom-8 md:right-8"
      >
        <Plus className="size-7" strokeWidth={2.4} />
      </motion.button>

      <Drawer open={open} onOpenChange={(o) => (o ? setOpen(true) : close())} repositionInputs={false}>
        <DrawerContent className="max-h-[92dvh] rounded-t-3xl bg-background">
          <DrawerHeader className="relative pb-2">
            {mode.kind !== "menu" && (
              <button type="button" onClick={() => setMode({ kind: "menu" })} className="absolute left-3 top-3 flex items-center text-callout text-primary">
                <ChevronLeft className="size-5" /> 返回
              </button>
            )}
            <DrawerTitle className="text-headline">{title}</DrawerTitle>
            <DrawerDescription className="sr-only">快速记录旅程内容</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={JSON.stringify(mode)}
                initial={{ opacity: 0, x: mode.kind === "menu" ? -16 : 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: mode.kind === "menu" ? 16 : -16 }}
                transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
              >
                {mode.kind === "menu" && <Menu onPick={setMode} />}
                {mode.kind === "stop" && <StopForm tripId={tripId} defaultTime={defaultTime} onDone={close} />}
                {mode.kind === "entry" && (
                  <EntryForm tripId={tripId} type={mode.type} stops={stops} homeCurrency={homeCurrency} defaultTime={defaultTime} defaultStopId={defaultStopId} onDone={close} />
                )}
                {mode.kind === "expense" && (
                  <ExpenseForm tripId={tripId} stops={stops} homeCurrency={homeCurrency} defaultTime={defaultTime} defaultStopId={defaultStopId} onDone={close} />
                )}
                {mode.kind === "photo" && <PhotoUploader tripId={tripId} stops={stops} defaultStopId={defaultStopId} onDone={close} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function Menu({ onPick }: { onPick: (m: Mode) => void }) {
  const primary: Array<{ mode: Mode; label: string; icon: typeof MapPin; color: string; bg: string }> = [
    { mode: { kind: "stop" }, label: "地点", icon: MapPin, color: "text-primary", bg: "bg-primary/12" },
    { mode: { kind: "expense" }, label: "花费", icon: Wallet, color: "text-ios-green", bg: "bg-ios-green/15" },
    { mode: { kind: "photo" }, label: "照片", icon: Camera, color: "text-ios-pink", bg: "bg-ios-pink/12" },
  ];
  return (
    <div className="flex flex-col gap-5 pt-1">
      <div className="grid grid-cols-3 gap-3">
        {primary.map((p) => (
          <Tile key={p.label} label={p.label} icon={p.icon} color={p.color} bg={p.bg} onClick={() => onPick(p.mode)} big />
        ))}
      </div>
      <div>
        <p className="mb-2 px-1 text-footnote font-semibold uppercase tracking-wide text-muted-foreground">条目</p>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
          {ENTRY_TYPE_ORDER.map((t) => {
            const cfg = ENTRY_TYPES[t];
            return <Tile key={t} label={cfg.label} icon={cfg.icon} color={cfg.color} bg={cfg.bg} onClick={() => onPick({ kind: "entry", type: t })} />;
          })}
        </div>
      </div>
    </div>
  );
}

function Tile({ label, icon: Icon, color, bg, onClick, big }: { label: string; icon: typeof MapPin; color: string; bg: string; onClick: () => void; big?: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.93 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cn("flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-card card-shadow", big ? "py-5" : "py-3")}
    >
      <span className={cn("flex items-center justify-center rounded-xl", bg, color, big ? "size-12" : "size-10")}>
        <Icon className={big ? "size-6" : "size-5"} strokeWidth={2.2} />
      </span>
      <span className={cn("font-medium", big ? "text-callout" : "text-caption")}>{label}</span>
    </motion.button>
  );
}
