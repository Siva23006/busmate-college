"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  AlertTriangle, BarChart3, Bus, GraduationCap, LayoutDashboard, LogOut, MapPin, Menu, Navigation,
  Route as RouteIcon, Settings, UserRound, History, Crosshair,
} from "lucide-react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "./AuthProvider";
import { cn } from "./ui";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/live", label: "Live Buses", icon: Navigation },
  { href: "/track", label: "Track Bus", icon: Crosshair },
  { href: "/buses", label: "Buses", icon: Bus },
  { href: "/drivers", label: "Drivers", icon: UserRound },
  { href: "/routes", label: "Routes", icon: RouteIcon },
  { href: "/stops", label: "Stops", icon: MapPin },
  { href: "/students", label: "Students", icon: GraduationCap },
  { href: "/trips", label: "Trips", icon: History },
  { href: "/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-ink-900 text-slate-300 transition-transform lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}>
        <div className="flex items-center gap-3 px-5 py-5">
          <Logo />
          <div>
            <div className="text-lg font-extrabold tracking-wide text-white">BUSMATE</div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-amber-brand">Smart College Transport</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                isActive(href) ? "bg-white/10 text-white shadow-[inset_3px_0_0_#F5B301]" : "hover:bg-white/5 hover:text-white",
              )}>
              <Icon className={cn("h-[18px] w-[18px]", isActive(href) && "text-amber-brand")} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-white/5 hover:text-white">
            <LogOut className="h-[18px] w-[18px]" /> Logout
          </button>
          <p className="px-3 pt-2 text-[10px] leading-snug text-slate-500">College transportation technology prototype.</p>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="border-app sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-[var(--bg)] px-4 lg:px-8">
          <button className="rounded-xl p-2 hover:bg-[var(--surface-2)] lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <ThemeToggle />
          <div className="flex items-center gap-3 pl-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-ink-900 text-sm font-bold text-amber-brand">
              {user?.name?.[0]?.toUpperCase() ?? "A"}
            </div>
            <div className="hidden text-sm sm:block">
              <div className="font-semibold leading-tight">{user?.name}</div>
              <div className="text-muted text-xs">Administrator</div>
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
