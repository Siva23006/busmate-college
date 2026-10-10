export type Role = "ADMIN" | "DRIVER" | "STUDENT";
export type BusStatus = "ACTIVE" | "INACTIVE" | "MAINTENANCE" | "OFFLINE";
export type TripStatus = "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
export type Severity = "INFO" | "WARNING" | "CRITICAL";
/** Morning run to the college, or evening run back. Stops are stored in TO_COLLEGE order. */
export type TripDirection = "TO_COLLEGE" | "FROM_COLLEGE";
export type AccuracyLevel = "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "UNKNOWN";

export interface User {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  created_at?: string;
}

export interface Bus {
  id: number;
  bus_number: string;
  registration_number: string | null;
  capacity: number | null;
  status: BusStatus;
  driver_id: number | null;
  route_id: number | null;
  is_demo: boolean;
  driver_name: string | null;
  driver_phone: string | null;
  route_name: string | null;
  active_trip_id: number | null;
  active_trip_start: string | null;
  active_trip_is_simulation: boolean | null;
  active_trip_direction: TripDirection | null;
  trip_start_latitude?: number | null;
  trip_start_longitude?: number | null;
  route_start?: string | null;
  route_destination?: string | null;
  route_morning_time?: string | null;
  route_evening_time?: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  location_time: string | null;
  location_is_simulation: boolean | null;
}

export interface Stop {
  id: number;
  route_id: number;
  stop_name: string;
  latitude: number;
  longitude: number;
  stop_order: number;
  geofence_radius: number;
  estimated_time: string | null;
}

export interface Route {
  id: number;
  route_name: string;
  description: string | null;
  start_location: string | null;
  destination: string | null;
  path: [number, number][] | null;
  active: boolean;
  is_demo: boolean;
  /** Morning run leaves the home area at this time ("HH:MM:SS"). */
  morning_time?: string | null;
  /** Evening run leaves the college at this time. */
  evening_time?: string | null;
  stop_count?: number;
  buses?: { id: number; bus_number: string }[] | null;
  stops?: Stop[];
}

export interface Driver {
  id: number;
  user_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  employee_id: string;
  license_number: string | null;
  status: "ACTIVE" | "INACTIVE";
  is_active: boolean;
  bus_id: number | null;
  bus_number: string | null;
  active_trip_id: number | null;
}

export interface Student {
  id: number;
  user_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  student_id: string;
  department: string | null;
  year: number | null;
  assigned_route_id: number | null;
  assigned_stop_id: number | null;
  assigned_bus_id: number | null;
  route_name: string | null;
  assigned_stop_name: string | null;
  bus_id: number | null;
  bus_number: string | null;
}

export interface Trip {
  id: number;
  bus_id: number;
  bus_number: string;
  driver_id: number | null;
  driver_name: string | null;
  route_id: number | null;
  route_name: string | null;
  trip_date: string;
  start_time: string | null;
  end_time: string | null;
  status: TripStatus;
  distance_meters: number | null;
  duration_seconds: number | null;
  is_simulation: boolean;
  direction: TripDirection;
  route_start?: string | null;
  route_destination?: string | null;
  start_latitude?: number | null;
  start_longitude?: number | null;
  stops_reached?: number;
  stops_total?: number;
}

export interface Alert {
  id: number;
  bus_id: number | null;
  bus_number: string | null;
  trip_id: number | null;
  type: string;
  severity: Severity;
  message: string;
  resolved: boolean;
  created_at: string;
}

export interface EtaStop {
  stopId: number;
  stopName: string;
  stopOrder: number;
  passed: boolean;
  remainingMeters?: number;
  etaSeconds?: number;
  expectedAt?: string;
}

export interface Eta {
  label: string;
  direction?: TripDirection;
  nextStop: EtaStop | null;
  destination: EtaStop | null;
  stops: EtaStop[];
  offRouteMeters: number;
  computedAt: string;
}

/** Payload of the "bus:location" socket event. */
export interface LiveLocation {
  busId: number;
  busNumber: string;
  tripId: number;
  routeId: number | null;
  direction?: TripDirection;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  accuracyLevel: AccuracyLevel;
  speed: number | null;
  speedKmh: number | null;
  heading: number | null;
  timestamp: string;
  isSimulation: boolean;
  atStopId: number | null;
  /** Where this trip started (first good GPS fix). */
  start?: { latitude: number; longitude: number } | null;
  eta: Eta | null;
}

