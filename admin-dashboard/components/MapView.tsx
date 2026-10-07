"use client";
// Google Maps building blocks (via @vis.gl/react-google-maps).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { APIProvider, AdvancedMarker, Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { MapPinOff } from "lucide-react";
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAP_ID } from "@/lib/config";
import type { Stop } from "@/types";
import { cn } from "./ui";

export type LatLng = { lat: number; lng: number };

/** Map container. Shows a friendly setup message when no API key is configured. */
export function MapView({ children, center, zoom = 12, className, onClick }:
  { children?: ReactNode; center?: LatLng | null; zoom?: number; className?: string; onClick?: (p: LatLng) => void }) {
  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className={cn("surface-2 border-app grid place-items-center rounded-2xl border border-dashed p-6 text-center", className)}>
        <div>
          <MapPinOff className="text-muted mx-auto mb-2 h-6 w-6" />
          <p className="font-semibold">Map not configured</p>
          <p className="text-muted mt-1 text-sm">Add <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to <code>admin-dashboard/.env.local</code> and restart <code>npm run dev</code>.</p>
        </div>
      </div>
    );
  }
  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <div className={cn("overflow-hidden rounded-2xl", className)}>
        <Map
          mapId={GOOGLE_MAP_ID}
          defaultCenter={center ?? { lat: 13.0827, lng: 80.2707 }}
          defaultZoom={zoom}
          gestureHandling="greedy"
          disableDefaultUI={false}
          streetViewControl={false}
          mapTypeControl={false}
          clickableIcons={false}
          onClick={(e) => { const ll = e.detail.latLng; if (ll && onClick) onClick({ lat: ll.lat, lng: ll.lng }); }}
          style={{ width: "100%", height: "100%" }}
        >
          {children}
        </Map>
      </div>
    </APIProvider>
  );
}

/** Draws a polyline imperatively (the library has no Polyline component). */
export function Polyline({ path, color = "#0C1322", weight = 4, opacity = 0.85, dashed }:
  { path: LatLng[]; color?: string; weight?: number; opacity?: number; dashed?: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!map || path.length < 2) return;
    const line = new google.maps.Polyline({
      path, map,
      clickable: false, // clicks fall through to the map (route editor: click to add a stop)
      strokeColor: color,
      strokeOpacity: dashed ? 0 : opacity,
      strokeWeight: weight,
      icons: dashed ? [{ icon: { path: "M 0,-1 0,1", strokeOpacity: opacity, scale: weight }, offset: "0", repeat: "14px" }] : undefined,
    });
    return () => line.setMap(null);
  }, [map, path, color, weight, opacity, dashed]);
  return null;
}

export function GeofenceCircle({ center, radius }: { center: LatLng; radius: number }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const c = new google.maps.Circle({ map, center, radius, strokeColor: "#F5B301", strokeWeight: 1, fillColor: "#F5B301", fillOpacity: 0.12, clickable: false });
    return () => c.setMap(null);
  }, [map, center.lat, center.lng, radius]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Fits the map to the given points once they change meaningfully. */
