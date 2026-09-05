"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { Download, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type SummaryData = {
  title: string;
  dateRange: string;
  days: number;
  coverUrl: string | null;
  stopCount: number;
  cityNames: string[];
  distanceText: string;
  flightCount: number;
  flightHours: number;
  totalText: string;
  dailyAvgText: string;
  topCategory: { label: string; text: string; pct: number } | null;
  babyName: string | null;
  babyAgeText: string | null;
  babyTotalText: string | null;
  babyFirsts: string[];
  photoCount: number;
  favoritePhotos: string[];
  bestDay: { index: number; date: string; text: string } | null;
  travelers: string[];
  aiText: string | null;
};

const GRADS = [
  "from-[#0A5BD6] to-[#3B9CFF]",
  "from-[#FF7A00] to-[#FFB86B]",
  "from-[#1AA36A] to-[#5CE0A5]",
  "from-[#6A34D9] to-[#B08CFF]",
  "from-[#E0296C] to-[#FF7EB3]",
  "from-[#0EA5B7] to-[#6EE7F5]",
  "from-[#1F1F24] to-[#4A4A55]",
];

export function SummarySlides({ data }: { data: SummaryData }) {
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
      a.download = `${data.title}-总结.png`;
      a.click();
      toast.success("长图已生成");
    } catch (e) {
      console.error(e);
      toast.error("生成失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  async function share() {
    if (navigator.share) {
      await navigator.share({ title: `${data.title} · 旅程总结`, text: `${data.days} 天 · ${data.stopCount} 站 · ${data.distanceText}`, url: location.href }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(location.href);
      toast.success("已复制链接");
    }
  }

  const slides: React.ReactNode[] = [
    <Slide key="cover" grad={GRADS[0]}>
      {data.coverUrl && <Image src={data.coverUrl} alt="" fill sizes="100vw" className="object-cover opacity-50" unoptimized />}
      <div className="relative flex h-full flex-col justify-end">
        <p className="text-footnote font-medium text-white/80">{data.dateRange}</p>
        <h1 className="mt-1 text-[2.75rem] font-bold leading-[1.05] tracking-tight">{data.title}</h1>
        <p className="mt-3 text-callout text-white/85">
          {data.days} 天{data.travelers.length ? ` · ${data.travelers.join("、")}` : ""}
          {data.babyName ? ` · 和 ${data.babyName}` : ""}
        </p>
      </div>
    </Slide>,
    <Slide key="footprints" grad={GRADS[1]}>
      <Eyebrow>足迹</Eyebrow>
      <Big>{data.stopCount}</Big>
      <p className="text-title-2 text-white/90">个地方</p>
      {data.cityNames.length > 0 && <p className="mt-4 text-callout leading-relaxed text-white/85">{data.cityNames.join(" · ")}</p>}
      <p className="mt-6 text-headline text-white/90">
        一共走了 <span className="text-title-1">{data.distanceText}</span>
      </p>
      {data.flightCount > 0 && (
        <p className="mt-1 text-callout text-white/80">
          坐了 {data.flightCount} 次飞机{data.flightHours ? `，在天上 ${data.flightHours} 小时` : ""}
        </p>
      )}
    </Slide>,
    <Slide key="money" grad={GRADS[2]}>
      <Eyebrow>花费</Eyebrow>
      <Big className="text-[2.75rem]">{data.totalText}</Big>
      <p className="text-callout text-white/85">平均每天 {data.dailyAvgText}</p>
      {data.topCategory && (
        <div className="mt-6">
          <p className="text-footnote text-white/70">花得最多的是</p>
          <p className="text-title-1">
            {data.topCategory.label} <span className="text-callout text-white/80">{data.topCategory.text} · {data.topCategory.pct}%</span>
          </p>
        </div>
      )}
      {data.babyTotalText && <p className="mt-6 text-callout text-white/85">给{data.babyName ?? "宝宝"}花了 {data.babyTotalText}</p>}
    </Slide>,
  ];
  if (data.babyName || data.babyFirsts.length) {
    slides.push(
      <Slide key="baby" grad={GRADS[3]}>
        <Eyebrow>{data.babyName ?? "宝宝"}</Eyebrow>
        {data.babyAgeText && (
          <p className="text-title-1">
            出发时 <span className="text-[2.5rem] font-bold">{data.babyAgeText}</span>
          </p>
        )}
        {data.babyFirsts.length > 0 && (
          <ul className="mt-6 flex flex-col gap-2">
            {data.babyFirsts.map((f) => (
              <li key={f} className="rounded-2xl bg-white/15 px-4 py-3 text-callout backdrop-blur">
                {f}
              </li>
            ))}
          </ul>
        )}
      </Slide>
    );
  }
  if (data.bestDay) {
    slides.push(
      <Slide key="day" grad={GRADS[4]}>
        <Eyebrow>最丰富的一天</Eyebrow>
        <Big>Day {data.bestDay.index}</Big>
        <p className="text-callout text-white/85">{data.bestDay.date}</p>
        <p className="mt-6 text-title-2 leading-snug">{data.bestDay.text}</p>
      </Slide>
    );
  }
  if (data.photoCount > 0) {
    slides.push(
      <Slide key="photos" grad={GRADS[5]}>
        <Eyebrow>照片</Eyebrow>
        <Big>{data.photoCount}</Big>
        <p className="text-title-2 text-white/90">张回忆</p>
        {data.favoritePhotos.length > 0 && (
          <div className="mt-6 grid grid-cols-3 gap-2">
            {data.favoritePhotos.slice(0, 6).map((u, i) => (
              <span key={i} className="relative aspect-square overflow-hidden rounded-xl">
                <Image src={u} alt="" fill sizes="120px" className="object-cover" unoptimized />
              </span>
            ))}
          </div>
        )}
      </Slide>
    );
  }
  if (data.aiText) {
    slides.push(
      <Slide key="ai" grad={GRADS[6]}>
        <Eyebrow>游记</Eyebrow>
        <p className="whitespace-pre-wrap text-callout leading-relaxed text-white/90">{data.aiText}</p>
      </Slide>
    );
  }

  return (
    <div className="-mx-5 md:mx-0">
      <div className="mb-3 flex items-center justify-end gap-2 px-5 md:px-0">
        <button type="button" onClick={share} className="flex h-9 items-center gap-1.5 rounded-full bg-card px-3 text-footnote font-medium card-shadow">
          <Share2 className="size-4" /> 分享
        </button>
        <button type="button" onClick={save} disabled={saving} className="flex h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-footnote font-medium text-primary-foreground">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} 保存长图
        </button>
      </div>
      <div ref={ref} className="flex flex-col gap-3 bg-[#0d0d0d] p-3 md:rounded-3xl">
        {slides.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, transform: "translateY(12px)" }}
            whileInView={{ opacity: 1, transform: "translateY(0px)" }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          >
            {s}
          </motion.div>
        ))}
        <p className="py-2 text-center text-caption text-white/40">Trace · 带娃旅行记</p>
      </div>
    </div>
  );
}

function Slide({ children, grad }: { children: React.ReactNode; grad: string }) {
  return <section className={cn("relative aspect-[4/5] overflow-hidden rounded-3xl bg-gradient-to-br p-6 text-white", grad)}>{children}</section>;
}
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 text-footnote font-semibold uppercase tracking-widest text-white/70">{children}</p>;
}
function Big({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[4rem] font-bold leading-none tracking-tight", className)}>{children}</p>;
}
