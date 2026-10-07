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

export function etaMinutes(seconds: number | null | undefined): string {
  if (seconds == null) return "-";
  const m = Math.round(seconds / 60);
  return m < 1 ? "< 1 min" : `${m} min`;
}
