"use client";
// Small design-system primitives used across the dashboard.
// Type scale: body 14px · secondary 12–13px · card titles 15px · page titles 22–24px · stats 28px.
import {
  useEffect, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes,
} from "react";
import { AlertTriangle, Inbox, Loader2, X } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/** Inline style for a staggered entrance: <div className="anim-fade-up" style={stagger(i)} />. */
export function stagger(i: number, stepMs = 60): CSSProperties {
  return { "--d": `${i * stepMs}ms` } as CSSProperties;
}

type Variant = "primary" | "secondary" | "danger" | "ghost";
export function Button({ variant = "primary", loading, className, children, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  const styles: Record<Variant, string> = {
    primary: "bg-primary text-white shadow-[0_1px_2px_rgba(37,99,235,0.25)] hover:bg-primary-hover",
    secondary: "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-[var(--text)] hover:bg-[var(--surface-3)]",
  };
  return (
    <button
      className={cn("inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-[13px] font-semibold leading-5 transition duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40", styles[variant], className)}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}

/**
 * Surface card. Fades up on mount; pass `delay` (index) to stagger a group, `hover` for a lift on hover.
 * A `bg-…` in className replaces the default surface background.
 */
export function Card({ className, children, delay, hover, animate = true }:
  { className?: string; children: ReactNode; delay?: number; hover?: boolean; animate?: boolean }) {
  const customBg = /(^|\s)bg-/.test(className ?? "");
  return (
    <div
      className={cn("rounded-2xl border border-[var(--border)] shadow-card", !customBg && "bg-[var(--surface)]",
        animate && "anim-fade-up", hover && "hover-lift", className)}
      style={delay ? stagger(delay) : undefined}
    >
      {children}
    </div>
  );
}

/** Header row inside a Card: title (15px), optional one-line subtitle, icon and actions. */
export function CardHeader({ title, subtitle, icon: Icon, actions, className }:
  { title: ReactNode; subtitle?: ReactNode; icon?: typeof Inbox; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3", className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && <Icon className="text-muted h-4 w-4 shrink-0" />}
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold leading-tight">{title}</h3>
          {subtitle && <p className="text-muted mt-0.5 truncate text-xs">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="anim-fade-up mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold leading-tight tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="text-muted mt-1 max-w-2xl text-[13px]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const TONES = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20",
  red: "bg-red-50 text-red-700 ring-red-600/15 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/20",
  slate: "bg-slate-100 text-slate-600 ring-slate-500/15 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-400/20",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/15 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-400/20",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/15 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/20",
  sky: "bg-sky-50 text-sky-700 ring-sky-600/15 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20",
};
export type Tone = keyof typeof TONES;

/** Solid colours per tone, for dots, rings and icon tiles. */
export const TONE_SOLID: Record<Tone, string> = {
  green: "#16a34a", amber: "#d97706", red: "#dc2626", slate: "#94a3b8", blue: "#2563eb", violet: "#7c3aed", sky: "#0284c7",
};

const TILE: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
  red: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300",
  slate: "bg-slate-100 text-slate-500 dark:bg-slate-500/10 dark:text-slate-300",
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300",
  sky: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300",
};
const CAPTION: Record<Tone, string> = {
  green: "text-emerald-600 dark:text-emerald-400", amber: "text-amber-600 dark:text-amber-400", red: "text-red-600 dark:text-red-400",
  slate: "text-muted", blue: "text-blue-600 dark:text-blue-400", violet: "text-violet-600 dark:text-violet-400", sky: "text-sky-600 dark:text-sky-400",
};

export function Badge({ tone = "slate", children, dot, pulse }: { tone?: Tone; children: ReactNode; dot?: boolean; pulse?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-semibold leading-none ring-1 ring-inset", TONES[tone])}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full bg-current", pulse && "pulse-dot")} />}
      {children}
    </span>
  );
}

/** Soft rounded icon tile (stat cards, alert rows). */
export function IconTile({ icon: Icon, tone = "blue", size = "md" }: { icon: typeof Inbox; tone?: Tone; size?: "sm" | "md" }) {
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-xl", TILE[tone], size === "sm" ? "h-8 w-8" : "h-10 w-10")}>
      <Icon className={size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]"} />
    </span>
  );
}

/** Small live dot with an animated ping ring. */
export function LiveDot({ tone = "green", pulse = true }: { tone?: Tone; pulse?: boolean }) {
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", pulse && "pulse-dot")} style={{ background: TONE_SOLID[tone], color: TONE_SOLID[tone] }} />;
}

/** KPI card: coloured icon tile, count-up number and a small coloured caption. */
export function StatCard({ label, value, icon, tone, caption, captionTone, delay }:
  { label: string; value: number | null | undefined; icon: typeof Inbox; tone: Tone; caption?: ReactNode; captionTone?: Tone; delay?: number }) {
  const shown = useCountUp(value);
  return (
    <Card hover delay={delay} className="p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-muted text-xs font-medium">{label}</span>
        <IconTile icon={icon} tone={tone} size="sm" />
      </div>
      {value == null || shown == null ? <Skeleton className="mt-2 h-7 w-14" /> : (
        <div className="num mt-1 text-[28px] font-bold leading-none tracking-tight">{shown}</div>
      )}
      <div className={cn("mt-2 truncate text-xs font-medium", CAPTION[captionTone ?? "slate"])}>{caption ?? " "}</div>
    </Card>
  );
}

