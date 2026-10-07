import { BusFront } from "lucide-react";

/** BusMate mark: amber rounded tile with a bus icon. */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span
      className="relative grid shrink-0 place-items-center rounded-[30%] bg-amber-brand text-ink-900 shadow-[0_6px_16px_-6px_rgba(245,179,1,0.7)]"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <BusFront style={{ width: size * 0.52, height: size * 0.52 }} strokeWidth={2.2} />
    </span>
  );
}

/** Logo + "BUSMATE / SMART COLLEGE TRANSPORT" wordmark. */
export function Brand({ size = 36, inverted }: { size?: number; inverted?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <Logo size={size} />
      <span className="leading-none">
        <span className={`block text-[15px] font-extrabold tracking-[0.08em] ${inverted ? "text-white" : "text-[var(--text)]"}`}>BUSMATE</span>
        <span className={`mt-1 block text-[9.5px] font-semibold uppercase tracking-[0.16em] ${inverted ? "text-amber-brand" : "text-muted"}`}>Smart College Transport</span>
      </span>
    </span>
  );
}
