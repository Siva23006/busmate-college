"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowRight, Bus, CalendarClock, CheckCircle2, ChevronRight, Crosshair, GraduationCap, History,
  Info, Radio, Route as RouteIcon, UserRound, WifiOff,
} from "lucide-react";
import { useLiveBuses } from "@/hooks/useLiveBuses";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/components/AuthProvider";
import { alertApi, dashboardApi, driverApi, tripApi } from "@/services/busmate";
import { ConnectionPill, LiveFleet } from "@/components/LiveFleet";
import { Ring } from "@/components/Ring";
import { useAlertToasts } from "@/components/Toasts";
import { Card, CardHeader, ErrorBox, IconTile, PageHeader, Skeleton, StatCard, cn, type Tone } from "@/components/ui";
import { alertTitle, localDate, timeAgo } from "@/lib/format";
import type { Alert } from "@/types";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);
const SEVERITY: Record<Alert["severity"], { tone: Tone; text: string }> = {
  CRITICAL: { tone: "red", text: "text-red-600 dark:text-red-400" },
  WARNING: { tone: "amber", text: "text-amber-600 dark:text-amber-400" },
  INFO: { tone: "blue", text: "text-blue-600 dark:text-blue-400" },
};

export default function DashboardPage() {
  const { user } = useAuth();
  const toasts = useAlertToasts();
  const [liveAlerts, setLiveAlerts] = useState<Alert[]>([]);
  const { buses, connection, loading } = useLiveBuses((a) => { toasts.push(a); setLiveAlerts((x) => [a, ...x]); });
  const stats = useAsync(() => dashboardApi.stats().then((r) => r.stats));
  const alerts = useAsync(() => alertApi.list(false).then((r) => r.alerts));
  const today = useAsync(() => tripApi.list({ date: localDate(), limit: 200 }).then((r) => r.trips));
  const drivers = useAsync(() => driverApi.list().then((r) => r.drivers));

  // Keep counters fresh as trips start/end
  useEffect(() => {
    const t = setInterval(() => { stats.reload(); today.reload(); drivers.reload(); }, 30000);
    return () => clearInterval(t);
  }, [stats.reload, today.reload, drivers.reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const s = stats.data;
  const total = s?.total_buses ?? buses.length;
  const activeNow = buses.filter((b) => b.active_trip_id).length;
  const offlineNow = buses.filter((b) => b.freshness === "OFFLINE" || b.status === "OFFLINE").length;
  const maintenance = buses.filter((b) => b.status === "MAINTENANCE").length;
  const driversOnTrip = (drivers.data ?? []).filter((d) => d.active_trip_id).length;
  const openAlerts = s ? s.open_alerts + liveAlerts.length : undefined;

  const recent = [...liveAlerts, ...(alerts.data ?? [])].filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i).slice(0, 3);

  // Today's trip progress: finished, on the road, and buses with a route that have not run yet.
  const progress = useMemo(() => {
    const trips = today.data ?? [];
    const ran = new Set(trips.map((t) => t.bus_id));
    const completed = trips.filter((t) => t.status === "COMPLETED").length;
    const inProgress = trips.filter((t) => t.status === "ACTIVE").length;
    const scheduled = trips.filter((t) => t.status === "SCHEDULED").length;
    const notStarted = scheduled + buses.filter((b) => b.route_id && b.status !== "MAINTENANCE" && !b.active_trip_id && !ran.has(b.id)).length;
    return { completed, inProgress, notStarted };
  }, [today.data, buses]);

  const driverStatus = useMemo(() => {
    const list = drivers.data ?? [];
    const onTrip = list.filter((d) => d.active_trip_id).length;
    const ready = list.filter((d) => !d.active_trip_id && d.status === "ACTIVE" && d.bus_id).length;
    const noBus = list.filter((d) => !d.active_trip_id && d.status === "ACTIVE" && !d.bus_id).length;
    const disabled = list.filter((d) => d.status !== "ACTIVE").length;
    return { onTrip, ready, noBus, disabled, total: list.length };
  }, [drivers.data]);

  const firstName = user?.name?.split(/\s+/)[0] ?? "Admin";
  const dateLabel = new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <PageHeader
        title={<>{greeting()}, {firstName} <span aria-hidden>👋</span></>}
        subtitle="Here's your college transport overview for today."
        actions={<>
          <span className="text-muted hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium sm:inline-flex">{dateLabel}</span>
          <ConnectionPill connection={connection} />
        </>}
      />
      {stats.error && <div className="mb-4"><ErrorBox message={stats.error} onRetry={stats.reload} /></div>}

      {/* KPI row */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard delay={0} label="Total Buses" value={s ? total : undefined} icon={Bus} tone="blue"
          caption={maintenance ? `${maintenance} in maintenance` : "Registered in the fleet"} captionTone={maintenance ? "amber" : "slate"} />
        <StatCard delay={1} label="Active Buses" value={s ? activeNow : undefined} icon={Radio} tone="green"
          caption={`${pct(activeNow, total)}% in service`} captionTone="green" />
        <StatCard delay={2} label="Offline Buses" value={s ? offlineNow : undefined} icon={WifiOff} tone="red"
          caption={offlineNow ? `${pct(offlineNow, total)}% not reporting` : "All buses reporting"} captionTone={offlineNow ? "red" : "slate"} />
        <StatCard delay={3} label="Today's Trips" value={s?.todays_trips} icon={CalendarClock} tone="violet"
          caption={s ? `${s.active_trips} running now` : undefined} captionTone="violet" />
        <StatCard delay={4} label="Total Students" value={s?.total_students} icon={GraduationCap} tone="amber"
          caption="Registered riders" />
        <StatCard delay={5} label="Active Drivers" value={s?.active_drivers} icon={UserRound} tone="sky"
          caption={drivers.data ? `${driversOnTrip} on a trip now` : undefined} captionTone="sky" />
      </div>

      {/* Live map + Active buses + Recent alerts */}
      <LiveFleet buses={buses} loading={loading} mapHeight="h-[580px]" aside={
        <Card delay={2} animate className="shrink-0">
          <CardHeader title="Recent Alerts" subtitle={openAlerts ? `${openAlerts} open` : undefined}
            actions={<Link href="/alerts" className="inline-flex items-center gap-1 text-xs font-semibold text-primary-text hover:underline">View all <ArrowRight className="h-3 w-3" /></Link>} />
          {alerts.loading && !recent.length ? (
            <div className="space-y-2 p-4">{[0, 1].map((i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : !recent.length ? (
            <div className="flex items-center gap-3 px-4 py-4">
              <IconTile icon={CheckCircle2} tone="green" size="sm" />
              <div className="text-[13px]"><div className="font-semibold">No open alerts</div><div className="text-muted text-xs">All buses are behaving. New alerts appear here instantly.</div></div>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {recent.map((a) => {
                const sev = SEVERITY[a.severity] ?? SEVERITY.INFO;
                return (
                  <li key={a.id} className="anim-fade-in flex items-start gap-3 px-4 py-2.5">
                    <IconTile icon={a.severity === "INFO" ? Info : AlertTriangle} tone={sev.tone} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={cn("truncate text-[13px] font-semibold", sev.text)}>{alertTitle(a.type)}{a.bus_number ? ` · ${a.bus_number}` : ""}</span>
                        <span className="text-subtle shrink-0 text-[11px]">{timeAgo(a.created_at)}</span>
                      </div>
                      <p className="text-muted truncate text-xs">{a.message}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      } />

      {/* Bottom row */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card delay={1}>
          <CardHeader title="Today's Trip Progress" subtitle="Morning and evening runs started today" />
          <div className="p-4">
            {today.loading && !today.data ? <Skeleton className="h-32" /> : (
              <Ring caption="trips + waiting" segments={[
                { label: "Completed", value: progress.completed, color: "#16a34a" },
                { label: "In progress", value: progress.inProgress, color: "#2563eb" },
                { label: "Not started yet", value: progress.notStarted, color: "#f59e0b", hint: "Buses with a route that have not run" },
              ]} />
            )}
          </div>
        </Card>
        <Card delay={2}>
          <CardHeader title="Driver Status" subtitle="Who is driving and who is ready" />
          <div className="p-4">
            {drivers.loading && !drivers.data ? <Skeleton className="h-32" /> : (
              <Ring center={driverStatus.total} caption="drivers" segments={[
                { label: "On a trip", value: driverStatus.onTrip, color: "#0284c7" },
                { label: "Ready (bus assigned)", value: driverStatus.ready, color: "#16a34a" },
                { label: "No bus assigned", value: driverStatus.noBus, color: "#f59e0b" },
                { label: "Disabled", value: driverStatus.disabled, color: "#94a3b8" },
              ]} />
            )}
          </div>
        </Card>
        <Card delay={3}>
          <CardHeader title="Quick Actions" subtitle="Common tasks, one click away" />
          <ul className="p-2">
            {[
              { href: "/track", icon: Crosshair, tone: "blue" as Tone, title: "Track a bus", text: "Live position, ETA and today's trips" },
              { href: "/buses", icon: Bus, tone: "green" as Tone, title: "Add or edit buses", text: "Assign a driver and a route" },
              { href: "/routes", icon: RouteIcon, tone: "amber" as Tone, title: "Plan a route", text: "Stops on the map, run times" },
              { href: "/trips", icon: History, tone: "violet" as Tone, title: "Trip reports", text: "History, replay and CSV export" },
            ].map((q) => (
              <li key={q.href}>
                <Link href={q.href} className="group flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-[var(--surface-2)]">
                  <IconTile icon={q.icon} tone={q.tone} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold">{q.title}</span>
                    <span className="text-muted block truncate text-xs">{q.text}</span>
                  </span>
                  <ChevronRight className="text-subtle h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {toasts.view}
    </>
  );
}