/** Filter chips / segmented tabs with counts. */
export function Segmented<T extends string>({ options, value, onChange, size = "md", className }:
  { options: { value: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; size?: "sm" | "md"; className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-0.5 rounded-lg bg-[var(--surface-3)] p-0.5", className)} role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button key={o.value} type="button" role="tab" aria-selected={active} onClick={() => onChange(o.value)}
            className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md font-semibold transition-all duration-200",
              size === "sm" ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-xs",
              active ? "bg-[var(--surface)] text-[var(--text)] shadow-[0_1px_3px_rgba(15,23,42,0.12)]" : "text-muted hover:text-[var(--text)]")}>
            {o.label}
            {o.count != null && (
              <span className={cn("num rounded-full px-1.5 text-[10px] leading-4 transition-colors", active ? "bg-primary text-white" : "bg-[var(--surface)] text-muted")}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Required label for any simulated data (spec section 40). */
export function DemoBadge() {
  return <Badge tone="violet">DEMO / SIMULATION</Badge>;
}

export function busStatusTone(status: string): Tone {
  switch (status) {
    case "ACTIVE": return "green";
    case "OFFLINE": return "red";
    case "MAINTENANCE": return "amber";
    default: return "slate";
  }
}

/** Plain-language bus status: ACTIVE -> "Active" etc. */
export function busStatusLabel(status: string): string {
  switch (status) {
    case "ACTIVE": return "Active";
    case "OFFLINE": return "Offline";
    case "MAINTENANCE": return "Maintenance";
    case "INACTIVE": return "Inactive";
    default: return status;
  }
}

export function Field({ label, error, children, hint }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-medium">{label}</span>
      {children}
      {hint && !error && <span className="text-muted mt-1 block text-xs">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

const inputCls = "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] leading-5 text-[var(--text)] outline-none transition placeholder:text-[var(--subtle)] hover:border-[var(--border-strong)] focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60";
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, props.className)} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputCls, "cursor-pointer pr-8", props.className)} />;
}

export function Modal({ open, title, onClose, children, footer, wide }:
  { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="anim-fade-in fixed inset-0 z-50 flex items-center justify-center bg-ink-950/45 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div className={cn("anim-scale-in max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)]", wide ? "max-w-3xl" : "max-w-lg")} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted rounded-lg p-1 transition hover:bg-[var(--surface-3)]" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/** Friendly empty state: what is missing and what to do next. */
export function EmptyState({ title, text, action, icon: Icon = Inbox }: { title: string; text?: string; action?: ReactNode; icon?: typeof Inbox }) {
  return (
    <div className="anim-fade-in flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="relative mb-3">
        <svg className="absolute -left-10 top-1/2 h-6 w-[calc(100%+80px)] -translate-y-1/2 text-[var(--border-strong)]" viewBox="0 0 120 24" fill="none" preserveAspectRatio="none" aria-hidden>
          <path d="M0 12 H120" stroke="currentColor" strokeWidth="1.5" className="route-dash-slow" />
        </svg>
        <div className="relative grid h-11 w-11 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-primary shadow-card">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="text-sm font-semibold">{title}</p>
      {text && <p className="text-muted mt-1 max-w-sm text-[13px]">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="anim-fade-up flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">{message}</div>
      {onRetry && <button onClick={onRetry} className="font-semibold underline underline-offset-2">Retry</button>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return <div className="space-y-2 p-4">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>;
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="text-muted border-b border-[var(--border)] bg-[var(--surface-2)] text-[11px] uppercase tracking-wider">
            {head.map((h, i) => <th key={`${h}-${i}`} className="whitespace-nowrap px-4 py-2.5 font-semibold first:rounded-tl-2xl last:rounded-tr-2xl">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)] [&>tr]:transition-colors">{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, className }: { children: ReactNode; className?: string }) =>
  <td className={cn("whitespace-nowrap px-4 py-2.5", className)}>{children}</td>;

/** Toolbar above a table: search + filter selects on the left, extra controls on the right. */
export function Toolbar({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
      <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

/** Brand motif: animated dashed route line with stop dots. */
export function RouteDash({ className, color = "#F5B301", stops = true }: { className?: string; color?: string; stops?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 220 60" fill="none" aria-hidden>
      <path d="M6 48 C 40 48, 46 14, 84 14 S 128 46, 160 40 S 200 12, 214 12" stroke={color} strokeOpacity="0.25" strokeWidth="5" strokeLinecap="round" />
      <path d="M6 48 C 40 48, 46 14, 84 14 S 128 46, 160 40 S 200 12, 214 12" stroke={color} strokeWidth="2" className="route-dash" />
      {stops && [[6, 48], [84, 14], [160, 40], [214, 12]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === 3 ? 5 : 3.5} fill={i === 3 ? color : "var(--surface, #fff)"} stroke={color} strokeWidth="2" />
      ))}
    </svg>
  );
}

/** "Built by Nexi Net · © year Nexi Net. All rights reserved." */
export function Credit({ className, stacked }: { className?: string; stacked?: boolean }) {
  const year = new Date().getFullYear();
  return (
    <p className={cn("text-[11px] leading-snug", className)}>
      <span className="font-semibold">Built by Nexi Net</span>
      {stacked ? <br /> : <span aria-hidden> · </span>}
      © {year} Nexi Net. All rights reserved.
    </p>
  );
}
