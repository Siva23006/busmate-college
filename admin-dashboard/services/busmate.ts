// Typed wrappers around the BusMate REST API.
import { api } from "@/lib/api";
import type { Alert, Bus, DashboardStats, Driver, Route, Stop, Student, Trip, User, Eta, TrackData } from "@/types";

type Body = Record<string, unknown>;
/** Result of rebuilding a route's road line (OSRM). ok=false: straight lines / unchanged, see message. */
export interface RoadRoute { ok: boolean; points: number; message: string }

export const authApi = {
  login: (identifier: string, password: string) =>
    api<{ token: string; user: User }>("/auth/login", { method: "POST", body: { identifier, password } }),
  me: () => api<{ user: User }>("/auth/me"),
};

export const dashboardApi = {
  stats: () => api<{ stats: DashboardStats }>("/dashboard/stats"),
};

export const busApi = {
  list: () => api<{ buses: Bus[] }>("/buses"),
  get: (id: number) => api<{ bus: Bus; route: Route | null }>(`/buses/${id}`),
  create: (body: Body) => api<{ bus: Bus }>("/buses", { method: "POST", body }),
  update: (id: number, body: Body) => api<{ bus: Bus }>(`/buses/${id}`, { method: "PUT", body }),
  remove: (id: number) => api<void>(`/buses/${id}`, { method: "DELETE" }),
  eta: (id: number) => api<{ eta: Eta | null }>(`/buses/${id}/eta`),
  track: (id: number, date?: string) => api<TrackData>(`/buses/${id}/track${date ? `?date=${date}` : ""}`),
};

export const routeApi = {
  list: () => api<{ routes: Route[] }>("/routes"),
  get: (id: number) => api<{ route: Route }>(`/routes/${id}`),
  create: (body: Body) => api<{ route: Route }>("/routes", { method: "POST", body }),
  update: (id: number, body: Body) => api<{ route: Route }>(`/routes/${id}`, { method: "PUT", body }),
  remove: (id: number) => api<void>(`/routes/${id}`, { method: "DELETE" }),
  reorder: (id: number, stopIds: number[]) => api<{ route: Route; roadRoute?: RoadRoute }>(`/routes/${id}/stops/order`, { method: "PUT", body: { stopIds } }),
  generatePath: (id: number) => api<{ route: Route; roadRoute: RoadRoute }>(`/routes/${id}/generate-path`, { method: "POST" }),
};

export const stopApi = {
  list: (routeId?: number) => api<{ stops: Stop[] }>(`/stops${routeId ? `?routeId=${routeId}` : ""}`),
  create: (body: Body) => api<{ stop: Stop; roadRoute?: RoadRoute }>("/stops", { method: "POST", body }),
  update: (id: number, body: Body) => api<{ stop: Stop; roadRoute?: RoadRoute }>(`/stops/${id}`, { method: "PUT", body }),
  remove: (id: number) => api<void>(`/stops/${id}`, { method: "DELETE" }),
};

export const driverApi = {
  list: () => api<{ drivers: Driver[] }>("/drivers"),
  create: (body: Body) => api<{ driver: Driver }>("/drivers", { method: "POST", body }),
  update: (id: number, body: Body) => api<{ driver: Driver }>(`/drivers/${id}`, { method: "PUT", body }),
};

export const studentApi = {
  list: (q: { search?: string; department?: string; year?: string; routeId?: string } = {}) => {
    const params = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]);
    return api<{ students: Student[] }>(`/students${params.toString() ? `?${params}` : ""}`);
  },
  create: (body: Body) => api<{ student: Student }>("/students", { method: "POST", body }),
  update: (id: number, body: Body) => api<{ student: Student }>(`/students/${id}`, { method: "PUT", body }),
  remove: (id: number) => api<void>(`/students/${id}`, { method: "DELETE" }),
};

export interface TripPoint { latitude: number; longitude: number; accuracy: number | null; speed: number | null; timestamp: string; is_reliable: boolean }
export interface StopEvent { stop_id: number; stop_name: string; stop_order: number; arrived_at: string | null; departed_at: string | null }

export const tripApi = {
  list: (q: { status?: string; busId?: string; date?: string; limit?: number } = {}) => {
    const params = new URLSearchParams(Object.entries(q).filter(([, v]) => v).map(([k, v]) => [k, String(v)]));
    return api<{ trips: Trip[] }>(`/trips${params.toString() ? `?${params}` : ""}`);
  },
  get: (id: number) => api<{ trip: Trip; stopEvents: StopEvent[] }>(`/trips/${id}`),
  path: (id: number) => api<{ points: TripPoint[]; isSimulation: boolean }>(`/trips/${id}/path`),
  end: (tripId: number) => api<{ trip: Trip }>("/trips/end", { method: "POST", body: { tripId } }),
};

export const alertApi = {
  list: (resolved = false) => api<{ alerts: Alert[] }>(`/alerts?resolved=${resolved}`),
  resolve: (id: number) => api<{ alert: Alert }>(`/alerts/${id}/resolve`, { method: "PATCH" }),
};
