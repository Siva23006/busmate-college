"use client";
import { useMemo } from "react";
import { useAsync } from "@/hooks/useAsync";
import { tripApi } from "@/services/busmate";
import { Card, EmptyState, ErrorBox, PageHeader, Skeleton } from "@/components/ui";

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
    return { days, totals: { trips: list.length, km: totalKm, avgMin }, perBus: [...bus.entries()] };
  }, [trips.data]);

  const max = Math.max(1, ...days.map(([, n]) => n));

  return (
    <>
      <PageHeader title="Analytics" subtitle="Based on the last 200 completed real trips (DEMO / SIMULATION trips are excluded)." />
      {trips.error && <ErrorBox message={trips.error} onRetry={trips.reload} />}
      {trips.loading ? <Skeleton className="h-64" /> : !trips.data?.length ? <Card><EmptyState title="No completed trips yet" text="Analytics appear after real trips are completed." /></Card> : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[["Completed trips", totals.trips.toString()], ["Distance driven", `${totals.km.toFixed(1)} km`], ["Average trip", `${Math.round(totals.avgMin)} min`]].map(([k, v]) => (
              <Card key={k} className="p-4"><div className="text-muted text-xs font-semibold uppercase">{k}</div><div className="mt-2 text-3xl font-extrabold">{v}</div></Card>
            ))}
          </div>
          <Card className="p-5">
            <h3 className="mb-4 font-bold">Trips per day</h3>
            <div className="flex h-48 items-end gap-2">
              {days.map(([d, n]) => (
                <div key={d} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs font-semibold">{n}</span>
                  <div className="w-full max-w-10 rounded-t-lg bg-amber-brand" style={{ height: `${(n / max) * 100}%` }} />
                  <span className="text-muted text-[10px]">{d.slice(5)}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="mb-3 font-bold">By bus</h3>
            <div className="space-y-2 text-sm">
              {perBus.map(([bus, s]) => (
                <div key={bus} className="flex justify-between border-b border-app pb-2"><span className="font-semibold">{bus}</span>
                  <span className="text-muted">{s.trips} trips · {s.km.toFixed(1)} km · avg {Math.round(s.minutes / s.trips)} min</span></div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
