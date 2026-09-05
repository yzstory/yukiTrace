"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { X, Trash2, ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { fmt } from "@/lib/date";
import type { TPhoto } from "@/components/timeline/types";

export type GalleryDay = { index: number; date: Date; photos: Array<TPhoto & { stopName: string | null; firstMoment?: string | null }> };

export function PhotoGrid({ days, canEdit, onDelete, onSetCover, timezone }: { days: GalleryDay[]; canEdit: boolean; onDelete: (id: string) => Promise<void>; onSetCover: (id: string) => Promise<void>; timezone?: string }) {
  const flat = days.flatMap((d) => d.photos);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const open = openIdx != null ? flat[openIdx] : null;

  if (flat.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-3xl bg-card px-6 py-14 text-center card-shadow">
        <span className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-ios-pink/12 text-ios-pink">
          <ImageIcon className="size-8" />
        </span>
        <h2 className="text-title-2">还没有照片</h2>
        <p className="mt-1 max-w-xs text-subhead text-muted-foreground">在时间线点右下角 + 上传，带 GPS 的照片会自动归到对应站点。</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        {days
          .filter((d) => d.photos.length)
          .map((d) => (
            <section key={d.index}>
              <h2 className="mb-2 text-headline">
                Day {d.index} <span className="text-subhead font-normal text-muted-foreground">{fmt.date(d.date, timezone)} · {d.photos.length} 张</span>
              </h2>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {d.photos.map((p) => (
                  <button key={p.id} type="button" onClick={() => setOpenIdx(flat.indexOf(p))} className="pressable relative aspect-square overflow-hidden rounded-xl bg-fill">
                    <Image src={p.thumbUrl} alt={p.caption ?? ""} fill sizes="(max-width: 640px) 33vw, 180px" className="object-cover" unoptimized />
                  </button>
                ))}
              </div>
            </section>
          ))}
      </div>

      <AnimatePresence>
        {open && openIdx != null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex flex-col bg-black text-white">
            <div className="flex items-center justify-between p-3 safe-top">
              <button type="button" onClick={() => setOpenIdx(null)} className="rounded-full bg-white/15 p-2" aria-label="关闭">
                <X className="size-5" />
              </button>
              <span className="text-footnote text-white/80">
                {openIdx + 1} / {flat.length}
                {open.takenAt ? ` · ${fmt.dateTime(open.takenAt, timezone)}` : ""}
              </span>
              {canEdit ? (
                <div className="flex gap-2">
                  <button type="button" disabled={pending} onClick={() => start(async () => { await onSetCover(open.id); toast.success("已设为封面"); })} className="rounded-full bg-white/15 px-3 py-2 text-footnote">
                    设为封面
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    aria-label="删除"
                    onClick={() =>
                      start(async () => {
                        await onDelete(open.id);
                        toast.success("已删除照片");
                        setOpenIdx(null);
                      })
                    }
                    className="rounded-full bg-white/15 p-2"
                  >
                    <Trash2 className="size-5" />
                  </button>
                </div>
              ) : (
                <span className="w-9" />
              )}
            </div>
            <div className="relative flex-1" onClick={() => setOpenIdx(null)}>
              <Image src={open.url} alt={open.caption ?? ""} fill sizes="100vw" className="object-contain" unoptimized />
            </div>
            <div className="flex items-center justify-between p-4 safe-bottom">
              <button type="button" disabled={openIdx === 0} onClick={() => setOpenIdx((i) => (i ?? 0) - 1)} className="rounded-full bg-white/15 p-2 disabled:opacity-30" aria-label="上一张">
                <ChevronLeft className="size-5" />
              </button>
              <p className="flex-1 truncate px-3 text-center text-subhead text-white/90">{open.caption ?? open.stopName ?? ""}</p>
              <button type="button" disabled={openIdx === flat.length - 1} onClick={() => setOpenIdx((i) => (i ?? 0) + 1)} className="rounded-full bg-white/15 p-2 disabled:opacity-30" aria-label="下一张">
                <ChevronRight className="size-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
