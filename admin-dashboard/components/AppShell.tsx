"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle, BarChart3, Bell, Bus, GraduationCap, LayoutDashboard, LogOut, MapPin, Menu, Navigation,
  Route as RouteIcon, Settings, UserRound, History, Crosshair, X,
} from "lucide-react";
import { Brand } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "./AuthProvider";
import { GlobalSearch, type SearchPage } from "./GlobalSearch";
import { alertApi } from "@/services/busmate";
import { Credit, RouteDash, cn } from "./ui";

type NavItem = SearchPage;
const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  { title: "Overview", items: [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, hint: "Today at a glance" },
    { href: "/live", label: "Live Buses", icon: Navigation, hint: "All buses on one map" },
    { href: "/track", label: "Track Bus", icon: Crosshair, hint: "Follow one bus and its day" },
  ] },
  { title: "Manage", items: [
    { href: "/buses", label: "Buses", icon: Bus, hint: "Add buses, assign driver and route" },
    { href: "/drivers", label: "Drivers", icon: UserRound, hint: "Driver accounts" },
    { href: "/routes", label: "Routes", icon: RouteIcon, hint: "Routes, stops and run times" },
    { href: "/stops", label: "Stops", icon: MapPin, hint: "Every stop across routes" },
    { href: "/students", label: "Students", icon: GraduationCap, hint: "Student accounts" },
  ] },
  { title: "Reports", items: [
    { href: "/trips", label: "Trips", icon: History, hint: "Trip history and replay" },
    { href: "/alerts", label: "Alerts", icon: AlertTriangle, hint: "Overspeed, offline, off route" },
    { href: "/analytics", label: "Analytics", icon: BarChart3, hint: "Trips and distance" },
  ] },
  { title: "System", items: [
    { href: "/settings", label: "Settings", icon: Settings, hint: "Connection, account, theme" },
  ] },
];
const ALL_PAGES = NAV_GROUPS.flatMap((g) => g.items);

/** Number of open alerts, refreshed on navigation and every minute. */
function useOpenAlertCount(pathname: string) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = () => alertApi.list(false).then((r) => { if (!cancelled) setCount(r.alerts.length); }).catch(() => { /* keep last value */ });
    load();
    const t = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(t); };
  }, [pathname]);
  return count;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const alerts = useOpenAlertCount(pathname);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const initials = (user?.name ?? "Admin").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] transition-transform duration-300 lg:translate-x-0",
        open ? "translate-x-0 shadow-[var(--shadow-lg)]" : "-translate-x-full",
      )}>
        <div className="relative px-4 pb-2 pt-4">
          <div className="flex items-center justify-between">
            <Link href="/" onClick={() => setOpen(false)}><Brand size={34} /></Link>
            <button className="text-muted rounded-lg p-1.5 hover:bg-[var(--surface-3)] lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-4 w-4" /></button>
          </div>
          <RouteDash className="mt-2 h-5 w-full opacity-80" stops={false} />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-3">
          {NAV_GROUPS.map((g) => (
            <div key={g.title} className="mt-3 first:mt-1">
              <div className="text-subtle px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em]">{g.title}</div>
              <div className="space-y-0.5">
                {g.items.map(({ href, label, icon: Icon }) => {
                  const active = isActive(href);
                  return (
                    <Link key={href} href={href} onClick={() => setOpen(false)}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] font-medium transition-all duration-150",
                        active ? "bg-primary text-white shadow-[0_4px_12px_-4px_rgba(37,99,235,0.55)]"
                          : "text-muted hover:bg-[var(--surface-3)] hover:text-[var(--text)]",
                      )}>
                      <Icon className={cn("h-4 w-4 shrink-0 transition-transform duration-150", !active && "group-hover:scale-110")} />
                      <span className="flex-1">{label}</span>
                      {href === "/alerts" && !!alerts && (
                        <span className={cn("num rounded-full px-1.5 text-[10px] font-bold leading-4", active ? "bg-white/25 text-white" : "bg-red-500 text-white")}>{alerts}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-[var(--border)] p-3">
          <button onClick={logout} className="text-muted flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10">
            <LogOut className="h-4 w-4" /> Logout
          </button>
          <Credit stacked className="text-subtle px-3 pt-2" />
        </div>
      </aside>
      {open && <div className="anim-fade-in fixed inset-0 z-30 bg-ink-950/40 backdrop-blur-[1px] lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="route-strip sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)]/85 px-4 backdrop-blur-md lg:px-6">
          <button className="text-muted rounded-lg p-2 hover:bg-[var(--surface-3)] lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <GlobalSearch pages={ALL_PAGES} />
          <div className="flex-1" />
          <ThemeToggle />
          <Link href="/alerts" className="text-muted relative rounded-lg p-2 transition hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
            aria-label={alerts ? `${alerts} open alerts` : "Alerts"} title="Open alerts">
            <Bell className="h-[18px] w-[18px]" />
            {!!alerts && (
              <span className="num absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9.5px] font-bold text-white ring-2 ring-[var(--surface)]">
                {alerts > 99 ? "99+" : alerts}
              </span>
            )}
          </Link>
          <div className="flex items-center gap-2.5 border-l border-[var(--border)] pl-3">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-primary to-indigo-500 text-[11px] font-bold text-white">
              {initials}
            </div>
            <div className="hidden leading-tight sm:block">
              <div className="max-w-[140px] truncate text-[13px] font-semibold">{user?.name}</div>
              <div className="text-muted text-[11px]">Administrator</div>
            </div>
          </div>
        </header>
        <main key={pathname} className="anim-fade-in flex-1 px-4 py-5 lg:px-6">{children}</main>
        <footer className="text-subtle flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] px-4 py-3 lg:px-6">
          <Credit />
          <span className="text-[11px]">BusMate · Smart College Transport</span>
        </footer>
      </div>
    </div>
  );
}
