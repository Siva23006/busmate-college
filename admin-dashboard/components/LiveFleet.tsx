"use client";
// Live multi-bus map + bus list + detail panel (used on Dashboard and Live Buses pages).
import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Crosshair, Gauge, Radio, Signal, UserRound, Route as RouteIcon, Clock, Timer } from "lucide-react";
import type { LiveBus } from "@/hooks/useLiveBuses";
import type { Connection } from "@/hooks/useLiveBuses";
import { routeApi } from "@/services/busmate";
import type { Route } from "@/types";
import { BusMarker, FitBounds, MapView, PanTo, Polyline, StartMarker, StopMarker, routeLine, stopsForDirection, type LatLng } from "./MapView";
import { Badge, Card, DemoBadge, EmptyState, Skeleton, cn, type Tone } from "./ui";
import { clock, etaMinutes, km, timeAgo, tripEnds, tripTitle } from "@/lib/format";

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
  return b.isMoving ? { tone: "green", text: "Moving" } : { tone: "amber", text: "Stopped" };
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
  return <Badge tone={tone} dot>{label}</Badge>;
}

export function LiveFleet({ buses, loading, mapHeight = "h-[520px]" }: { buses: LiveBus[]; loading: boolean; mapHeight?: string }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const selected = buses.find((b) => b.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected?.route_id) { setRoute(null); return; }
    let cancelled = false;
    routeApi.get(selected.route_id).then(({ route }) => { if (!cancelled) setRoute(route); }).catch(() => setRoute(null));
    return () => { cancelled = true; };
  }, [selected?.route_id]);

  const positioned = buses.filter((b) => b.latitude != null && b.longitude != null && b.active_trip_id);
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
  const sorted = [...buses].sort((a, b) => Number(!!b.active_trip_id) - Number(!!a.active_trip_id) || a.bus_number.localeCompare(b.bus_number));

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <Card className={cn("relative overflow-hidden p-0", mapHeight)}>
        <MapView className="h-full rounded-none">
          {!selected && <FitBounds points={fitPoints} />}
          <PanTo target={focus} zoom={15} />
          {route && <Polyline path={line} color="#F5B301" weight={5} />}
          {startPos && <StartMarker position={startPos} label={`START ${clock(selected?.active_trip_start)}`} onAddress={setStartAddress} />}
          {route && mapStops.map((s) => <StopMarker key={s.id} stop={s} highlight={selected?.eta?.nextStop?.stopId === s.id} />)}
          {positioned.map((b) => (
            <BusMarker key={b.id} position={{ lat: b.latitude!, lng: b.longitude! }} label={b.bus_number}
              heading={b.heading} freshness={b.freshness} selected={b.id === selectedId}
              demo={!!b.active_trip_is_simulation} onClick={() => setSelectedId(b.id)} />
          ))}
        </MapView>
        {selected && (
          <button onClick={() => setSelectedId(null)} className="surface absolute left-3 top-3 rounded-xl px-3 py-1.5 text-xs font-semibold shadow">
            Show all buses
          </button>
        )}
      </Card>

      <Card className={cn("flex flex-col overflow-hidden", mapHeight)}>
        {selected ? <BusDetail bus={selected} route={route} startAddress={startAddress} hasStart={!!startPos} onBack={() => setSelectedId(null)} /> : (
          <>
            <div className="border-app flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-bold">Buses</h3>
              <span className="text-muted text-xs">{positioned.length} on the map</span>
            </div>
            <div className="flex-1 divide-y divide-[var(--border)] overflow-y-auto">
              {loading && Array.from({ length: 4 }).map((_, i) => <div key={i} className="p-4"><Skeleton className="h-12" /></div>)}
              {!loading && !buses.length && <EmptyState title="No buses yet" text="Add a bus on the Buses page." />}
              {sorted.map((b) => {
                const m = movementLabel(b);
                return (
                  <button key={b.id} onClick={() => setSelectedId(b.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--surface-2)]">
                    <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", b.freshness === "LIVE" && "pulse-dot text-live bg-live",
                      b.freshness === "DELAYED" && "bg-delayed", b.freshness === "OFFLINE" && "bg-offline", b.freshness === "IDLE" && "bg-slate-400")} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 font-semibold">{b.bus_number}{b.active_trip_is_simulation && <DemoBadge />}</div>
                      <div className="text-muted truncate text-xs">{b.active_trip_id ? runTitle(b) : (b.route_name ?? "No route")} · {b.driver_name ?? "No driver"}</div>
                    </div>
                    <div className="text-right">
                      <Badge tone={m.tone}>{m.text}</Badge>
                      {b.active_trip_id && b.speed != null && <div className="text-muted mt-1 text-xs">{Math.round(b.speed * 3.6)} km/h</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function Row({ icon: Icon, label, children }: { icon: typeof Gauge; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className="text-muted h-4 w-4" />
      <span className="text-muted w-28 text-sm">{label}</span>
      <span className="flex-1 text-right text-sm font-semibold">{children}</span>
    </div>
  );
}

function BusDetail({ bus, route, startAddress, hasStart, onBack }: { bus: LiveBus; route: Route | null; startAddress: string | null; hasStart: boolean; onBack: () => void }) {
  const ends = tripEnds(tripDirection(bus), bus.route_start, bus.route_destination);
  const m = movementLabel(bus);
  const f = FRESH[bus.freshness];
  const eta = bus.eta;
  return (
    <div className="flex h-full flex-col">
      <div className="border-app border-b px-4 py-3">
        <button onClick={onBack} className="text-muted mb-1 text-xs font-semibold hover:underline">← All buses</button>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xl font-extrabold">{bus.bus_number}</h3>
          <Badge tone={f.tone} dot>{f.label}</Badge>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone={m.tone}>{m.text}</Badge>
          {bus.active_trip_id && <Badge tone="blue">{runTitle(bus)}</Badge>}
          {bus.active_trip_is_simulation && <DemoBadge />}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <Row icon={UserRound} label="Driver">{bus.driver_name ?? "-"}</Row>
        <Row icon={RouteIcon} label="Route">{bus.route_name ?? "-"}</Row>
        <Row icon={ArrowLeftRight} label="Run">{bus.active_trip_id ? `${ends.from} → ${ends.to}` : "-"}</Row>
        <Row icon={Gauge} label="Speed">{bus.speed != null ? `${Math.round(bus.speed * 3.6)} km/h` : "-"}</Row>
        <Row icon={Crosshair} label="GPS accuracy">{bus.accuracy != null ? `±${Math.round(bus.accuracy)} m` : "-"}{bus.live?.accuracyLevel ? ` · ${bus.live.accuracyLevel}` : ""}</Row>
        <Row icon={Radio} label="Last update">{timeAgo(bus.location_time)}</Row>
        <Row icon={Clock} label="Trip started">{clock(bus.active_trip_start)}</Row>
        {bus.active_trip_id && <Row icon={Crosshair} label="Started from">{startAddress ?? (hasStart ? "Green START pin" : "Waiting for GPS")}</Row>}
        {eta?.nextStop && (
          <div className="mt-3 rounded-2xl bg-amber-soft p-4 text-ink-900">
            <div className="text-xs font-bold uppercase tracking-wide">Estimated arrival · next stop</div>
            <div className="mt-1 text-lg font-extrabold">{eta.nextStop.stopName}</div>
            <div className="mt-1 flex items-center gap-2 text-sm"><Timer className="h-4 w-4" />
              {etaMinutes(eta.nextStop.etaSeconds)} · {clock(eta.nextStop.expectedAt)} · {km(eta.nextStop.remainingMeters)}
            </div>
          </div>
        )}
        {eta && (
          <div className="mt-4">
            <div className="text-muted mb-2 text-xs font-bold uppercase tracking-wide">Stops</div>
            <ol className="space-y-1.5">
              {eta.stops.map((s) => (
                <li key={s.stopId} className="flex items-center gap-2 text-sm">
                  <span className={cn("grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold",
                    s.passed ? "bg-slate-200 text-slate-500 dark:bg-slate-700" : "bg-ink-900 text-white dark:bg-amber-brand dark:text-ink-950")}>{s.stopOrder}</span>
                  <span className={cn("flex-1", s.passed && "text-muted line-through")}>{s.stopName}</span>
                  <span className="text-muted text-xs">{s.passed ? "passed" : `~${etaMinutes(s.etaSeconds)}`}</span>
                </li>
              ))}
            </ol>
            <p className="text-muted mt-3 text-[11px]">Estimated, not guaranteed. Updates with every GPS point.</p>
          </div>
        )}
        {!bus.active_trip_id && <p className="text-muted mt-4 text-sm">This bus has no active trip. {route ? `${route.stops?.length ?? 0} stops on ${route.route_name}.` : ""}</p>}
        {bus.active_trip_id && !eta && <p className="text-muted mt-4 flex items-center gap-2 text-sm"><Signal className="h-4 w-4" /> Waiting for the next GPS update…</p>}
      </div>
    </div>
  );
}
