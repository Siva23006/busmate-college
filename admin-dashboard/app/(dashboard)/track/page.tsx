"use client";
// Track Bus: search a bus by number, see it live (fleet-tracking style), and see the whole day:
// where each trip started, the route it must follow, ETA, morning run and evening return times,
// and stop-by-stop arrivals (scheduled vs actual). Data comes from GET /api/buses/:id/track.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight, CalendarDays, Clock3, Crosshair, Flag, Gauge, MapPin, Navigation, PlayCircle, Radio,
  Route as RouteIcon, Search, Timer, UserRound, X,
} from "lucide-react";
import { useLiveBuses, type LiveBus } from "@/hooks/useLiveBuses";
import { busApi } from "@/services/busmate";
import { errorMessage } from "@/lib/api";
import { clock, duration, etaMinutes, km, timeAgo, timeOfDay, tripEnds } from "@/lib/format";
import type { TrackData, TrackTrip } from "@/types";
import {
  BusMarker, FitBounds, MapView, PanTo, Polyline, StartMarker, StopMarker, routeLine, stopsForDirection, type LatLng,
} from "@/components/MapView";
import { movementLabel } from "@/components/LiveFleet";
import { Badge, Button, Card, DemoBadge, EmptyState, ErrorBox, Input, LiveDot, PageHeader, RouteDash, Skeleton, cn, type Tone } from "@/components/ui";

const DIR_TONE: Record<string, Tone> = { TO_COLLEGE: "blue", FROM_COLLEGE: "violet" };

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function delayBadge(min: number | null) {
  if (min == null) return null;
  if (Math.abs(min) <= 2) return <Badge tone="green">On time</Badge>;
  return min > 0 ? <Badge tone={min > 10 ? "red" : "amber"}>{min} min late</Badge> : <Badge tone="blue">{-min} min early</Badge>;
}

/** Place names set by the admin on the route: morning home -> college, evening college -> home. */
function routeEnds(trip: { direction: string }, data: TrackData | null): [string, string] {
  const { from, to } = tripEnds(trip.direction, data?.route?.start_location, data?.route?.destination);
  return [from, to];
}

const shiftName = (direction: string) => (direction === "FROM_COLLEGE" ? "Evening" : "Morning");

