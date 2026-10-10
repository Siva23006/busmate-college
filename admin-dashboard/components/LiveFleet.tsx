"use client";
// Live multi-bus map + bus list + detail panel (used on Dashboard and Live Buses pages).
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft, ArrowLeftRight, ChevronRight, Crosshair, Gauge, Maximize2, Minimize2, Radio, Signal, UserRound,
  Route as RouteIcon, Clock, Timer, Navigation,
} from "lucide-react";
import type { LiveBus } from "@/hooks/useLiveBuses";
import type { Connection } from "@/hooks/useLiveBuses";
import { routeApi } from "@/services/busmate";
import type { Route } from "@/types";
import { BusMarker, FitBounds, MapView, PanTo, Polyline, StartMarker, StopMarker, routeLine, stopsForDirection, type LatLng } from "./MapView";
import { Badge, DemoBadge, EmptyState, LiveDot, Segmented, Skeleton, cn, stagger, type Tone } from "./ui";
import { clock, etaMinutes, km, timeAgo, tripEnds, tripTitle } from "@/lib/format";
import { DriverMessageCard, useDriverMessage } from "./DriverMessageCard";

const FRESH: Record<LiveBus["freshness"], { tone: Tone; label: string }> = {
  LIVE: { tone: "green", label: "Online" },
  DELAYED: { tone: "amber", label: "Delayed" },
  OFFLINE: { tone: "red", label: "Offline" },
  IDLE: { tone: "slate", label: "No active trip" },
};

export function movementLabel(b: LiveBus): { tone: Tone; text: string } {
  if (b.freshness === "OFFLINE") return { tone: "red", text: "Offline" };
  if (b.freshness === "IDLE") return { tone: "slate", text: b.status === "MAINTENANCE" ? "Maintenance" : "Not running" };
  if (b.lastEvent?.status === "AT_STOP" && b.live?.atStopId) return { tone: "blue", text: `At ${b.lastEvent.stopName}` };
  if (b.lastEvent?.status === "GPS_POOR") return { tone: "amber", text: "GPS weak" };
  return b.isMoving ? { tone: "green", text: "Running" } : { tone: "amber", text: "Stopped" };
}

/** Which filter chip a bus belongs to. "idle" buses only show under "All". */
export type FleetBucket = "running" | "stopped" | "offline" | "idle";
export function fleetBucket(b: LiveBus): FleetBucket {
  if (b.freshness === "OFFLINE" || (b.active_trip_id && b.status === "OFFLINE")) return "offline";
  if (!b.active_trip_id) return "idle";
  return b.isMoving ? "running" : "stopped";
}

/** Direction of the bus's running trip, or null when it is not on a trip. */
export function tripDirection(b: LiveBus) {
  return b.active_trip_id ? (b.live?.direction ?? b.active_trip_direction ?? "TO_COLLEGE") : null;
}

/** "Morning · Redhills → Dr. MGR University" for a running bus. */
export function runTitle(b: LiveBus): string {
  return tripTitle(tripDirection(b), b.route_start, b.route_destination);
}

/** Where the selected bus started its trip (live message first, then the REST snapshot). */
export function tripStart(b: LiveBus | null): LatLng | null {
  if (!b?.active_trip_id) return null;
  const s = b.live?.start ?? (b.trip_start_latitude != null ? { latitude: b.trip_start_latitude, longitude: b.trip_start_longitude! } : null);
  return s ? { lat: s.latitude, lng: s.longitude } : null;
}

export function ConnectionPill({ connection }: { connection: Connection }) {
  const map = { online: ["green", "Live"], connecting: ["amber", "Connecting"], offline: ["red", "Offline"] } as const;
  const [tone, label] = map[connection];
  return <Badge tone={tone} dot pulse={connection === "online"}>{label}</Badge>;
}

const kmhOf = (b: LiveBus) => (b.speed != null ? Math.round(b.speed * 3.6) : null);
type Filter = "all" | "running" | "stopped" | "offline";

