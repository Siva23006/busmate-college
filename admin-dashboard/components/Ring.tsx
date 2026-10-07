"use client";
// Small animated donut chart with a legend (dashboard: trip progress, driver status).
import type { ReactNode } from "react";
import { stagger } from "./ui";

export type RingSegment = { label: string; value: number; color: string; hint?: string };

export function Ring({ segments, center, caption, size = 128, thickness = 13 }:
  { segments: RingSegment[]; center?: ReactNode; caption?: ReactNode; size?: number; thickness?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const visible = segments.filter((s) => s.value > 0).length;
  const gap = visible > 1 ? 3 : 0;
  let cum = 0;

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={thickness} />
          {total > 0 && segments.map((s, i) => {
            if (s.value <= 0) return null;
            const len = (s.value / total) * c;
            const dash = Math.max(0, len - gap);
            const el = (
              <circle key={s.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
                strokeLinecap={visible > 1 ? "butt" : "round"} strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-cum}
                className="anim-ring" style={stagger(i, 120)} />
            );
            cum += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="num text-[22px] font-bold leading-none">{center ?? total}</div>
            {caption && <div className="text-muted mt-1 text-[11px]">{caption}</div>}
          </div>
        </div>
      </div>
      <ul className="min-w-[140px] flex-1 space-y-2">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-[13px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{s.label}</span>
              {s.hint && <span className="text-subtle block truncate text-[11px]">{s.hint}</span>}
            </span>
            <span className="num font-semibold">{s.value}</span>
            <span className="text-muted num w-9 text-right text-xs">{total ? Math.round((s.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
