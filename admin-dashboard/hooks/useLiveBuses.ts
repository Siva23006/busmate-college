"use client";
// Keeps a live map of all buses: initial state from REST, then updates from Socket.IO.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { API_URL, DELAYED_AFTER_MS, OFFLINE_AFTER_MS } from "@/lib/config";
import { tokenStore } from "@/lib/api";
import { busApi } from "@/services/busmate";
import type { Alert, Bus, BusStatusEvent, Eta, LiveLocation } from "@/types";

export type Connection = "connecting" | "online" | "offline";
export type Freshness = "LIVE" | "DELAYED" | "OFFLINE" | "IDLE";

export interface LiveBus extends Bus {
  live: LiveLocation | null;
  eta: Eta | null;
  lastEvent: BusStatusEvent | null;
  freshness: Freshness;
  isMoving: boolean;
}

function freshnessOf(bus: Bus, live: LiveLocation | null, now: number): Freshness {
  if (!bus.active_trip_id) return "IDLE";
  if (bus.status === "OFFLINE") return "OFFLINE";
  const ts = live?.timestamp ?? bus.location_time;
  if (!ts) return "DELAYED";
  const age = now - new Date(ts).getTime();
  if (age > OFFLINE_AFTER_MS) return "OFFLINE";
  if (age > DELAYED_AFTER_MS) return "DELAYED";
  return "LIVE";
}

export function useLiveBuses(onAlert?: (a: Alert) => void) {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [live, setLive] = useState<Record<number, LiveLocation>>({});
  const [events, setEvents] = useState<Record<number, BusStatusEvent>>({});
  const [connection, setConnection] = useState<Connection>("connecting");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const onAlertRef = useRef(onAlert);
  onAlertRef.current = onAlert;

  const refresh = useCallback(async () => {
    try {
      const { buses } = await busApi.list();
      setBuses(buses);
      setError(null);
    } catch {
      setError("Could not load buses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const token = tokenStore.get();
    const socket: Socket = io(API_URL, { auth: { token }, transports: ["websocket", "polling"], reconnectionDelayMax: 5000 });
    socket.on("connect", () => { setConnection("online"); refresh(); });
    socket.on("disconnect", () => setConnection("offline"));
    socket.on("connect_error", () => setConnection("offline"));
    socket.on("bus:location", (loc: LiveLocation) => setLive((prev) => ({ ...prev, [loc.busId]: loc })));
    socket.on("bus:status", (ev: BusStatusEvent) => {
      setEvents((prev) => ({ ...prev, [ev.busId]: ev }));
      if (["ACTIVE", "INACTIVE", "OFFLINE"].includes(ev.status)) {
        setBuses((prev) => prev.map((b) => (b.id === ev.busId ? { ...b, status: ev.status as Bus["status"] } : b)));
      }
    });
    socket.on("trip:started", refresh);
    socket.on("trip:completed", (ev: { busId: number }) => {
      setLive((prev) => { const next = { ...prev }; delete next[ev.busId]; return next; });
      refresh();
    });
    socket.on("bus:updated", refresh);
    socket.on("admin:alert", (a: Alert) => onAlertRef.current?.(a));
    const tick = setInterval(() => setNow(Date.now()), 5000);
    return () => { clearInterval(tick); socket.close(); };
  }, [refresh]);

  const merged: LiveBus[] = useMemo(() => buses.map((b) => {
    const l = live[b.id] && b.active_trip_id && live[b.id].tripId === b.active_trip_id ? live[b.id] : null;
    const speedKmh = l?.speedKmh ?? (b.speed != null ? b.speed * 3.6 : null);
    return {
      ...b,
      latitude: l?.latitude ?? b.latitude,
      longitude: l?.longitude ?? b.longitude,
      accuracy: l?.accuracy ?? b.accuracy,
      speed: l?.speed ?? b.speed,
      heading: l?.heading ?? b.heading,
      location_time: l?.timestamp ?? b.location_time,
      live: l,
      eta: l?.eta ?? null,
      lastEvent: events[b.id] ?? null,
      freshness: freshnessOf(b, l, now),
      isMoving: speedKmh != null && speedKmh >= 5,
    };
  }), [buses, live, events, now]);

  return { buses: merged, connection, loading, error, refresh };
}
