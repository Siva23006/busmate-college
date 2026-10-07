"use client";
import { useMemo } from "react";
import { BarChart3, Clock3, History, Route as RouteIcon } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { tripApi } from "@/services/busmate";
import { Card, CardHeader, EmptyState, ErrorBox, IconTile, PageHeader, Skeleton, stagger, type Tone } from "@/components/ui";

/** Simple analytics from real (non-simulated) completed trips. */
export default function AnalyticsPage() {
  const trips = useAsync(() => tripApi.list({ status: "COMPLETED", limit: 200 }).then((r) => r.trips.filter((t) => !t.is_simulation)));

  const { days, totals, perBus } = useMemo(() => {
    const list = trips.data ?? [];
    const byDay = new Map<string, number>();
    const bus = new Map<string, { trips: number; km: number; minutes: number }>();
    for (const t of list) {
      byDay.set(t.trip_date, (byDay.get(t.trip_date) ?? 0) + 1);
      const b = bus.get(t.bus_number) ?? { trips: 0, km: 0, minutes: 0 };
      b.trips += 1; b.km += (t.distance_meters ?? 0) / 1000; b.minutes += (t.duration_seconds ?? 0) / 60;
      bus.set(t.bus_number, b);
    }
    const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-14);
    const totalKm = list.reduce((s, t) => s + (t.distance_meters ?? 0), 0) / 1000;
    const avgMin = list.length ? list.reduce((s, t) => s + (t.duration_seconds ?? 0), 0) / 60 / list.length : 0;
    return { days, totals: { trips: list.length, km: totalKm, avgMin }, perBus: [...bus.entries()].sort((a, b) => b[1].trips - a[1].trips) };
  }, [trips.data]);

  const max = Math.max(1, ...days.map(([, n]) => n));
  const maxBusKm = Math.max(1, ...perBus.map(([, s]) => s.km));
  const kpis: { label: string; value: string; icon: typeof History; tone: Tone; hint: string }[] = [
    { label: "Completed trips", value: totals.trips.toString(), icon: History, tone: "blue", hint: "Real trips only" },
    { label: "Distance driven", value: `${totals.km.toFixed(1)} km`, icon: RouteIcon, tone: "green", hint: "Sum of all trips" },
    { label: "Average trip", value: `${Math.round(totals.avgMin)} min`, icon: Clock3, tone: "violet", hint: "Start to end" },
  ];

  return (
    <>
      <PageHeader title="Analytics" subtitle="How the fleet is used, from the last 200 completed real trips. DEMO / SIMULATION trips are left out." />
      {trips.error && <div className="mb-4"><ErrorBox message={trips.error} onRetry={trips.reload} /></div>}
      {trips.loading ? (
        <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-64" /></div>
      ) : !trips.data?.length ? (
        <Card><EmptyState icon={BarChart3} title="No completed trips yet" text="Charts appear here after drivers finish real trips in the Driver app." /></Card>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {kpis.map((k, i) => (
              <Card key={k.label} hover delay={i} className="flex items-center gap-3 p-4">
                <IconTile icon={k.icon} tone={k.tone} />
                <div>
                  <div className="text-muted text-xs font-medium">{k.label}</div>
                  <div className="num text-[24px] font-bold leading-tight tracking-tight">{k.value}</div>
                  <div className="text-subtle text-[11px]">{k.hint}</div>
                </div>
              </Card>
            ))}
          </div>
          <Card delay={3}>
            <CardHeader title="Trips per day" subtitle="Last 14 days with trips" />
            <div className="flex h-52 items-end gap-2 px-4 pb-3 pt-6">
              {days.map(([d, n], i) => (
                <div key={d} className="group flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="num text-[11px] font-semibold opacity-70 transition group-hover:opacity-100">{n}</span>
                  <div className="anim-bar w-full max-w-9 rounded-t-md bg-primary/85 transition group-hover:bg-primary" style={{ ...stagger(i, 40), height: `${(n / max) * 100}%` }} />
                  <span className="text-muted text-[10px]">{d.slice(5)}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card delay={4}>
            <CardHeader title="By bus" subtitle="Trips, distance and average trip time per bus" />
            <ul className="divide-y divide-[var(--border)]">
              {perBus.map(([bus, s]) => (
                <li key={bus} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
                  <span className="w-24 font-semibold">{bus}</span>
                  <div className="h-1.5 min-w-[80px] flex-1 overflow-hidden rounded-full bg-[var(--surface-3)]">
                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${(s.km / maxBusKm) * 100}%` }} />
                  </div>
                  <span className="text-muted num text-xs">{s.trips} trips · {s.km.toFixed(1)} km · avg {Math.round(s.minutes / s.trips)} min</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
