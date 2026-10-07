"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Clock3, Flag, Gauge, MapPin, Pause, Play, PlayCircle, Route as RouteIcon, Square } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { routeApi, tripApi } from "@/services/busmate";
import { errorMessage } from "@/lib/api";
import { clock, dateTime, duration, km, tripEnds, tripTitle } from "@/lib/format";
import { BusMarker, FitBounds, MapView, Polyline, StopMarker, routeLine, stopsForDirection } from "@/components/MapView";
import { Badge, Button, Card, DemoBadge, ErrorBox, IconTile, PageHeader, Segmented, Skeleton, cn, stagger, type Tone } from "@/components/ui";

type Tab = "overview" | "stops" | "timeline";

function MetricTile({ icon, tone, label, value, sub, delay }: { icon: typeof Gauge; tone: Tone; label: string; value: string; sub?: string; delay: number }) {
  return (
    <Card hover delay={delay} className="flex items-center gap-3 p-3.5">
      <IconTile icon={icon} tone={tone} />
      <div className="min-w-0">
        <div className="text-muted text-xs font-medium">{label}</div>
        <div className="num truncate text-lg font-bold leading-tight">{value}</div>
        {sub && <div className="text-subtle truncate text-[11px]">{sub}</div>}
      </div>
    </Card>
  );
}

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const tripId = Number(id);
  const detail = useAsync(() => tripApi.get(tripId), [tripId]);
  const path = useAsync(() => tripApi.path(tripId), [tripId]);
  const route = useAsync(async () => (detail.data?.trip.route_id ? (await routeApi.get(detail.data.trip.route_id)).route : null), [detail.data?.trip.route_id]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");

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
  if (!detail.data) return <div className="space-y-4"><Skeleton className="h-10 w-72" /><div className="grid gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div><Skeleton className="h-96" /></div>;
  const { trip, stopEvents } = detail.data;
  const current = points[Math.min(index, points.length - 1)];
  const ends = tripEnds(trip.direction, trip.route_start, trip.route_destination);
  const live = trip.status === "ACTIVE";
  const eventsByStop = new Map(stopEvents.map((e) => [e.stop_id, e] as const));

  // Chronological timeline: start, each stop arrival / departure, end.
  const timeline = [
    trip.start_time ? { at: trip.start_time, title: "Trip started", sub: `Left ${ends.from}`, tone: "green" as Tone } : null,
    ...stopEvents.flatMap((e) => [
      e.arrived_at ? { at: e.arrived_at, title: `Arrived at ${e.stop_name}`, sub: `Stop ${e.stop_order}`, tone: "blue" as Tone } : null,
      e.departed_at ? { at: e.departed_at, title: `Left ${e.stop_name}`, sub: `Stop ${e.stop_order}`, tone: "slate" as Tone } : null,
    ]),
    trip.end_time ? { at: trip.end_time, title: "Trip ended", sub: `Reached ${ends.to}`, tone: "violet" as Tone } : null,
  ].filter((x): x is { at: string; title: string; sub: string; tone: Tone } => !!x)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  async function endTrip() {
    if (!confirm("Force-end this trip? Use only if the driver cannot end it from the app.")) return;
    try { await tripApi.end(trip.id); detail.reload(); } catch (err) { alert(errorMessage(err)); }
  }

  const dotColor: Record<Tone, string> = { green: "bg-emerald-500", blue: "bg-primary", slate: "bg-slate-400", violet: "bg-violet-500", amber: "bg-amber-500", red: "bg-red-500", sky: "bg-sky-500" };

  return (
    <>
      <Link href="/trips" className="text-muted mb-2 inline-flex items-center gap-1 text-xs font-medium hover:text-[var(--text)]"><ArrowLeft className="h-3.5 w-3.5" /> All trips</Link>
      <PageHeader title={`${trip.bus_number} · ${trip.trip_date}`} subtitle={`${trip.route_name ?? "No route"} · ${tripTitle(trip.direction, trip.route_start, trip.route_destination)} · ${trip.driver_name ?? "Unknown driver"}. Press play to replay the drive.`}
        actions={<>{trip.is_simulation && <DemoBadge />}<Badge tone={trip.direction === "FROM_COLLEGE" ? "violet" : "amber"}>{trip.direction === "FROM_COLLEGE" ? "Evening run" : "Morning run"}</Badge>
          <Badge tone={live ? "green" : "blue"} dot pulse={live}>{live ? "Live" : trip.status.charAt(0) + trip.status.slice(1).toLowerCase()}</Badge>
          {live && <Button variant="danger" onClick={endTrip}><Square className="h-3.5 w-3.5" /> End trip</Button>}</>} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile delay={0} icon={Gauge} tone="blue" label={live ? "Current speed" : "Speed at replay point"} value={current?.speed != null ? `${Math.round(current.speed * 3.6)} km/h` : "-"} sub={current ? clock(current.timestamp) : "No GPS points"} />
        <MetricTile delay={1} icon={RouteIcon} tone="green" label="Distance travelled" value={km(trip.distance_meters)} sub={`${path.data?.points.length ?? "-"} GPS points`} />
        <MetricTile delay={2} icon={Flag} tone="violet" label={trip.end_time ? "Arrived" : "Estimated arrival"} value={trip.end_time ? clock(trip.end_time) : "In progress"} sub={`at ${ends.to}`} />
        <MetricTile delay={3} icon={Clock3} tone="amber" label="Duration" value={duration(trip.duration_seconds)} sub={trip.stops_reached != null ? `${trip.stops_reached} of ${trip.stops_total ?? "-"} stops reached` : undefined} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-hidden p-0">
          <div className="h-[480px]">
            <MapView className="h-full rounded-none">
              <FitBounds points={driven.length ? driven : planned} />
              <Polyline path={planned} color="#94a3b8" weight={4} dashed />
              <Polyline path={driven} color="#F5B301" weight={5} />
              {mapStops.map((s) => <StopMarker key={s.id} stop={s} />)}
              {current && <BusMarker position={{ lat: current.latitude, lng: current.longitude }} label={trip.bus_number} heading={null} freshness="LIVE"
                speedKmh={current.speed != null ? Math.round(current.speed * 3.6) : null} selected demo={trip.is_simulation} />}
            </MapView>
          </div>
          <div className="flex items-center gap-3 border-t border-[var(--border)] px-3 py-2.5">
            <Button className="h-8 w-8 !p-0" disabled={!points.length} aria-label={playing ? "Pause" : "Play"}
              onClick={() => { if (index >= points.length - 1) setIndex(0); setPlaying((p) => !p); }}>
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </Button>
            <input type="range" min={0} max={Math.max(0, points.length - 1)} value={index} onChange={(e) => setIndex(Number(e.target.value))} className="flex-1 accent-blue-600" aria-label="Replay position" />
            <span className="text-muted num w-32 text-right text-xs">{current ? `${clock(current.timestamp)} · ${current.speed != null ? Math.round(current.speed * 3.6) : "-"} km/h` : "No GPS points"}</span>
          </div>
          <div className="text-subtle flex flex-wrap items-center gap-4 border-t border-[var(--border)] px-3 py-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-5 rounded bg-amber-brand" /> Route driven</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-slate-400" /> Planned route</span>
          </div>
        </Card>

        <Card delay={1} className="flex max-h-[600px] flex-col overflow-hidden">
          <div className="border-b border-[var(--border)] px-3 py-2.5">
            <Segmented value={tab} onChange={setTab} className="w-full [&>button]:flex-1 [&>button]:justify-center" options={[
              { value: "overview", label: live ? "Live" : "Overview" },
              { value: "stops", label: "Stops", count: mapStops.length || stopEvents.length },
              { value: "timeline", label: "Timeline" },
            ]} />
          </div>
          <div key={tab} className="anim-fade-in min-h-0 flex-1 overflow-y-auto p-4">
            {tab === "overview" && (
              <dl className="space-y-2.5 text-[13px]">
                {[["Direction", tripTitle(trip.direction, trip.route_start, trip.route_destination)], ["Driver", trip.driver_name ?? "-"], ["Route", trip.route_name ?? "-"],
                  ["Start", dateTime(trip.start_time)], ["End", dateTime(trip.end_time)], ["Duration", duration(trip.duration_seconds)],
                  ["Distance", km(trip.distance_meters)], ["Stops reached", trip.stops_reached != null ? `${trip.stops_reached} of ${trip.stops_total ?? "-"}` : "-"], ["GPS points", String(path.data?.points.length ?? "-")]].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-dashed border-[var(--border)] pb-2 last:border-0"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
                ))}
              </dl>
            )}

            {tab === "stops" && (
              mapStops.length ? (
                <ol className="relative ml-2 border-l-2 border-dashed border-[var(--border-strong)]">
                  {mapStops.map((s) => {
                    const e = eventsByStop.get(s.id);
                    return (
                      <li key={s.id} className="relative mb-3 pl-5">
                        <span className={cn("absolute -left-[9px] top-0.5 grid h-4 w-4 place-items-center rounded-full border-2 border-[var(--surface)] text-[8px] font-bold text-white",
                          e?.arrived_at ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600")}>{s.stop_order}</span>
                        <div className="flex items-start justify-between gap-2 text-[13px]">
                          <div className="min-w-0">
                            <div className={cn("truncate font-medium", !e?.arrived_at && "text-muted")}>{s.stop_name}</div>
                            {s.estimated_time && <div className="text-subtle text-[11px]">Scheduled {s.estimated_time.slice(0, 5)}</div>}
                          </div>
                          <div className="shrink-0 text-right text-xs">
                            {e?.arrived_at ? <><div className="font-semibold">{clock(e.arrived_at)}</div>{e.departed_at && <div className="text-muted">left {clock(e.departed_at)}</div>}</>
                              : <span className="text-muted">{live ? "Not yet" : "Not recorded"}</span>}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : !stopEvents.length ? <p className="text-muted text-[13px]">No stop arrivals recorded for this trip.</p> : (
                <ol className="space-y-2 text-[13px]">
                  {stopEvents.map((e) => (
                    <li key={e.stop_id} className="flex justify-between gap-2">
                      <span>{e.stop_order}. {e.stop_name}</span>
                      <span className="text-muted">{clock(e.arrived_at)}{e.departed_at ? ` → ${clock(e.departed_at)}` : ""}</span>
                    </li>
                  ))}
                </ol>
              )
            )}

            {tab === "timeline" && (
              !timeline.length ? <p className="text-muted text-[13px]">Nothing recorded yet. Events appear as the bus starts, reaches stops and ends the trip.</p> : (
                <ol className="relative ml-1.5 border-l border-[var(--border-strong)]">
                  {timeline.map((ev, i) => (
                    <li key={`${ev.at}-${i}`} className="anim-fade-up relative mb-3 pl-4" style={stagger(i, 40)}>
                      <span className={cn("absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--surface)]", dotColor[ev.tone])} />
                      <div className="flex items-start justify-between gap-2 text-[13px]">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{ev.title}</div>
                          <div className="text-subtle text-[11px]">{ev.sub}</div>
                        </div>
                        <span className="text-muted num shrink-0 text-xs">{clock(ev.at)}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              )
            )}
          </div>
          <div className="text-subtle flex items-center gap-1.5 border-t border-[var(--border)] px-4 py-2 text-[11px]">
            {tab === "timeline" ? <PlayCircle className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
            {tab === "timeline" ? "Times are recorded by the driver's phone GPS." : "Stops follow the order the bus visits them on this run."}
          </div>
        </Card>
      </div>
    </>
  );
}
