export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString();
}

export function clock(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export function duration(seconds: number | null | undefined): string {
  if (seconds == null) return "-";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

export function km(meters: number | null | undefined): string {
  if (meters == null) return "-";
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

export function kmh(mps: number | null | undefined): string {
  if (mps == null) return "-";
  return `${Math.round(mps * 3.6)} km/h`;
}

/** "To College" / "From College" for a trip direction. */
export function directionLabel(direction: string | null | undefined): string {
  return direction === "FROM_COLLEGE" ? "From College" : "To College";
}

/**
 * Real place names for a trip. The admin sets each route's home area (start_location, e.g. Redhills)
 * and college (destination). Morning: home -> college. Evening: college -> home.
 */
export function tripEnds(direction: string | null | undefined, home?: string | null, college?: string | null) {
  const h = home?.trim() || "Home area";
  const c = college?.trim() || "College";
  return direction === "FROM_COLLEGE" ? { from: c, to: h } : { from: h, to: c };
}

/** "Morning · Redhills → Dr. MGR University" */
export function tripTitle(direction: string | null | undefined, home?: string | null, college?: string | null): string {
  const { from, to } = tripEnds(direction, home, college);
  return `${direction === "FROM_COLLEGE" ? "Evening" : "Morning"} · ${from} → ${to}`;
}

/** "07:30:00" -> "7:30 AM" */
export function timeOfDay(t: string | null | undefined): string {
  if (!t) return "-";
  const [hh, mm] = t.split(":").map(Number);
  if (Number.isNaN(hh)) return t;
  const am = hh < 12;
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm ?? 0).padStart(2, "0")} ${am ? "AM" : "PM"}`;
}

export function etaMinutes(seconds: number | null | undefined): string {
  if (seconds == null) return "-";
  const m = Math.round(seconds / 60);
  return m < 1 ? "< 1 min" : `${m} min`;
}

const ALERT_TITLES: Record<string, string> = {
  GPS_POOR: "Poor GPS accuracy", BUS_OFFLINE: "Bus offline", OVERSPEED: "Overspeed", ROUTE_DEVIATION: "Off route", SOS: "SOS / emergency",
};
/** Plain-language alert title: "BUS_OFFLINE" -> "Bus offline". */
export function alertTitle(type: string): string {
  return ALERT_TITLES[type] ?? type.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

/** Today's date as YYYY-MM-DD in the browser's time zone. */
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Today" / "Yesterday" / "Mon, 6 Oct 2026" for grouping lists by day. */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (localDate(d) === localDate(today)) return "Today";
  if (localDate(d) === localDate(y)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