export function FitBounds({ points, padding = 60 }: { points: LatLng[]; padding?: number }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join("|");
  useEffect(() => {
    if (!map || !points.length) return;
    if (points.length === 1) { map.panTo(points[0]); map.setZoom(15); return; }
    const b = new google.maps.LatLngBounds();
    points.forEach((p) => b.extend(p));
    map.fitBounds(b, padding);
  }, [map, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function PanTo({ target, zoom }: { target: LatLng | null; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !target) return;
    map.panTo(target);
    if (zoom) map.setZoom(zoom);
  }, [map, target?.lat, target?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Glides from the previous position to the new one so the marker moves smoothly. */
export function useAnimatedPosition(target: LatLng | null, durationMs = 1200): LatLng | null {
  const [pos, setPos] = useState<LatLng | null>(target);
  const fromRef = useRef<LatLng | null>(target);
  useEffect(() => {
    if (!target) { setPos(null); return; }
    const from = fromRef.current ?? target;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const next = { lat: from.lat + (target.lat - from.lat) * e, lng: from.lng + (target.lng - from.lng) * e };
      fromRef.current = next;
      setPos(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target?.lat, target?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return pos;
}

const FRESH_COLOR = { LIVE: "#16a34a", DELAYED: "#d97706", OFFLINE: "#dc2626", IDLE: "#64748b" } as const;

export function BusMarker({ position, label, heading, freshness, selected, demo, onClick }: {
  position: LatLng; label: string; heading: number | null; freshness: keyof typeof FRESH_COLOR;
  selected?: boolean; demo?: boolean; onClick?: () => void;
}) {
  const pos = useAnimatedPosition(position);
  if (!pos) return null;
  const color = FRESH_COLOR[freshness];
  return (
    <AdvancedMarker position={pos} onClick={onClick} zIndex={selected ? 100 : 10}>
      <div className="flex flex-col items-center">
        <div className={cn("mb-1 rounded-lg px-2 py-0.5 text-[11px] font-bold text-white shadow", selected ? "bg-amber-brand !text-ink-950" : "bg-ink-900")}>
          {label}{demo ? " · DEMO" : ""}
        </div>
        <div className="relative grid h-9 w-9 place-items-center rounded-full border-[3px] border-white shadow-lg" style={{ background: color }}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" style={{ transform: `rotate(${heading ?? 0}deg)` }}>
            <path d="M12 3 19 20 12 16 5 20Z" fill="white" />
          </svg>
        </div>
      </div>
    </AdvancedMarker>
  );
}

export function StopMarker({ stop, highlight, onClick }: { stop: Stop; highlight?: boolean; onClick?: () => void }) {
  return (
    <AdvancedMarker position={{ lat: stop.latitude, lng: stop.longitude }} onClick={onClick} title={stop.stop_name} zIndex={highlight ? 5 : 1}>
      <div className="flex flex-col items-center">
        <div className={cn("grid h-6 w-6 place-items-center rounded-full border-2 border-white text-[10px] font-bold shadow",
          highlight ? "bg-amber-brand text-ink-950" : "bg-ink-700 text-white")}>
          {stop.stop_order}
        </div>
        <div className="mt-0.5 rounded bg-white/90 px-1.5 text-[10px] font-semibold text-ink-900 shadow-sm">{stop.stop_name}</div>
      </div>
    </AdvancedMarker>
  );
}

/** Small red dot, e.g. the point just clicked in the route editor. */
export function PinMarker({ position }: { position: LatLng }) {
  return (
    <AdvancedMarker position={position} zIndex={200}>
      <div className="h-4 w-4 rounded-full border-2 border-white bg-red-500 shadow" />
    </AdvancedMarker>
  );
}

/**
 * Green START pin: where the driver actually started the trip (first good GPS fix).
 * Also looks up the place name (Google Geocoding) and reports it with onAddress.
 */
export function StartMarker({ position, label = "START", onAddress }: { position: LatLng; label?: string; onAddress?: (address: string | null) => void }) {
  const geocoding = useMapsLibrary("geocoding");
  const [address, setAddress] = useState<string | null>(null);
  const key = `${position.lat.toFixed(4)},${position.lng.toFixed(4)}`;
  useEffect(() => {
    if (!geocoding) return;
    let cancelled = false;
    new geocoding.Geocoder()
      .geocode({ location: position })
      .then(({ results }: google.maps.GeocoderResponse) => {
        if (cancelled) return;
        // Prefer a short "area, city" name over a full street address.
        const area = results.find((r: google.maps.GeocoderResult) => r.types.some((t: string) => t === "sublocality" || t === "sublocality_level_1" || t === "locality"));
        const text = (area ?? results[0])?.formatted_address?.split(",").slice(0, 3).join(",").trim() ?? null;
        setAddress(text);
        onAddress?.(text);
      })
      .catch(() => { if (!cancelled) onAddress?.(null); }); // Geocoding API not enabled: just show the pin
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geocoding, key]);
  return (
    <AdvancedMarker position={position} zIndex={60} title={address ? `Trip started at ${address}` : "Trip started here"}>
      <div className="flex flex-col items-center">
        <div className="max-w-[180px] truncate rounded-md bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">{label}</div>
        <div className="mt-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-600 shadow" />
      </div>
    </AdvancedMarker>
  );
}

/**
 * Stops in the order the bus visits them. They are stored in TO_COLLEGE order, so a
 * FROM_COLLEGE trip gets them reversed and renumbered (1 = the college, where it starts).
 */
export function stopsForDirection(stops: Stop[] | undefined, direction: string | null | undefined): Stop[] {
  const ordered = [...(stops ?? [])].sort((a, b) => a.stop_order - b.stop_order);
  if (direction !== "FROM_COLLEGE") return ordered;
  return ordered.reverse().map((s, i) => ({ ...s, stop_order: i + 1 }));
}

export function routeLine(path: [number, number][] | null | undefined, stops: Stop[] | undefined): LatLng[] {
  if (path && path.length >= 2) return path.map(([lat, lng]) => ({ lat, lng }));
  return [...(stops ?? [])].sort((a, b) => a.stop_order - b.stop_order).map((s) => ({ lat: s.latitude, lng: s.longitude }));
}