export interface BusStatusEvent {
  busId: number;
  status: string; // ACTIVE | INACTIVE | OFFLINE | GPS_POOR | AT_STOP | DEPARTED
  stopId?: number;
  stopName?: string;
  at: string;
}

export interface DashboardStats {
  total_buses: number;
  active_buses: number;
  offline_buses: number;
  todays_trips: number;
  active_trips: number;
  total_students: number;
  active_drivers: number;
  open_alerts: number;
}

/** GET /api/buses/:id/track — one bus, one day. */
export interface TrackPlace { latitude: number; longitude: number; label: string | null }
export interface TrackStopEvent {
  stopId: number; stopName: string; order: number;
  arrivedAt: string | null; departedAt: string | null;
  scheduledTime: string | null; delayMinutes: number | null;
}
export interface TrackTrip {
  id: number; status: TripStatus; direction: TripDirection; isSimulation: boolean;
  driverName: string | null; routeName: string | null;
  startTime: string | null; endTime: string | null;
  durationSeconds: number | null; distanceMeters: number | null;
  stopsReached: number; stopsTotal: number;
  start: TrackPlace | null; end: TrackPlace | null;
  stopEvents: TrackStopEvent[];
}
export interface TrackData {
  date: string;
  timeZone: string;
  bus: Bus;
  route: Route | null;
  live: (TrackPlace & { speed: number | null; heading: number | null; accuracy: number | null; timestamp: string | null; isSimulation: boolean | null }) | null;
  activeTripId: number | null;
  activeTrip: TrackTrip | null;
  eta: Eta | null;
  summary: {
    morningStart: string | null; morningEnd: string | null;
    returnStart: string | null; returnEnd: string | null;
    tripCount: number; distanceMeters: number;
  };
  trips: TrackTrip[];
  days: { trip_date: string; trips: number }[];
}

/** A status message a driver sent for the running trip (GET /buses/:id/messages). */
export type DriverMessageKind = "TRAFFIC" | "BREAKDOWN" | "LATE" | "OTHER";
export interface DriverMessage {
  id?: number;
  kind: DriverMessageKind;
  minutes: number | null;
  message: string;
  created_at: string;
}

/** Payload of the "bus:message" socket event. */
export interface BusMessageEvent {
  busId: number;
  tripId: number;
  kind: DriverMessageKind;
  minutes: number | null;
  text: string;
  at: string;
}

/** Payload of the "admin:sos" socket event. */
export interface SosEvent {
  busId: number;
  busNumber: string;
  driverName: string;
  driverPhone: string | null;
  note: string | null;
  latitude: number | null;
  longitude: number | null;
  mapLink: string | null;
  at: string;
  alertId: number | null;
}

/** POST /students/bulk */
export interface BulkStudentInput {
  name: string;
  student_id: string;
  password: string;
  email?: string;
  phone?: string;
  department?: string;
  year?: number;
  bus_number?: string;
  stop_name?: string;
}
export interface BulkStudentResult {
  added: number;
  failed: number;
  results: { row: number; studentId: string; ok: boolean; error?: string }[];
}

/** GET /reports/monthly?month=YYYY-MM */
export interface MonthlyReportTotals {
  trips: number; completed: number; distance_km: number; late_starts: number;
  overspeed: number; offline: number; off_route: number; emergencies: number; delay_messages: number;
  on_time_pct: number | null;
}
export interface MonthlyReportBus {
  bus_id: number; bus_number: string;
  trips: number; completed: number; morning_trips: number; evening_trips: number;
  distance_km: number; avg_minutes: number | null; scheduled: number; late_starts: number; on_time_pct: number | null;
  overspeed: number; offline: number; off_route: number; emergencies: number; delay_messages: number;
}
export interface MonthlyReport {
  month: string;
  timeZone: string;
  lateAfterMinutes: number;
  totals: MonthlyReportTotals;
  buses: MonthlyReportBus[];
}
