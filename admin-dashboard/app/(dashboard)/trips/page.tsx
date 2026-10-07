"use client";
import Link from "next/link";
import { useState } from "react";
import { Download } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { busApi, tripApi } from "@/services/busmate";
import { clock, directionLabel, duration, km } from "@/lib/format";
import type { Trip } from "@/types";
import { Badge, Button, Card, DemoBadge, EmptyState, ErrorBox, Input, PageHeader, Select, Table, TableSkeleton, Td, type Tone } from "@/components/ui";

const STATUS_TONE: Record<Trip["status"], Tone> = { ACTIVE: "green", COMPLETED: "blue", SCHEDULED: "slate", CANCELLED: "red" };

function exportCsv(trips: Trip[]) {
  const head = ["Trip ID", "Date", "Bus", "Driver", "Route", "Direction", "Start", "End", "Duration (min)", "Distance (km)", "Status", "Simulation"];
  const rows = trips.map((t) => [t.id, t.trip_date, t.bus_number, t.driver_name ?? "", t.route_name ?? "", directionLabel(t.direction), t.start_time ?? "", t.end_time ?? "",
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
      <PageHeader title="Trips" subtitle="Trip history with route replay."
        actions={<Button variant="secondary" disabled={!trips.data?.length} onClick={() => trips.data && exportCsv(trips.data)}><Download className="h-4 w-4" /> Export report</Button>} />
      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-3">
        <Input type="date" value={filters.date} onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))} />
        <Select value={filters.busId} onChange={(e) => setFilters((f) => ({ ...f, busId: e.target.value }))}>
          <option value="">All buses</option>{buses.data?.map((b) => <option key={b.id} value={b.id}>{b.bus_number}</option>)}
        </Select>
        <Select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="">All statuses</option>{["ACTIVE", "COMPLETED", "SCHEDULED", "CANCELLED"].map((s) => <option key={s}>{s}</option>)}
        </Select>
      </Card>
      {trips.error && <div className="mb-4"><ErrorBox message={trips.error} onRetry={trips.reload} /></div>}
      <Card>
        {trips.loading ? <TableSkeleton /> : !trips.data?.length ? <EmptyState title="No trips found" text="Trips appear here once a driver presses START TRIP." /> : (
          <Table head={["Date", "Bus", "Driver", "Route", "Direction", "Start", "End", "Duration", "Distance", "Status", ""]}>
            {trips.data.map((t) => (
              <tr key={t.id} className="hover:bg-[var(--surface-2)]">
                <Td>{t.trip_date}</Td>
                <Td className="font-semibold">{t.bus_number}</Td>
                <Td>{t.driver_name ?? "-"}</Td>
                <Td>{t.route_name ?? "-"}</Td>
                <Td>{directionLabel(t.direction)}</Td>
                <Td>{clock(t.start_time)}</Td>
                <Td>{clock(t.end_time)}</Td>
                <Td>{duration(t.duration_seconds)}</Td>
                <Td>{km(t.distance_meters)}</Td>
                <Td><span className="flex gap-1"><Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>{t.is_simulation && <DemoBadge />}</span></Td>
                <Td><Link href={`/trips/${t.id}`} className="text-sm font-semibold hover:underline">View / replay</Link></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