export function LiveFleet({ buses, loading, mapHeight = "h-[520px]", aside, title = "Live Bus Map", listTitle = "Active Buses" }: {
  buses: LiveBus[]; loading: boolean; mapHeight?: string;
  /** Extra card under the bus list (e.g. Recent Alerts on the dashboard). */
  aside?: ReactNode; title?: string; listTitle?: string;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [full, setFull] = useState(false);
  const mapCardRef = useRef<HTMLDivElement | null>(null);
  const selected = buses.find((b) => b.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected?.route_id) { setRoute(null); return; }
    let cancelled = false;
    routeApi.get(selected.route_id).then(({ route }) => { if (!cancelled) setRoute(route); }).catch(() => setRoute(null));
    return () => { cancelled = true; };
  }, [selected?.route_id]);

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === mapCardRef.current && !!mapCardRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
    else mapCardRef.current?.requestFullscreen?.().catch(() => undefined);
  };

  const counts = useMemo(() => {
    const c = { all: buses.length, running: 0, stopped: 0, offline: 0 };
    buses.forEach((b) => { const k = fleetBucket(b); if (k !== "idle") c[k] += 1; });
    return c;
  }, [buses]);
  const matches = (b: LiveBus) => filter === "all" || fleetBucket(b) === filter;

  const positioned = buses.filter((b) => b.latitude != null && b.longitude != null && b.active_trip_id && matches(b));
  const fitPoints = useMemo<LatLng[]>(() => positioned.map((b) => ({ lat: b.latitude!, lng: b.longitude! })),
    // refit only when the set of buses changes, not on every movement
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [positioned.map((b) => b.id).join(",")]);
  const line = useMemo(() => routeLine(route?.path, route?.stops), [route]);
  // Stop numbers follow the running trip: reversed for an evening (FROM_COLLEGE) run.
  const direction = selected ? tripDirection(selected) : null;
  const mapStops = useMemo(() => stopsForDirection(route?.stops, direction), [route, direction]);
  const startPos = tripStart(selected);
  const [startAddress, setStartAddress] = useState<string | null>(null);
  useEffect(() => { setStartAddress(null); }, [selected?.id, selected?.active_trip_id]);
  const focus = selected && selected.latitude != null ? { lat: selected.latitude, lng: selected.longitude! } : null;
  const sorted = [...buses].filter(matches)
    .sort((a, b) => Number(!!b.active_trip_id) - Number(!!a.active_trip_id) || a.bus_number.localeCompare(b.bus_number));

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      {/* Map card */}
      <div ref={mapCardRef} className={cn("fs-card anim-fade-up flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-card", mapHeight)}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold">{title}</h3>
            {counts.running + counts.stopped > 0 && <LiveDot />}
          </div>
          <div className="flex items-center gap-2">
            <Segmented size="sm" value={filter} onChange={setFilter} options={[
              { value: "all", label: "All", count: counts.all },
              { value: "running", label: "Running", count: counts.running },
              { value: "stopped", label: "Stopped", count: counts.stopped },
              { value: "offline", label: "Offline", count: counts.offline },
            ]} />
            <button onClick={toggleFull} className="text-muted rounded-lg border border-[var(--border)] p-1.5 transition hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
              aria-label={full ? "Exit full screen" : "Full screen map"} title={full ? "Exit full screen" : "Full screen"}>
              {full ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
        <div className="relative min-h-0 flex-1">
          <MapView className="h-full rounded-none">
            {!selected && <FitBounds points={fitPoints} />}
            <PanTo target={focus} zoom={15} />
            {route && <Polyline path={line} color="#F5B301" weight={5} />}
            {startPos && <StartMarker position={startPos} label={`START ${clock(selected?.active_trip_start)}`} onAddress={setStartAddress} />}
            {route && mapStops.map((s) => <StopMarker key={s.id} stop={s} highlight={selected?.eta?.nextStop?.stopId === s.id} />)}
            {positioned.map((b) => (
              <BusMarker key={b.id} position={{ lat: b.latitude!, lng: b.longitude! }} label={b.bus_number}
                heading={b.heading} freshness={b.freshness} selected={b.id === selectedId} moving={b.isMoving} speedKmh={kmhOf(b)}
                demo={!!b.active_trip_is_simulation} onClick={() => setSelectedId(b.id)} />
            ))}
          </MapView>
          {selected && (
            <button onClick={() => setSelectedId(null)} className="anim-scale-in absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold shadow-[var(--shadow-md)]">
              <ArrowLeft className="h-3.5 w-3.5" /> Show all buses
            </button>
          )}
          {!loading && !positioned.length && (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
              <span className="anim-fade-up rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium shadow-[var(--shadow-md)]">
                {filter === "all" ? "No bus is on a trip right now. Buses appear here when a driver presses START TRIP." : `No ${filter} buses right now.`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Right column: list / detail, plus optional extra card */}
      <div className={cn("flex min-h-0 flex-col gap-4", mapHeight)}>
        <div className="anim-fade-up flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-card" style={stagger(1)}>
          {selected ? <BusDetail key={selected.id} bus={selected} route={route} startAddress={startAddress} hasStart={!!startPos} onBack={() => setSelectedId(null)} /> : (
            <>
              <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
                <h3 className="text-[15px] font-semibold">{listTitle}</h3>
                <span className="text-muted text-xs">{positioned.length} on the map</span>
              </div>
              <div key={filter} className="anim-fade-in min-h-0 flex-1 divide-y divide-[var(--border)] overflow-y-auto">
                {loading && Array.from({ length: 4 }).map((_, i) => <div key={i} className="px-4 py-3"><Skeleton className="h-10" /></div>)}
                {!loading && !buses.length && <EmptyState icon={Navigation} title="No buses yet" text="Add a bus on the Buses page, then assign a driver and route." />}
                {!loading && !!buses.length && !sorted.length && <EmptyState icon={Navigation} title={`No ${filter} buses`} text="Choose “All” to see every bus." />}
                {sorted.map((b) => <BusRow key={b.id} bus={b} onClick={() => setSelectedId(b.id)} />)}
              </div>
            </>
          )}
        </div>
        {aside}
      </div>
    </div>
  );
}

function BusRow({ bus: b, onClick }: { bus: LiveBus; onClick: () => void }) {
  const m = movementLabel(b);
  const speed = kmhOf(b);
  const eta = b.eta?.nextStop?.etaSeconds;
  return (
    <button onClick={onClick} className="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-[var(--surface-2)]">
      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[10px] font-bold",
        m.tone === "green" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
          : m.tone === "red" ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300"
            : m.tone === "amber" ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
              : m.tone === "blue" ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                : "bg-[var(--surface-3)] text-muted")}>
        {b.freshness === "LIVE" ? <LiveDot tone={m.tone} /> : <Navigation className="h-3.5 w-3.5" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold">{b.bus_number}{b.active_trip_is_simulation && <DemoBadge />}</div>
        <div className="text-muted truncate text-xs">{b.active_trip_id ? (b.route_name ?? runTitle(b)) : (b.route_name ?? "No route")} · {b.driver_name ?? "No driver"}</div>
      </div>
      <div className="shrink-0 text-right">
        <Badge tone={m.tone}>{m.text}</Badge>
        {b.active_trip_id && (
          <div className="text-muted num mt-1 text-[11px]">
            {speed != null ? `${speed} km/h` : "-"}{eta != null ? ` · ETA ${etaMinutes(eta)}` : ""}
          </div>
        )}
      </div>
      <ChevronRight className="text-subtle h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function Row({ icon: Icon, label, children }: { icon: typeof Gauge; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5 text-[13px]">
      <Icon className="text-subtle h-3.5 w-3.5 shrink-0" />
      <span className="text-muted w-28 shrink-0">{label}</span>
      <span className="min-w-0 flex-1 truncate text-right font-medium">{children}</span>
    </div>
  );
}

