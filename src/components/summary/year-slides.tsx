"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { Download, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { YearReview } from "@/lib/ai/year-review";

const GRADS = [
  "from-[#0A5BD6] to-[#3B9CFF]",
  "from-[#FF7A00] to-[#FFB86B]",
  "from-[#1AA36A] to-[#5CE0A5]",
  "from-[#6A34D9] to-[#B08CFF]",
  "from-[#E0296C] to-[#FF7EB3]",
  "from-[#0EA5B7] to-[#6EE7F5]",
  "from-[#1F1F24] to-[#4A4A55]",
];

export function YearSlides({ review }: { review: YearReview }) {
  const ref = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!ref.current) return;
    setSaving(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(ref.current, { pixelRatio: 2, cacheBust: true, backgroundColor: "#0d0d0d" });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${review.year}年旅行回顾.png`;
      a.click();
      toast.success("长图已生成");
    } catch {
      toast.error("生成失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="-mx-5 md:mx-0">
      <div className="mb-3 flex items-center justify-end gap-2 px-5 md:px-0">
        <button
          type="button"
          onClick={async () => {
            if (navigator.share) await navigator.share({ title: `${review.year} 年旅行回顾`, url: location.href }).catch(() => {});
            else {
              await navigator.clipboard.writeText(location.href);
              toast.success("已复制链接");
            }
          }}
          className="flex h-9 items-center gap-1.5 rounded-full bg-card px-3 text-footnote font-medium card-shadow"
        >
          <Share2 className="size-4" /> 分享
        </button>
        <button type="button" onClick={save} disabled={saving} className="flex h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-footnote font-medium text-primary-foreground">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} 保存长图
        </button>
      </div>

      <div ref={ref} className="flex flex-col gap-3 bg-[#0d0d0d] p-3 md:rounded-3xl">
        <Slide grad={GRADS[0]}>
          <p className="text-footnote font-semibold uppercase tracking-widest text-white/70">年度回顾</p>
          <p className="mt-2 text-[5rem] font-bold leading-none tracking-tight">{review.year}</p>
          <p className="mt-4 text-title-2 text-white/90">
            {review.tripCount} 段旅程 · {review.dayCount} 天在路上
          </p>
          {review.babyName && review.babyStartAge && review.babyEndAge && (
            <p className="mt-2 text-callout text-white/80">
              {review.babyName} 从 {review.babyStartAge} 长到 {review.babyEndAge}
            </p>
          )}
        </Slide>

        <Slide grad={GRADS[1]}>
          <Eyebrow>去过</Eyebrow>
          <Big>{review.cityCount}</Big>
          <p className="text-title-2 text-white/90">座城市</p>
          {review.cities.length > 0 && <p className="mt-4 text-callout leading-relaxed text-white/85">{review.cities.join(" · ")}</p>}
          <p className="mt-6 text-headline text-white/90">
            一共走了 <span className="text-title-1">{review.distanceText}</span>
          </p>
          {review.flightCount > 0 && (
            <p className="mt-1 text-callout text-white/80">
              坐了 {review.flightCount} 次飞机
              {review.flightHours ? `，在天上 ${review.flightHours} 小时` : ""}
            </p>
          )}
        </Slide>

        <Slide grad={GRADS[2]}>
          <Eyebrow>花费</Eyebrow>
          <Big className="text-[3rem]">{review.totalText}</Big>
          {review.topCategory && (
            <p className="mt-4 text-callout text-white/85">
              最多的是{review.topCategory.label} {review.topCategory.text}（{review.topCategory.pct}%）
            </p>
          )}
          {review.babyTotalText && <p className="mt-2 text-callout text-white/85">给{review.babyName ?? "宝宝"}花了 {review.babyTotalText}</p>}
          {review.busiestMonth && <p className="mt-6 text-callout text-white/80">{review.busiestMonth.month} 月出门最多，{review.busiestMonth.trips} 次</p>}
        </Slide>

        {review.firsts.length > 0 && (
          <Slide grad={GRADS[3]}>
            <Eyebrow>这一年的第一次</Eyebrow>
            <ul className="mt-2 flex flex-col gap-2">
              {review.firsts.map((f) => (
                <li key={f} className="rounded-2xl bg-white/15 px-4 py-3 text-callout backdrop-blur">
                  {f}
                </li>
              ))}
            </ul>
          </Slide>
        )}

        {review.highlightPhotos.length > 0 && (
          <Slide grad={GRADS[5]}>
            <Eyebrow>{review.photoCount} 张照片里的这一年</Eyebrow>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {review.highlightPhotos.slice(0, 9).map((u, i) => (
                <span key={i} className="relative aspect-square overflow-hidden rounded-xl">
                  <Image src={u} alt="" fill sizes="120px" className="object-cover" unoptimized />
                </span>
              ))}
            </div>
          </Slide>
        )}

        <Slide grad={GRADS[4]}>
          <Eyebrow>走过的路</Eyebrow>
          <ul className="mt-2 flex flex-col gap-2">
            {review.trips.map((t) => (
              <li key={t.id}>
                <Link href={`/trips/${t.id}`} className="flex items-center gap-3 rounded-2xl bg-white/15 p-2 backdrop-blur">
                  <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-white/20">
                    {t.cover && <Image src={t.cover} alt="" fill sizes="48px" className="object-cover" unoptimized />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-callout font-medium">{t.title}</span>
                    <span className="block text-caption text-white/75">{t.dates}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Slide>

        {review.letter && (
          <Slide grad={GRADS[6]}>
            <Eyebrow>给{review.babyName ?? "宝宝"}的信</Eyebrow>
            <p className="whitespace-pre-wrap text-callout leading-relaxed text-white/90">{review.letter}</p>
          </Slide>
        )}

        <p className="py-2 text-center text-caption text-white/40">Trace · 带娃旅行记</p>
      </div>
    </div>
  );
}

function Slide({ children, grad }: { children: React.ReactNode; grad: string }) {
  // 不用 whileInView：导出长图时未滚到的卡片会停留在 opacity 0
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 28 }}
      className={cn("relative overflow-hidden rounded-3xl bg-gradient-to-br p-6 text-white", grad)}
    >
      {children}
    </motion.section>
  );
}
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-footnote font-semibold uppercase tracking-widest text-white/70">{children}</p>;
}
function Big({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[4rem] font-bold leading-none tracking-tight", className)}>{children}</p>;
}
