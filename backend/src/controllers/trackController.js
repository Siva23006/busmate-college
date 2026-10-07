// Admin "Track Bus": one bus, one day. Live position + current trip + every trip of the day
// (morning run to college, evening return) with start/end place, times and stop-by-stop arrivals.
const AppError = require('../utils/AppError');
const { haversine } = require('../utils/geo');
const busModel = require('../models/busModel');
const routeModel = require('../models/routeModel');
const tripModel = require('../models/tripModel');
const trackingService = require('../services/trackingService');

const TIME_ZONE = process.env.APP_TIME_ZONE || 'Asia/Kolkata';
const NEAR_STOP_M = 600;

function todayLocal() {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date());
}

function minutesOfDay(date) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(new Date(date));
  const h = Number(parts.find((p) => p.type === 'hour').value) % 24;
  const m = Number(parts.find((p) => p.type === 'minute').value);
  return h * 60 + m;
}

function scheduleMinutes(time) {
  if (!time) return null;
  const [h, m] = String(time).split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

/** "Near DEMO Redhills" or null. */
function placeLabel(lat, lng, stops) {
  if (lat == null || lng == null) return null;
  let best = null;
  for (const s of stops) {
    const d = haversine({ lat, lng }, { lat: Number(s.latitude), lng: Number(s.longitude) });
    if (!best || d < best.d) best = { d, name: s.stop_name };
  }
  if (!best) return null;
  return best.d <= 150 ? `At ${best.name}` : best.d <= NEAR_STOP_M ? `Near ${best.name}` : null;
}

async function track(req, res) {
  const busId = req.valid.params.id;
  const date = req.valid.query.date || todayLocal();
  const bus = await busModel.findById(busId);
  if (!bus) throw AppError.notFound('Bus');
  const route = bus.route_id ? await routeModel.findById(bus.route_id) : null;
  const stops = route ? route.stops : [];
  const stopById = new Map(stops.map((s) => [String(s.id), s]));

  const trips = await tripModel.listForBusDay(busId, date);
  const detailed = await Promise.all(trips.map(async (t) => {
    const events = await tripModel.stopEvents(t.id, t.direction);
    const stopEvents = events.map((e) => {
      const stop = stopById.get(String(e.stop_id));
      const scheduled = t.direction === 'TO_COLLEGE' && stop ? stop.estimated_time : null;
      const sched = scheduleMinutes(scheduled);
      const delayMinutes = sched != null && e.arrived_at ? minutesOfDay(e.arrived_at) - sched : null;
      return {
        stopId: e.stop_id, stopName: e.stop_name, order: e.stop_order,
        arrivedAt: e.arrived_at, departedAt: e.departed_at,
        scheduledTime: scheduled ? String(scheduled).slice(0, 5) : null, delayMinutes,
      };
    });
    return {
      id: t.id, status: t.status, direction: t.direction, isSimulation: t.is_simulation,
      driverName: t.driver_name, routeName: t.route_name,
      startTime: t.start_time, endTime: t.end_time,
      durationSeconds: t.duration_seconds, distanceMeters: t.distance_meters,
      stopsReached: t.stops_reached, stopsTotal: t.stops_total,
      start: t.start_latitude == null ? null : {
        latitude: t.start_latitude, longitude: t.start_longitude, label: placeLabel(t.start_latitude, t.start_longitude, stops),
      },
      end: t.end_latitude == null ? null : {
        latitude: t.end_latitude, longitude: t.end_longitude, label: placeLabel(t.end_latitude, t.end_longitude, stops),
      },
      stopEvents,
    };
  }));

  const real = detailed.filter((t) => !t.isSimulation);
  const firstOf = (dir) => (real.find((t) => t.direction === dir) || detailed.find((t) => t.direction === dir)) || null;
  const morning = firstOf('TO_COLLEGE');
  const evening = firstOf('FROM_COLLEGE');

  const active = bus.active_trip_id ? detailed.find((t) => t.id === bus.active_trip_id)
    || (await tripModel.findById(bus.active_trip_id)) : null;

  res.json({
    date,
    timeZone: TIME_ZONE,
    bus,
    route,
    live: bus.latitude == null ? null : {
      latitude: bus.latitude, longitude: bus.longitude, speed: bus.speed, heading: bus.heading,
      accuracy: bus.accuracy, timestamp: bus.location_time, isSimulation: bus.location_is_simulation,
      label: placeLabel(bus.latitude, bus.longitude, stops),
    },
    activeTripId: bus.active_trip_id || null,
    activeTrip: active && active.id ? active : null,
    eta: bus.active_trip_id ? trackingService.getLatestEta(bus.id) : null,
    summary: {
      morningStart: morning && morning.startTime, morningEnd: morning && morning.endTime,
      returnStart: evening && evening.startTime, returnEnd: evening && evening.endTime,
      tripCount: detailed.length,
      distanceMeters: detailed.reduce((s, t) => s + (Number(t.distanceMeters) || 0), 0),
    },
    trips: detailed,
    days: await tripModel.daysForBus(busId),
  });
}

module.exports = { track, todayLocal, placeLabel };