function BusDetail({ bus, route, startAddress, hasStart, onBack }: { bus: LiveBus; route: Route | null; startAddress: string | null; hasStart: boolean; onBack: () => void }) {
  const ends = tripEnds(tripDirection(bus), bus.route_start, bus.route_destination);
  const m = movementLabel(bus);
  const f = FRESH[bus.freshness];
  const eta = bus.eta;
  const driverMsg = useDriverMessage(bus);
  return (
    <div className="anim-fade-in flex h-full flex-col">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <button onClick={onBack} className="text-muted mb-1.5 inline-flex items-center gap-1 text-xs font-semibold hover:text-[var(--text)]"><ArrowLeft className="h-3.5 w-3.5" /> All buses</button>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold tracking-tight">{bus.bus_number}</h3>
          <Badge tone={f.tone} dot pulse={bus.freshness === "LIVE"}>{f.label}</Badge>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge tone={m.tone}>{m.text}</Badge>
          {bus.active_trip_id && <Badge tone="blue">{runTitle(bus)}</Badge>}
          {bus.active_trip_is_simulation && <DemoBadge />}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
        <DriverMessageCard message={driverMsg} className="mb-2 mt-1" />
        <Row icon={UserRound} label="Driver">{bus.driver_name ?? "-"}</Row>
        <Row icon={RouteIcon} label="Route">{bus.route_name ?? "-"}</Row>
        <Row icon={ArrowLeftRight} label="Run">{bus.active_trip_id ? `${ends.from} → ${ends.to}` : "-"}</Row>
        <Row icon={Gauge} label="Speed">{bus.speed != null ? `${Math.round(bus.speed * 3.6)} km/h` : "-"}</Row>
        <Row icon={Crosshair} label="GPS accuracy">{bus.accuracy != null ? `±${Math.round(bus.accuracy)} m` : "-"}{bus.live?.accuracyLevel ? ` · ${bus.live.accuracyLevel}` : ""}</Row>
        <Row icon={Radio} label="Last update">{timeAgo(bus.location_time)}</Row>
        <Row icon={Clock} label="Trip started">{clock(bus.active_trip_start)}</Row>
        {bus.active_trip_id && <Row icon={Crosshair} label="Started from">{startAddress ?? (hasStart ? "Green START pin" : "Waiting for GPS")}</Row>}
        {eta?.nextStop && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
            <div className="text-[11px] font-semibold uppercase tracking-wider opacity-80">Next stop · estimated arrival</div>
            <div className="mt-0.5 text-[15px] font-bold">{eta.nextStop.stopName}</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs"><Timer className="h-3.5 w-3.5" />
              {etaMinutes(eta.nextStop.etaSeconds)} · {clock(eta.nextStop.expectedAt)} · {km(eta.nextStop.remainingMeters)}
            </div>
          </div>
        )}
        {eta && (
          <div className="mt-4">
            <div className="text-muted mb-2 text-[11px] font-semibold uppercase tracking-wider">Stops</div>
            <ol className="relative ml-1.5 border-l-2 border-dashed border-[var(--border-strong)]">
              {eta.stops.map((s) => {
                const next = eta.nextStop?.stopId === s.stopId;
                return (
                  <li key={s.stopId} className="relative mb-2 pl-4 text-[13px]">
                    <span className={cn("absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-[var(--surface)]",
                      s.passed ? "bg-slate-300 dark:bg-slate-600" : next ? "pulse-dot bg-amber-brand text-amber-brand" : "bg-primary")} />
                    <div className="flex justify-between gap-2">
                      <span className={cn("truncate", s.passed && "text-muted line-through", next && "font-semibold")}>{s.stopOrder}. {s.stopName}</span>
                      <span className="text-muted shrink-0 text-xs">{s.passed ? "passed" : `~${etaMinutes(s.etaSeconds)}`}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="text-subtle mt-2 text-[11px]">Estimated, not guaranteed. Updates with every GPS point.</p>
          </div>
        )}
        {!bus.active_trip_id && <p className="text-muted mt-4 text-[13px]">This bus has no active trip. {route ? `${route.stops?.length ?? 0} stops on ${route.route_name}.` : ""}</p>}
        {bus.active_trip_id && !eta && <p className="text-muted mt-4 flex items-center gap-2 text-[13px]"><Signal className="h-4 w-4" /> Waiting for the next GPS update…</p>}
      </div>
    </div>
  );
}
