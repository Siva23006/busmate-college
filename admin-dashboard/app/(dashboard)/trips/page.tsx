"use client";
import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Download, History } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { busApi, tripApi } from "@/services/busmate";
import { clock, duration, km, tripTitle } from "@/lib/format";
import type { Trip } from "@/types";
import { Badge, Button, Card, DemoBadge, EmptyState, ErrorBox, Input, PageHeader, Select, Table, TableSkeleton, Td, Toolbar, type Tone } from "@/components/ui";

const STATUS_TONE: Record<Trip["status"], Tone> = { ACTIVE: "green", COMPLETED: "blue", SCHEDULED: "slate", CANCELLED: "red" };

function exportCsv(trips: Trip[]) {
  const head = ["Trip ID", "Date", "Bus", "Driver", "Route", "Direction", "Start", "End", "Duration (min)", "Distance (km)", "Status", "Simulation"];
  const rows = trips.map((t) => [t.id, t.trip_date, t.bus_number, t.driver_name ?? "", t.route_name ?? "", tripTitle(t.direction, t.route_start, t.route_destination), t.start_time ?? "", t.end_time ?? "",
    t.duration_seconds != null ? Math.round(t.duration_seconds / 60) : "", t.distance_meters != null ? (t.distance_meters / 1000).toFixed(2) : "", t.status, t.is_simulation ? "DEMO" : ""]);
  const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url; a.download = `busmate-trips-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function TripsPage() {
  const [filters, setFilters] = useState({ status: "", busId: "", date: "" });
  const trips = useAsync(() => tripApi.list({ ...filters, limit: 200 }).then((r) => r.trips), [filters.status, filters.busId, filters.date]);
  const buses = useAsync(() => busApi.list().then((r) => r.buses));

  return (
    <>
      <PageHeader title="Trips" subtitle="Every trip a driver has run. Filter by day, bus or status, open a trip to replay it on the map, or export a CSV report."
        actions={<Button variant="secondary" disabled={!trips.data?.length} onClick={() => trips.data && exportCsv(trips.data)}><Download className="h-4 w-4" /> Export report</Button>} />
      {trips.error && <div className="mb-4"><ErrorBox message={trips.error} onRetry={trips.reload} /></div>}
      <Card>
        <Toolbar right={(filters.date || filters.busId || filters.status) ? <Button variant="ghost" className="px-2.5 py-1.5 text-xs" onClick={() => setFilters({ status: "", busId: "", date: "" })}>Clear filters</Button> : undefined}>
          <Input type="date" value={filters.date} onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))} className="sm:w-44" aria-label="Trip date" />
          <Select value={filters.busId} onChange={(e) => setFilters((f) => ({ ...f, busId: e.target.value }))} className="sm:w-40" aria-label="Bus">
            <option value="">All buses</option>{buses.data?.map((b) => <option key={b.id} value={b.id}>{b.bus_number}</option>)}
          </Select>
          <Select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="sm:w-40" aria-label="Status">
            <option value="">All statuses</option>{["ACTIVE", "COMPLETED", "SCHEDULED", "CANCELLED"].map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
          </Select>
        </Toolbar>
        {trips.loading ? <TableSkeleton /> : !trips.data?.length ? <EmptyState icon={History} title="No trips found" text={(filters.date || filters.busId || filters.status) ? "No trip matches these filters. Clear them to see all trips." : "Trips appear here once a driver presses START TRIP in the Driver app."} /> : (
          <Table head={["Date", "Bus", "Driver", "Route", "Direction", "Start", "End", "Duration", "Distance", "Status", ""]}>
            {trips.data.map((t) => (
              <tr key={t.id} className="hover:bg-[var(--surface-2)]">
                <Td>{t.trip_date}</Td>
                <Td className="font-semibold">{t.bus_number}</Td>
                <Td>{t.driver_name ?? "-"}</Td>
                <Td>{t.route_name ?? "-"}</Td>
                <Td>{tripTitle(t.direction, t.route_start, t.route_destination)}</Td>
                <Td>{clock(t.start_time)}</Td>
                <Td>{clock(t.end_time)}</Td>
                <Td>{duration(t.duration_seconds)}</Td>
                <Td>{km(t.distance_meters)}</Td>
                <Td><span className="flex gap-1"><Badge tone={STATUS_TONE[t.status]} dot pulse={t.status === "ACTIVE"}>{t.status.charAt(0) + t.status.slice(1).toLowerCase()}</Badge>{t.is_simulation && <DemoBadge />}</span></Td>
                <Td><Link href={`/trips/${t.id}`} className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary-text hover:underline">View / replay <ChevronRight className="h-3.5 w-3.5" /></Link></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
