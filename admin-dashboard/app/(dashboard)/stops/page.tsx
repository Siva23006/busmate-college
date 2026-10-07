"use client";
import Link from "next/link";
import { useState } from "react";
import { useAsync } from "@/hooks/useAsync";
import { routeApi, stopApi } from "@/services/busmate";
import { Card, EmptyState, ErrorBox, PageHeader, Select, Table, TableSkeleton, Td } from "@/components/ui";

export default function StopsPage() {
  const routes = useAsync(() => routeApi.list().then((r) => r.routes));
  const [routeId, setRouteId] = useState("");
  const stops = useAsync(() => stopApi.list(routeId ? Number(routeId) : undefined).then((r) => r.stops), [routeId]);
  const routeName = (id: number) => routes.data?.find((r) => r.id === id)?.route_name ?? `Route ${id}`;

  return (
    <>
      <PageHeader title="Stops" subtitle="All stops across routes. Add, move and reorder stops from a route's page."
        actions={<Select value={routeId} onChange={(e) => setRouteId(e.target.value)} className="w-56">
          <option value="">All routes</option>
          {routes.data?.map((r) => <option key={r.id} value={r.id}>{r.route_name}</option>)}
        </Select>} />
      {stops.error && <div className="mb-4"><ErrorBox message={stops.error} onRetry={stops.reload} /></div>}
      <Card>
        {stops.loading ? <TableSkeleton /> : !stops.data?.length ? <EmptyState title="No stops" text="Open a route and click the map to add stops." /> : (
          <Table head={["#", "Stop", "Route", "Coordinates", "Geofence", "Scheduled", ""]}>
            {stops.data.map((s) => (
              <tr key={s.id} className="hover:bg-[var(--surface-2)]">
                <Td>{s.stop_order}</Td>
                <Td className="font-semibold">{s.stop_name}</Td>
                <Td>{routeName(s.route_id)}</Td>
                <Td className="font-mono text-xs">{s.latitude.toFixed(5)}, {s.longitude.toFixed(5)}</Td>
                <Td>{s.geofence_radius} m</Td>
                <Td>{s.estimated_time?.slice(0, 5) ?? "-"}</Td>
                <Td><Link className="text-sm font-semibold hover:underline" href={`/routes/${s.route_id}`}>Edit on map</Link></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
