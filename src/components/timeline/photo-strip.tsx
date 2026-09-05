"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import type { TPhoto } from "./types";

export function PhotoStrip({ photos }: { photos: TPhoto[] }) {
  const [open, setOpen] = useState<TPhoto | null>(null);
  if (photos.length === 0) return null;
  return (
    <>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {photos.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpen(p)}
            className="pressable relative size-24 shrink-0 overflow-hidden rounded-xl bg-fill"
          >
            <Image src={p.thumbUrl} alt={p.caption ?? ""} fill sizes="96px" className="object-cover" unoptimized />
          </button>
        ))}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
            onClick={() => setOpen(null)}
          >
            <button type="button" className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white safe-top" aria-label="关闭">
              <X className="size-5" />
            </button>
            <motion.div
              initial={{ opacity: 0, transform: "scale(0.94)" }}
              animate={{ opacity: 1, transform: "scale(1)" }}
              exit={{ opacity: 0, transform: "scale(0.94)" }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="relative max-h-full w-full"
              style={{ aspectRatio: open.width && open.height ? `${open.width}/${open.height}` : "4/3" }}
            >
              <Image src={open.url} alt={open.caption ?? ""} fill sizes="100vw" className="object-contain" unoptimized />
            </motion.div>
            {open.caption && <p className="absolute bottom-8 left-0 right-0 text-center text-subhead text-white/90">{open.caption}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
