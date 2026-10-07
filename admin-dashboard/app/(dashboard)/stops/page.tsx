"use client";
import Link from "next/link";
import { useState } from "react";
import { MapPin } from "lucide-react";
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
      <PageHeader title="Stops" subtitle="Every pickup point across all routes. To add, move or reorder stops, open the route and use its map."
        actions={<Select value={routeId} onChange={(e) => setRouteId(e.target.value)} className="w-56">
          <option value="">All routes</option>
          {routes.data?.map((r) => <option key={r.id} value={r.id}>{r.route_name}</option>)}
        </Select>} />
      {stops.error && <div className="mb-4"><ErrorBox message={stops.error} onRetry={stops.reload} /></div>}
      <Card>
        {stops.loading ? <TableSkeleton /> : !stops.data?.length ? <EmptyState icon={MapPin} title="No stops yet" text="Open a route on the Routes page and click its map to add stops." action={<Link href="/routes" className="text-[13px] font-semibold text-primary-text hover:underline">Go to Routes →</Link>} /> : (
          <Table head={["#", "Stop", "Route", "Coordinates", "Geofence", "Scheduled", ""]}>
            {stops.data.map((s) => (
              <tr key={s.id} className="hover:bg-[var(--surface-2)]">
                <Td><span className="grid h-6 w-6 place-items-center rounded-full bg-primary-soft text-[11px] font-bold text-primary-text">{s.stop_order}</span></Td>
                <Td className="font-semibold">{s.stop_name}</Td>
                <Td>{routeName(s.route_id)}</Td>
                <Td className="font-mono text-xs">{s.latitude.toFixed(5)}, {s.longitude.toFixed(5)}</Td>
                <Td>{s.geofence_radius} m</Td>
                <Td>{s.estimated_time?.slice(0, 5) ?? "-"}</Td>
                <Td><Link className="text-xs font-semibold text-primary-text hover:underline" href={`/routes/${s.route_id}`}>Edit on map →</Link></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