export default function TrackBusPage() {
  const { buses, connection } = useLiveBuses();
  const [query, setQuery] = useState("");
  const [busId, setBusId] = useState<number | null>(null);
  const [date, setDate] = useState(localToday());
  const [data, setData] = useState<TrackData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openTripId, setOpenTripId] = useState<number | null>(null);
  const [startAddress, setStartAddress] = useState<string | null>(null);

  // Deep link: /track?bus=12 or /track?q=BUS 01 (from the top-bar search).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = Number(params.get("bus"));
    if (id) setBusId(id);
    const q = params.get("q");
    if (q) setQuery(q);
    // The top-bar search announces picks while this page is already open (same path: no remount).
    const onTrack = (e: Event) => {
      const d = (e as CustomEvent<{ bus?: number; q?: string }>).detail ?? {};
      if (d.bus) { setBusId(d.bus); setDate(localToday()); setQuery(""); }
      if (d.q != null) setQuery(d.q);
    };
    window.addEventListener("busmate:track", onTrack);
    return () => window.removeEventListener("busmate:track", onTrack);
  }, []);

  const live: LiveBus | null = buses.find((b) => b.id === busId) ?? null;

  const load = useCallback(async () => {
    if (!busId) return;
    setLoading(true);
    setError(null);
    try {
      const d = await busApi.track(busId, date);
      setData(d);
      setOpenTripId((cur) => cur ?? d.activeTripId ?? d.trips[d.trips.length - 1]?.id ?? null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [busId, date]);

  useEffect(() => { setData(null); setOpenTripId(null); load(); }, [load]);
  // Refresh the timeline when a trip starts/ends and every 30 s during a trip.
  useEffect(() => { if (busId) load(); }, [live?.active_trip_id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!live?.active_trip_id) return;
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [live?.active_trip_id, load]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...buses].sort((a, b) => Number(!!b.active_trip_id) - Number(!!a.active_trip_id) || a.bus_number.localeCompare(b.bus_number));
    if (!q) return list;
    return list.filter((b) => `${b.bus_number} ${b.registration_number ?? ""} ${b.driver_name ?? ""} ${b.route_name ?? ""}`.toLowerCase().includes(q));
  }, [buses, query]);

  function pick(id: number) {
    setBusId(id);
    setDate(localToday());
    window.history.replaceState(null, "", `/track?bus=${id}`);
  }

  function onSearchSubmit() {
    const exact = results.find((b) => b.bus_number.toLowerCase().replace(/\s/g, "") === query.trim().toLowerCase().replace(/\s/g, ""));
    const target = exact ?? results[0];
    if (target) pick(target.id);
  }

  const activeTrip = data?.activeTrip ?? null;
  const direction = live?.live?.direction ?? live?.active_trip_direction ?? activeTrip?.direction ?? "TO_COLLEGE";
  const stops = useMemo(() => stopsForDirection(data?.route?.stops, live?.active_trip_id ? direction : "TO_COLLEGE"), [data?.route, direction, live?.active_trip_id]);
  const line = useMemo(() => {
    const l = routeLine(data?.route?.path, data?.route?.stops);
    return live?.active_trip_id && direction === "FROM_COLLEGE" ? [...l].reverse() : l;
  }, [data?.route, direction, live?.active_trip_id]);
  const busPos: LatLng | null = live?.latitude != null && live.longitude != null && live.active_trip_id
    ? { lat: live.latitude, lng: live.longitude } : null;
  // Where the driver started: from the live socket message first (instant), else from the day log.
  const startSrc = live?.live?.start
    ?? (live?.trip_start_latitude != null ? { latitude: live.trip_start_latitude, longitude: live.trip_start_longitude! } : null)
    ?? activeTrip?.start ?? null;
  const startPos: LatLng | null = startSrc ? { lat: startSrc.latitude, lng: startSrc.longitude } : null;
  useEffect(() => { setStartAddress(null); }, [live?.active_trip_id]);
  const eta = live?.eta ?? data?.eta ?? null;
  const isToday = date === localToday();

  return (
    <>
      <PageHeader
        title="Track Bus"
        subtitle="Pick one bus to follow it live: where the trip started, the route it must follow, arrival estimates and the whole day's trips."
        actions={<Badge tone={connection === "online" ? "green" : connection === "connecting" ? "amber" : "red"} dot pulse={connection === "online"}>{connection === "online" ? "Live" : connection === "connecting" ? "Connecting" : "Offline"}</Badge>}
      />

      {/* Search */}
      <Card className="mb-4 p-3">
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); onSearchSubmit(); }}>
          <div className="relative flex-1">
            <Search className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input className="h-10 pl-9" placeholder="Search bus number, driver or route, e.g. BUS 01" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
            {query && <button type="button" onClick={() => setQuery("")} className="text-muted absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-[var(--surface-3)]" aria-label="Clear"><X className="h-3.5 w-3.5" /></button>}
          </div>
          <Button type="submit" className="h-10 px-5"><Crosshair className="h-4 w-4" /> Track</Button>
        </form>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {results.map((b) => {
            const m = movementLabel(b);
            return (
              <button key={b.id} onClick={() => pick(b.id)}
                className={cn("flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition duration-150",
                  b.id === busId ? "border-primary bg-primary-soft text-primary-text" : "border-app hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]")}>
                <LiveDot tone={b.freshness === "LIVE" ? "green" : b.freshness === "OFFLINE" ? "red" : b.freshness === "DELAYED" ? "amber" : "slate"} pulse={b.freshness === "LIVE"} />
                <span className="font-semibold">{b.bus_number}</span>
                <span className="text-muted hidden sm:inline">{m.text}</span>
              </button>
            );
          })}
          {!results.length && <span className="text-muted px-2 py-1.5 text-xs">No bus matches “{query}”. Try the bus number as painted on the bus.</span>}
        </div>
      </Card>

      {!busId && (
        <Card><EmptyState icon={Crosshair} title="Pick a bus to start tracking" text="Type a bus number above and press Track, or click one of the buses in the list." /></Card>
      )}

      {busId && error && <div className="mb-4"><ErrorBox message={error} onRetry={load} /></div>}

      {busId && (
        <>
          <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
            {/* Map */}
            <Card className="relative h-[560px] overflow-hidden p-0">
              <MapView className="h-full rounded-none">
                {!busPos && <FitBounds points={line} />}
                <PanTo target={busPos} zoom={15} />
                <Polyline path={line} color="#F5B301" weight={6} />
                {stops.map((s) => (
                  <StopMarker key={s.id} stop={s} highlight={eta?.nextStop?.stopId === s.id} />
                ))}
                {startPos && live?.active_trip_id && (
                  <StartMarker position={startPos} label={`START ${clock(activeTrip?.startTime ?? live.active_trip_start)}`} onAddress={setStartAddress} />
                )}
                {busPos && live && (
                  <BusMarker position={busPos} label={live.bus_number} heading={live.heading} freshness={live.freshness} selected demo={!!live.active_trip_is_simulation} />
                )}
              </MapView>
              {data && (
                <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                  <span className="surface rounded-lg px-2.5 py-1 text-xs font-semibold shadow-[var(--shadow-md)]">{data.bus.bus_number} · {data.route?.route_name ?? "No route"}</span>
                  {live?.active_trip_id ? <Badge tone={DIR_TONE[direction]}>{shiftName(direction)} · {routeEnds({ direction }, data).join(" → ")}</Badge> : <Badge>Not running</Badge>}
                  {live?.active_trip_is_simulation && <DemoBadge />}
                </div>
              )}
            </Card>

            {/* Live panel */}
            <Card className="flex h-[560px] flex-col overflow-hidden">
              {!data && loading ? <div className="space-y-3 p-5"><Skeleton className="h-8 w-40" /><Skeleton className="h-24" /><Skeleton className="h-40" /></div> : data && (
                <LivePanel data={data} live={live} direction={direction} startAddress={startAddress} hasStart={!!startPos} />
              )}
            </Card>
          </div>

          {/* Day summary */}
          {data && (
            <>
              <div className="mb-3 mt-6 flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-[15px] font-semibold"><CalendarDays className="text-muted h-4 w-4" /> Day log · {isToday ? "Today" : data.date}</h2>
                <div className="flex items-center gap-2">
                  <Input type="date" value={date} max={localToday()} onChange={(e) => setDate(e.target.value || localToday())} className="w-44" />
                  {!isToday && <button onClick={() => setDate(localToday())} className="text-xs font-semibold text-primary-text underline-offset-4 hover:underline">Back to today</button>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <SummaryTile i={0} label="Morning start" value={clock(data.summary.morningStart)} icon={PlayCircle} />
                <SummaryTile i={1} label="Reached college" value={clock(data.summary.morningEnd)} icon={Flag} />
                <SummaryTile i={2} label="Return start" value={clock(data.summary.returnStart)} icon={PlayCircle} />
                <SummaryTile i={3} label="Return end" value={clock(data.summary.returnEnd)} icon={Flag} />
                <SummaryTile i={4} label="Distance today" value={km(data.summary.distanceMeters)} icon={RouteIcon} />
              </div>

              <Card className="mt-4">
                <div className="border-app border-b px-4 py-3 text-[15px] font-semibold">Trips <span className="text-muted text-xs font-medium">({data.trips.length})</span></div>
                {!data.trips.length ? (
                  <EmptyState title="No trips on this day" text={data.days.length ? "Pick another date. Days with trips are listed below." : "Trips appear here once the driver presses START TRIP."} />
                ) : (
                  <ol className="divide-y divide-[var(--border)]">
                    {data.trips.map((t, i) => (
                      <TripRow key={t.id} trip={t} index={i + 1} data={data} open={openTripId === t.id}
                        onToggle={() => setOpenTripId(openTripId === t.id ? null : t.id)} />
                    ))}
                  </ol>
                )}
              </Card>

              {data.days.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-muted text-xs">Days with trips:</span>
                  {data.days.slice(0, 14).map((d) => (
                    <button key={d.trip_date} onClick={() => setDate(d.trip_date)}
                      className={cn("rounded-lg border px-2 py-1 text-[11px] font-semibold transition", d.trip_date === date ? "border-primary bg-primary-soft text-primary-text" : "border-app hover:bg-[var(--surface-2)]")}>
                      {d.trip_date.slice(5)} · {d.trips}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

function SummaryTile({ label, value, icon: Icon, i }: { label: string; value: string; icon: typeof Clock3; i: number }) {
  return (
    <Card hover delay={i} className="p-3.5">
      <div className="text-muted flex items-center justify-between text-xs font-medium">{label}<Icon className="text-subtle h-3.5 w-3.5" /></div>
      <div className="num mt-1 text-lg font-bold">{value}</div>
    </Card>
  );
}

function Row({ icon: Icon, label, children }: { icon: typeof Clock3; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5 text-[13px]">
      <Icon className="text-subtle h-3.5 w-3.5 shrink-0" />
      <span className="text-muted w-28 shrink-0">{label}</span>
      <span className="min-w-0 flex-1 text-right font-medium">{children}</span>
    </div>
  );
}

function LivePanel({ data, live, direction, startAddress, hasStart }: { data: TrackData; live: LiveBus | null; direction: string; startAddress: string | null; hasStart: boolean }) {
  const trip = data.activeTrip;
  const eta = live?.eta ?? data.eta;
  const [from, to] = routeEnds({ direction }, data);
  const m = live ? movementLabel(live) : null;
  const speed = live?.speed ?? data.live?.speed ?? null;

  if (!live?.active_trip_id) {
    const last = data.trips[data.trips.length - 1];
    return (
      <div className="anim-fade-in flex h-full flex-col p-4">
        <div className="text-muted text-[11px] font-semibold uppercase tracking-wider">Bus</div>
        <div className="text-xl font-bold tracking-tight">{data.bus.bus_number}</div>
        <div className="text-muted text-xs">{data.bus.registration_number ?? ""}</div>
        <div className="mt-4"><Badge tone="slate" dot>Not running now</Badge></div>
        <div className="mt-4">
          <Row icon={UserRound} label="Driver">{data.bus.driver_name ?? "-"}</Row>
          <Row icon={RouteIcon} label="Route">{data.route?.route_name ?? "-"}</Row>
          <Row icon={PlayCircle} label="Morning run">{timeOfDay(data.route?.morning_time)} · {routeEnds({ direction: "TO_COLLEGE" }, data).join(" → ")}</Row>
          <Row icon={PlayCircle} label="Evening run">{timeOfDay(data.route?.evening_time)} · {routeEnds({ direction: "FROM_COLLEGE" }, data).join(" → ")}</Row>
          <Row icon={MapPin} label="Last seen">{data.live?.label ?? (data.live ? `${data.live.latitude.toFixed(4)}, ${data.live.longitude.toFixed(4)}` : "-")}</Row>
          <Row icon={Radio} label="Last update">{timeAgo(data.live?.timestamp)}</Row>
          {last && <Row icon={Flag} label="Last trip">{shiftName(last.direction)} · {clock(last.startTime)}–{clock(last.endTime)}</Row>}
        </div>
        <p className="text-muted mt-auto text-xs">This panel goes live as soon as the driver presses START TRIP.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="relative overflow-hidden bg-ink-900 p-4 text-white">
        <RouteDash className="pointer-events-none absolute -right-6 top-2 h-14 w-48 opacity-40" stops={false} />
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-brand"><LiveDot tone="amber" /> Trip in progress</span>
          {m && <Badge tone={m.tone}>{m.text}</Badge>}
        </div>
        <div className="relative mt-1 text-xl font-bold tracking-tight">{data.bus.bus_number}</div>
        <div className="relative mt-1.5 flex items-center gap-2 text-[13px] font-medium">
          <span className="truncate">{from}</span><ArrowRight className="h-4 w-4 shrink-0 text-amber-brand" /><span className="truncate">{to}</span>
        </div>
        <div className="relative mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-white/10 p-2"><div className="num text-base font-bold">{speed != null ? Math.round(speed * 3.6) : "-"}</div><div className="text-[10px] uppercase text-slate-300">km/h</div></div>
          <div className="rounded-lg bg-white/10 p-2"><div className="num text-base font-bold">{trip ? duration(trip.durationSeconds) : "-"}</div><div className="text-[10px] uppercase text-slate-300">on trip</div></div>
          <div className="rounded-lg bg-white/10 p-2"><div className="num text-base font-bold">{trip ? `${trip.stopsReached}/${trip.stopsTotal}` : "-"}</div><div className="text-[10px] uppercase text-slate-300">stops</div></div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {eta?.nextStop && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
            <div className="text-[11px] font-semibold uppercase tracking-wider opacity-80">Next stop · estimated arrival</div>
            <div className="mt-0.5 text-[15px] font-bold">{eta.nextStop.stopName}</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs"><Timer className="h-3.5 w-3.5" />{etaMinutes(eta.nextStop.etaSeconds)} · {clock(eta.nextStop.expectedAt)} · {km(eta.nextStop.remainingMeters)}</div>
          </div>
        )}
        {eta?.destination && (
          <Row icon={Flag} label={`ETA ${to}`}>{clock(eta.destination.expectedAt)} ({etaMinutes(eta.destination.etaSeconds)})</Row>
        )}
        <Row icon={PlayCircle} label="Started at">{clock(trip?.startTime)}</Row>
        <Row icon={Crosshair} label="Started from">{startAddress ?? trip?.start?.label ?? (trip?.start ? `${trip.start.latitude.toFixed(4)}, ${trip.start.longitude.toFixed(4)}` : hasStart ? "On the map (green pin)" : "Waiting for first GPS fix")}</Row>
        <Row icon={UserRound} label="Driver">{trip?.driverName ?? data.bus.driver_name ?? "-"}</Row>
        <Row icon={Navigation} label="Run">{shiftName(direction)} · {from} → {to}</Row>
        <Row icon={Gauge} label="GPS accuracy">{live.accuracy != null ? `±${Math.round(live.accuracy)} m` : "-"}</Row>
        <Row icon={Radio} label="Last update">{timeAgo(live.location_time)}</Row>

        {eta && (
          <div className="mt-3">
            <div className="text-muted mb-2 text-[11px] font-semibold uppercase tracking-wider">Route to follow</div>
            <ol className="relative ml-2 border-l-2 border-dashed border-[var(--border-strong)]">
              {eta.stops.map((s) => (
                <li key={s.stopId} className="relative mb-2 pl-4 text-[13px]">
                  <span className={cn("absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-[var(--surface)]",
                    s.passed ? "bg-slate-300 dark:bg-slate-600" : eta.nextStop?.stopId === s.stopId ? "pulse-dot bg-amber-brand text-amber-brand" : "bg-primary")} />
                  <div className="flex justify-between gap-2">
                    <span className={cn(s.passed && "text-muted line-through")}>{s.stopOrder}. {s.stopName}</span>
                    <span className="text-muted shrink-0 text-xs">{s.passed ? "passed" : `${clock(s.expectedAt)} · ${etaMinutes(s.etaSeconds)}`}</span>
                  </div>
                </li>
              ))}
            </ol>
            <p className="text-muted text-[11px]">Estimated, not guaranteed. Updates with every GPS point.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TripRow({ trip, index, data, open, onToggle }: { trip: TrackTrip; index: number; data: TrackData; open: boolean; onToggle: () => void }) {
  const [from, to] = routeEnds(trip, data);
  return (
    <li>
      <button onClick={onToggle} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--surface-2)]">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary-text">{index}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold">
            <Badge tone={DIR_TONE[trip.direction]}>{shiftName(trip.direction)}</Badge>
            <span className="truncate">{from} → {to}</span>
            {trip.status === "ACTIVE" && <Badge tone="green" dot pulse>Live</Badge>}
            {trip.isSimulation && <DemoBadge />}
          </div>
          <div className="text-muted mt-0.5 text-xs">{trip.driverName ?? "Unknown driver"} · {trip.stopsReached}/{trip.stopsTotal} stops · {km(trip.distanceMeters)}</div>
        </div>
        <div className="text-right text-[13px]">
          <div className="num font-semibold">{clock(trip.startTime)} – {trip.endTime ? clock(trip.endTime) : "now"}</div>
          <div className="text-muted text-xs">{duration(trip.durationSeconds)}</div>
        </div>
      </button>
      {open && (
        <div className="surface-2 anim-fade-in px-4 pb-4 pt-2">
          <div className="grid gap-3 text-[13px] md:grid-cols-2">
            <div className="surface rounded-xl p-3">
              <div className="text-muted text-[11px] font-semibold uppercase tracking-wider">Started</div>
              <div className="font-medium">{clock(trip.startTime)} · {trip.start ? (trip.start.label ?? `${trip.start.latitude.toFixed(4)}, ${trip.start.longitude.toFixed(4)}`) : "no GPS yet"}</div>
            </div>
            <div className="surface rounded-xl p-3">
              <div className="text-muted text-[11px] font-semibold uppercase tracking-wider">Ended</div>
              <div className="font-medium">{trip.endTime ? `${clock(trip.endTime)} · ${trip.end ? (trip.end.label ?? `${trip.end.latitude.toFixed(4)}, ${trip.end.longitude.toFixed(4)}`) : "-"}` : "In progress"}</div>
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead><tr className="text-muted text-left text-[11px] uppercase tracking-wider"><th className="py-2">Stop</th><th>Scheduled</th><th>Arrived</th><th>Departed</th><th>Status</th></tr></thead>
              <tbody className="divide-y divide-[var(--border)]">
                {!trip.stopEvents.length && <tr><td colSpan={5} className="text-muted py-3">No stop arrivals recorded yet.</td></tr>}
                {trip.stopEvents.map((e) => (
                  <tr key={e.stopId}>
                    <td className="py-2 font-medium">{e.order}. {e.stopName}</td>
                    <td>{e.scheduledTime ?? "-"}</td>
                    <td>{clock(e.arrivedAt)}</td>
                    <td>{clock(e.departedAt)}</td>
                    <td>{delayBadge(e.delayMinutes) ?? <span className="text-muted">-</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link href={`/trips/${trip.id}`} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-text hover:underline">
            <PlayCircle className="h-4 w-4" /> Replay this trip on the map
          </Link>
        </div>
      )}
    </li>
  );
}
