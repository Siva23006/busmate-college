"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Pause, Play, Square } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { routeApi, tripApi } from "@/services/busmate";
import { errorMessage } from "@/lib/api";
import { clock, dateTime, duration, km, tripTitle } from "@/lib/format";
import { BusMarker, FitBounds, MapView, Polyline, StopMarker, routeLine, stopsForDirection } from "@/components/MapView";
import { Badge, Button, Card, DemoBadge, ErrorBox, PageHeader, Skeleton } from "@/components/ui";

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const tripId = Number(id);
  const detail = useAsync(() => tripApi.get(tripId), [tripId]);
  const path = useAsync(() => tripApi.path(tripId), [tripId]);
  const route = useAsync(async () => (detail.data?.trip.route_id ? (await routeApi.get(detail.data.trip.route_id)).route : null), [detail.data?.trip.route_id]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const points = useMemo(() => (path.data?.points ?? []).filter((p) => p.is_reliable), [path.data]);
  const driven = useMemo(() => points.map((p) => ({ lat: p.latitude, lng: p.longitude })), [points]);
  const planned = useMemo(() => routeLine(route.data?.path, route.data?.stops), [route.data]);
  // Stop numbers follow this trip's direction (reversed for an evening run).
  const mapStops = useMemo(() => stopsForDirection(route.data?.stops, detail.data?.trip.direction), [route.data, detail.data?.trip.direction]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setIndex((i) => { if (i >= points.length - 1) { setPlaying(false); return i; } return i + 1; }), 150);
    return () => clearInterval(t);
  }, [playing, points.length]);

  if (detail.error) return <ErrorBox message={detail.error} onRetry={detail.reload} />;
  if (!detail.data) return <Skeleton className="h-96" />;
  const { trip, stopEvents } = detail.data;
  const current = points[Math.min(index, points.length - 1)];

  async function endTrip() {
    if (!confirm("Force-end this trip? Use only if the driver cannot end it from the app.")) return;
    try { await tripApi.end(trip.id); detail.reload(); } catch (err) { alert(errorMessage(err)); }
  }

  return (
    <>
      <Link href="/trips" className="text-muted mb-3 inline-flex items-center gap-1 text-sm hover:underline"><ArrowLeft className="h-4 w-4" /> Trips</Link>
      <PageHeader title={`${trip.bus_number} · ${trip.trip_date}`} subtitle={`${trip.route_name ?? "No route"} · ${tripTitle(trip.direction, trip.route_start, trip.route_destination)} · ${trip.driver_name ?? "Unknown driver"}`}
        actions={<>{trip.is_simulation && <DemoBadge />}<Badge tone="amber">{tripTitle(trip.direction, trip.route_start, trip.route_destination)}</Badge><Badge tone={trip.status === "ACTIVE" ? "green" : "blue"}>{trip.status}</Badge>
          {trip.status === "ACTIVE" && <Button variant="danger" onClick={endTrip}><Square className="h-4 w-4" /> End trip</Button>}</>} />

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Card className="overflow-hidden p-0">
          <div className="h-[500px]">
            <MapView className="h-full rounded-none">
              <FitBounds points={driven.length ? driven : planned} />
              <Polyline path={planned} color="#94a3b8" weight={4} dashed />
              <Polyline path={driven} color="#F5B301" weight={5} />
              {mapStops.map((s) => <StopMarker key={s.id} stop={s} />)}
              {current && <BusMarker position={{ lat: current.latitude, lng: current.longitude }} label={trip.bus_number} heading={null} freshness="LIVE" selected demo={trip.is_simulation} />}
            </MapView>
          </div>
          <div className="border-app flex items-center gap-3 border-t p-3">
            <Button variant="secondary" className="px-3" disabled={!points.length} onClick={() => { if (index >= points.length - 1) setIndex(0); setPlaying((p) => !p); }}>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <input type="range" min={0} max={Math.max(0, points.length - 1)} value={index} onChange={(e) => setIndex(Number(e.target.value))} className="flex-1 accent-amber-500" />
            <span className="text-muted w-32 text-right text-xs">{current ? `${clock(current.timestamp)} · ${current.speed != null ? Math.round(current.speed * 3.6) : "-"} km/h` : "No GPS points"}</span>
          </div>
        </Card>

        <Card className="p-4">
          <dl className="space-y-2 text-sm">
            {[["Direction", tripTitle(trip.direction, trip.route_start, trip.route_destination)], ["Start", dateTime(trip.start_time)], ["End", dateTime(trip.end_time)], ["Duration", duration(trip.duration_seconds)],
              ["Distance", km(trip.distance_meters)], ["Stops reached", trip.stops_reached != null ? `${trip.stops_reached} of ${trip.stops_total ?? "-"}` : "-"], ["GPS points", String(path.data?.points.length ?? "-")]].map(([k, v]) => (
              <div key={k} className="flex justify-between"><dt className="text-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>
            ))}
          </dl>
          <h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide">Stop arrivals</h3>
          {!stopEvents.length ? <p className="text-muted text-sm">No stop arrivals recorded.</p> : (
            <ol className="space-y-2 text-sm">
              {stopEvents.map((e) => (
                <li key={e.stop_id} className="flex justify-between gap-2">
                  <span>{e.stop_order}. {e.stop_name}</span>
                  <span className="text-muted">{clock(e.arrived_at)}{e.departed_at ? ` → ${clock(e.departed_at)}` : ""}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}
