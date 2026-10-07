"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Bus, CalendarClock, GraduationCap, Radio, UserRound, WifiOff } from "lucide-react";
import { useLiveBuses } from "@/hooks/useLiveBuses";
import { useAsync } from "@/hooks/useAsync";
import { alertApi, dashboardApi } from "@/services/busmate";
import { ConnectionPill, LiveFleet } from "@/components/LiveFleet";
import { useAlertToasts } from "@/components/Toasts";
import { Badge, Card, ErrorBox, PageHeader, Skeleton } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import type { Alert } from "@/types";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function DashboardPage() {
  const toasts = useAlertToasts();
  const [liveAlerts, setLiveAlerts] = useState<Alert[]>([]);
  const { buses, connection, loading } = useLiveBuses((a) => { toasts.push(a); setLiveAlerts((x) => [a, ...x]); });
  const stats = useAsync(() => dashboardApi.stats().then((r) => r.stats));
  const alerts = useAsync(() => alertApi.list(false).then((r) => r.alerts));

  // Keep counters fresh as trips start/end
  useEffect(() => { const t = setInterval(stats.reload, 30000); return () => clearInterval(t); }, [stats.reload]);

  const s = stats.data;
  const activeNow = buses.filter((b) => b.active_trip_id).length;
  const offlineNow = buses.filter((b) => b.freshness === "OFFLINE" || b.status === "OFFLINE").length;
  const cards = [
    { label: "Total buses", value: s?.total_buses, icon: Bus },
    { label: "Active buses", value: s ? activeNow : undefined, icon: Radio, accent: "text-live" },
    { label: "Offline buses", value: s ? offlineNow : undefined, icon: WifiOff, accent: offlineNow ? "text-offline" : undefined },
    { label: "Today's trips", value: s?.todays_trips, icon: CalendarClock },
    { label: "Total students", value: s?.total_students, icon: GraduationCap },
    { label: "Active drivers", value: s?.active_drivers, icon: UserRound },
    { label: "Open alerts", value: s ? s.open_alerts + liveAlerts.length : undefined, icon: AlertTriangle, accent: s && s.open_alerts + liveAlerts.length ? "text-delayed" : undefined },
  ];
  const recent = [...liveAlerts, ...(alerts.data ?? [])].filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i).slice(0, 6);

  return (
    <>
      <PageHeader title={`${greeting()}`} subtitle="Here is your college transport right now." actions={<ConnectionPill connection={connection} />} />
      {stats.error && <div className="mb-4"><ErrorBox message={stats.error} onRetry={stats.reload} /></div>}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {cards.map(({ label, value, icon: Icon, accent }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-muted text-xs font-semibold uppercase tracking-wide">{label}</span>
              <Icon className={`h-4 w-4 ${accent ?? "text-muted"}`} />
            </div>
            {value === undefined ? <Skeleton className="mt-3 h-8 w-12" /> : <div className={`mt-2 text-3xl font-extrabold ${accent ?? ""}`}>{value}</div>}
          </Card>
        ))}
      </div>

      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide">Live bus map</h2>
      <LiveFleet buses={buses} loading={loading} />

      <div className="mt-6">
        <Card>
          <div className="border-app flex items-center justify-between border-b px-4 py-3">
            <h3 className="font-bold">Recent alerts</h3>
            <Link href="/alerts" className="text-sm font-semibold underline-offset-4 hover:underline">View all</Link>
          </div>
          {!recent.length ? <p className="text-muted px-4 py-6 text-sm">No open alerts. All good.</p> : (
            <ul className="divide-y divide-[var(--border)]">
              {recent.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <Badge tone={a.severity === "CRITICAL" ? "red" : a.severity === "WARNING" ? "amber" : "blue"}>{a.severity}</Badge>
                  <span className="flex-1">{a.message}</span>
                  <span className="text-muted text-xs">{timeAgo(a.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      {toasts.view}
    </>
  );
}
