"use client";
// Top-bar search: finds pages, buses, drivers and routes. Ctrl+K (or Cmd+K, or "/") focuses it.
// Enter with no exact pick opens Track Bus with the text as the search.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bus, CornerDownLeft, Route as RouteIcon, Search, UserRound } from "lucide-react";
import { busApi, driverApi, routeApi } from "@/services/busmate";
import type { Bus as BusT, Driver, Route } from "@/types";
import { cn } from "./ui";

type IconType = typeof Bus;

export type SearchPage = { href: string; label: string; icon: IconType; hint?: string };
type Item = { key: string; label: string; sub: string; href: string; icon: IconType; group: string; track?: { bus?: number; q?: string } };

/** Tell an already-open Track Bus page to switch bus / search text (same-path navigation does not remount it). */
export function announceTrack(detail: { bus?: number; q?: string }) {
  window.dispatchEvent(new CustomEvent("busmate:track", { detail }));
}

export function GlobalSearch({ pages }: { pages: SearchPage[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [data, setData] = useState<{ buses: BusT[]; drivers: Driver[]; routes: Route[] } | null>(null);
  const loadingRef = useRef(false);

  // Ctrl+K / Cmd+K / "/" focuses the search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !typing)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function load() {
    if (data || loadingRef.current) return;
    loadingRef.current = true;
    Promise.all([
      busApi.list().then((r) => r.buses).catch(() => [] as BusT[]),
      driverApi.list().then((r) => r.drivers).catch(() => [] as Driver[]),
      routeApi.list().then((r) => r.routes).catch(() => [] as Route[]),
    ]).then(([buses, drivers, routes]) => setData({ buses, drivers, routes })).finally(() => { loadingRef.current = false; });
  }

  const items = useMemo<Item[]>(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const has = (...v: (string | null | undefined)[]) => v.some((x) => x?.toLowerCase().includes(s));
    const out: Item[] = [];
    data?.buses.filter((b) => has(b.bus_number, b.registration_number, b.driver_name, b.route_name)).slice(0, 5).forEach((b) =>
      out.push({ key: `b${b.id}`, label: b.bus_number, sub: `${b.route_name ?? "No route"} · ${b.driver_name ?? "No driver"}`, href: `/track?bus=${b.id}`, icon: Bus, group: "Buses", track: { bus: b.id } }));
    data?.drivers.filter((d) => has(d.name, d.employee_id, d.phone)).slice(0, 3).forEach((d) =>
      out.push({ key: `d${d.id}`, label: d.name, sub: `${d.employee_id}${d.bus_number ? ` · ${d.bus_number}` : ""}`, href: d.bus_id ? `/track?bus=${d.bus_id}` : "/drivers", icon: UserRound, group: "Drivers", track: d.bus_id ? { bus: d.bus_id } : undefined }));
    data?.routes.filter((r) => has(r.route_name, r.start_location, r.destination)).slice(0, 3).forEach((r) =>
      out.push({ key: `r${r.id}`, label: r.route_name, sub: `${r.start_location ?? "-"} → ${r.destination ?? "-"}`, href: `/routes/${r.id}`, icon: RouteIcon, group: "Routes" }));
    pages.filter((p) => has(p.label, p.hint)).slice(0, 4).forEach((p) =>
      out.push({ key: `p${p.href}`, label: p.label, sub: p.hint ?? "Page", href: p.href, icon: p.icon, group: "Pages" }));
    return out;
  }, [q, data, pages]);

  useEffect(() => setActive(0), [q]);

  function go(item?: Item) {
    const text = q.trim();
    if (!item && !text) return;
    const target = item ?? { href: `/track?q=${encodeURIComponent(text)}`, track: { q: text } };
    router.push(target.href);
    if (target.track) setTimeout(() => announceTrack(target.track!), 0);
    setOpen(false);
    setQ("");
    inputRef.current?.blur();
  }

  let lastGroup = "";
  return (
    <div className="relative w-full max-w-md">
      <Search className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => { load(); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); go(items[active]); }
          else if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
        }}
        placeholder="Search buses, drivers, routes…"
        aria-label="Search buses, drivers and routes"
        className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] pl-9 pr-16 text-[13px] outline-none transition placeholder:text-[var(--subtle)] hover:border-[var(--border-strong)] focus:border-primary focus:bg-[var(--surface)] focus:ring-2 focus:ring-primary/20"
      />
      <kbd className="text-muted pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 font-sans text-[10px] font-semibold sm:block">Ctrl K</kbd>

      {open && q.trim() && (
        <div className="anim-scale-in absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)]">
          {!data && <div className="p-3"><div className="progress-indeterminate h-1 rounded-full bg-[var(--surface-3)]" /></div>}
          {data && !items.length && <p className="text-muted px-4 py-3 text-[13px]">No exact match. Press Enter to look for “{q.trim()}” on Track Bus.</p>}
          <ul className="max-h-80 overflow-y-auto py-1">
            {items.map((it, i) => {
              const header = it.group !== lastGroup ? it.group : null;
              lastGroup = it.group;
              const Icon = it.icon;
              return (
                <li key={it.key}>
                  {header && <div className="text-subtle px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider">{header}</div>}
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => go(it)} onMouseEnter={() => setActive(i)}
                    className={cn("flex w-full items-center gap-3 px-3 py-2 text-left", i === active && "bg-primary-soft")}>
                    <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", i === active ? "bg-primary text-white" : "bg-[var(--surface-3)] text-muted")}><Icon className="h-3.5 w-3.5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{it.label}</span>
                      <span className="text-muted block truncate text-xs">{it.sub}</span>
                    </span>
                    {i === active && <CornerDownLeft className="text-muted h-3.5 w-3.5" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
