"use client";

import { cn } from "@/lib/utils";

/**
 * 一枚 SVG 章：双环 + 弧形文字 + 城市名，颗粒滤镜做出油墨感。
 * inked=false 时是虚线轮廓，等着被盖。
 */
export function Stamp({
  city,
  dateText,
  ageText,
  hue,
  tilt,
  inked,
  size = 150,
  className,
}: {
  city: string;
  dateText: string;
  ageText: string | null;
  hue: number;
  tilt: number;
  inked: boolean;
  size?: number;
  className?: string;
}) {
  const ink = `oklch(0.5 0.16 ${hue})`;
  const id = `arc-${hue}-${city.length}`;
  const cityLen = [...city].length;
  const citySize = cityLen <= 2 ? 34 : cityLen <= 4 ? 26 : 20;
  return (
    <svg
      viewBox="0 0 160 160"
      width={size}
      height={size}
      className={cn("select-none", className)}
      style={{ transform: `rotate(${tilt}deg)`, color: inked ? ink : "var(--color-label-tertiary)" }}
      aria-label={inked ? `${city} 已盖章` : `${city} 待盖章`}
      role="img"
    >
      <defs>
        <path id={`${id}-top`} d="M 80,80 m -58,0 a 58,58 0 1,1 116,0" />
        {/* 底部弧线从左到右、经过下方（sweep=0），文字才是正的，字头朝圆心 */}
        <path id={`${id}-bottom`} d="M 80,80 m -60,0 a 60,60 0 0,0 120,0" />
        <filter id={`${id}-grain`} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={hue} result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 1.25" result="mask" />
          <feComposite in="SourceGraphic" in2="mask" operator="in" />
        </filter>
      </defs>
      <g fill="currentColor" stroke="currentColor" filter={inked ? `url(#${id}-grain)` : undefined} opacity={inked ? 0.92 : 0.7}>
        <circle cx="80" cy="80" r="74" fill="none" strokeWidth={inked ? 3.5 : 2} strokeDasharray={inked ? undefined : "5 5"} />
        <circle cx="80" cy="80" r="66" fill="none" strokeWidth={inked ? 1.5 : 0} />
        <text fontSize="9.5" letterSpacing="2.2" fontWeight="600" stroke="none" fontFamily="var(--font-display), serif">
          <textPath href={`#${id}-top`} startOffset="50%" textAnchor="middle">
            TRACE · PASSPORT
          </textPath>
        </text>
        <text fontSize="8.5" letterSpacing="1.4" stroke="none" fontFamily="var(--font-display), serif">
          <textPath href={`#${id}-bottom`} startOffset="50%" textAnchor="middle">
            {dateText}
          </textPath>
        </text>
        <text x="80" y={ageText ? 84 : 92} textAnchor="middle" fontSize={citySize} fontWeight="700" stroke="none" fontFamily="var(--font-display), 'Songti SC', serif" letterSpacing={cityLen <= 2 ? 6 : 1}>
          {city}
        </text>
        {ageText && (
          <text x="80" y="106" textAnchor="middle" fontSize="10" stroke="none" fontFamily="var(--font-sans), sans-serif" letterSpacing="0.5">
            {ageText}
          </text>
        )}
        {!inked && (
          <text x="80" y="128" textAnchor="middle" fontSize="9" stroke="none" fontFamily="var(--font-sans), sans-serif">
            点一下盖章
          </text>
        )}
        {inked && <circle cx="80" cy={ageText ? 120 : 112} r="2" stroke="none" />}
      </g>
    </svg>
  );
}
