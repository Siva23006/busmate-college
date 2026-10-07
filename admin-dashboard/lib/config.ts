export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");
export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
/** Markers need a Map ID. "DEMO_MAP_ID" is Google's built-in one for development. */
export const GOOGLE_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || "DEMO_MAP_ID";

/** A bus with no update for this long is shown as Delayed (yellow), then Offline (red). */
export const DELAYED_AFTER_MS = 20_000;
export const OFFLINE_AFTER_MS = 60_000;
