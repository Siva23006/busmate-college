// Handles every GPS point from a driver (REST or Socket.IO), following spec section 30:
// validate user -> validate trip -> validate coords -> check accuracy -> store latest ->
// store history -> ETA -> geofence -> broadcast -> notifications.
const db = require('../config/db');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { accuracyLevel } = require('../utils/geo');
const locationModel = require('../models/locationModel');
const tripState = require('./tripState');
const geometryCache = require('./routeGeometryCache');
const { computeEta } = require('./etaEngine');
const { evaluateGeofence } = require('./geofenceEngine');
const realtime = require('./realtime');
const alertService = require('./alertService');
const notificationService = require('./notificationService');

const latestEta = new Map(); // busId -> last computed ETA (served by GET /api/buses/:id/eta)

function parseTimestamp(ts) {
  const now = Date.now();
  let t = typeof ts === 'number' ? ts : ts ? Date.parse(ts) : NaN;
  // Phone clocks can be wrong; fall back to server time if it is missing or far off.
  if (!Number.isFinite(t) || t > now + 60_000 || t < now - 2 * 3600_000) t = now;
  return new Date(t);
}

const notifyQuietly = (recipients, msg) =>
  notificationService.notify(recipients, msg).catch((e) => console.warn('[notify]', e.message));

async function markStopEvent(tripId, stopId, column) {
  await db.query(
    `INSERT INTO trip_stop_events (trip_id, stop_id, ${column}) VALUES ($1, $2, now())
     ON CONFLICT (trip_id, stop_id) DO UPDATE SET ${column} = COALESCE(trip_stop_events.${column}, now())`,
    [tripId, stopId],
  );
}

/**
 * @param user     { id, role } from JWT
 * @param payload  validated location payload
 */
async function processLocation(user, payload) {
  // 1-2. Validate user and active trip
  const state = await tripState.load(payload.tripId);
  if (!state) throw AppError.badRequest('No active trip. Start a trip first.');
  const { trip } = state;
  if (String(trip.bus_id) !== String(payload.busId)) throw AppError.badRequest('Bus does not match this trip.');
  if (state.driverUserId !== String(user.id)) throw AppError.forbidden('This is not your trip.');

  // 3-4. Coordinates were validated by zod; classify accuracy
  const level = accuracyLevel(payload.accuracy, env.GPS_POOR_ACCURACY_M);
  const reliable = level !== 'POOR';
  const timestamp = parseTimestamp(payload.timestamp);
  const loc = {
    busId: trip.bus_id, tripId: trip.id,
    latitude: payload.latitude, longitude: payload.longitude,
    accuracy: payload.accuracy ?? null, speed: payload.speed ?? null, heading: payload.heading ?? null,
    timestamp, isSimulation: trip.is_simulation,
  };

  // 6. History (every point, flagged if unreliable). 5 (live) only for reliable, in-order points.
  await locationModel.insertHistory(loc, reliable);
  const outOfOrder = timestamp.getTime() < state.lastTimestamp;

  if (state.offline) {
    state.offline = false;
    await db.query(`UPDATE buses SET status = 'ACTIVE' WHERE id = $1 AND status = 'OFFLINE'`, [trip.bus_id]);
    realtime.toBusAndAdmins(trip.bus_id, 'bus:status', { busId: Number(trip.bus_id), status: 'ACTIVE', reason: 'BACK_ONLINE', at: new Date().toISOString() });
  }

  if (!reliable) {
    alertService.raise({
      busId: trip.bus_id, tripId: trip.id, type: 'GPS_POOR', severity: 'WARNING',
      message: `${trip.bus_number}: poor GPS accuracy (±${Math.round(loc.accuracy)} m).`,
    }).catch(() => {});
    // Preserve the last reliable location; tell clients GPS is weak.
    realtime.toBusAndAdmins(trip.bus_id, 'bus:status', {
      busId: Number(trip.bus_id), status: 'GPS_POOR', accuracy: loc.accuracy,
      lastReliable: state.lastReliable, at: new Date().toISOString(),
    });
    return { accepted: true, reliable: false, accuracyLevel: level };
  }
  if (outOfOrder) return { accepted: true, reliable: true, stale: true, accuracyLevel: level };

  state.lastTimestamp = timestamp.getTime();
  await locationModel.upsertLive(loc);
  if (!state.start) {
    // First reliable fix of the trip = where the driver started.
    state.start = { latitude: loc.latitude, longitude: loc.longitude };
    db.query(
      'UPDATE trips SET start_latitude = $2, start_longitude = $3 WHERE id = $1 AND start_latitude IS NULL',
      [trip.id, loc.latitude, loc.longitude],
    ).catch((e) => console.warn('[tracking] start location:', e.message));
  }

  const position = { lat: loc.latitude, lng: loc.longitude };
  const direction = trip.direction || 'TO_COLLEGE';
  // Stops and road line in travel order: reversed for a FROM_COLLEGE trip.
  const geometry = await geometryCache.get(trip.route_id, direction);
  let eta = null;
  let stopEvent = null;
  const recipients = trip.is_simulation ? [] : await tripState.students(state); // DEMO trips never notify students

  if (geometry) {
    // 8. Geofence
    const fence = evaluateGeofence(geometry.stops, position, state.insideStopId);
    state.insideStopId = fence.insideStopId;
    const lastStop = geometry.stops[geometry.stops.length - 1];
    // The college is the route's last stored stop: where a FROM_COLLEGE trip begins.
    const collegeStop = direction === 'FROM_COLLEGE' ? geometry.stops[0] : lastStop;
    if (fence.exited) {
      await markStopEvent(trip.id, fence.exited.id, 'departed_at');
      stopEvent = { status: 'DEPARTED', stop: fence.exited };
    }
    if (fence.entered) {
      state.visitedStopIds.add(String(fence.entered.id));
      await markStopEvent(trip.id, fence.entered.id, 'arrived_at');
      stopEvent = { status: 'AT_STOP', stop: fence.entered };
      const enteredId = String(fence.entered.id);
      if (enteredId === String(lastStop.id) && geometry.stops.length > 1) {
        // End of the run: the college in the morning, the last stop in the evening.
        notifyQuietly(recipients, direction === 'FROM_COLLEGE'
          ? { title: `${trip.bus_number} finished`, message: `Bus has reached the last stop (${fence.entered.stop_name}).`, type: 'REACHED_LAST_STOP', data: { busId: trip.bus_id, stopId: fence.entered.id } }
          : { title: `${trip.bus_number} arrived`, message: 'Bus has reached the college.', type: 'REACHED_COLLEGE', data: { busId: trip.bus_id } });
      } else if (enteredId !== String(collegeStop.id)) {
        // (An evening bus waiting at the college sends nothing here: "Bus has left the college" goes out at trip start.)
        const atStop = recipients.filter((r) => String(r.assigned_stop_id) === String(fence.entered.id));
        notifyQuietly(atStop, { title: `${trip.bus_number} is here`, message: `Bus has reached your stop (${fence.entered.stop_name}).`, type: 'REACHED_STOP', data: { busId: trip.bus_id, stopId: fence.entered.id } });
      }
    }

    // 7. ETA
    const speedMps = await locationModel.recentAverageSpeed(trip.id);
    eta = computeEta(geometry, position, {
      speedMps,
      lastAlong: state.lastAlong,
      visitedStopIds: state.visitedStopIds,
      defaultSpeedKmh: env.ETA_DEFAULT_SPEED_KMH,
      dwellSeconds: env.ETA_STOP_DWELL_SECONDS,
    });
    eta.direction = direction;
    state.lastAlong = eta.along;
    latestEta.set(String(trip.bus_id), eta);

    // Route deviation
    if (eta.offRouteMeters > env.ROUTE_DEVIATION_M && geometry.poly.points.length >= 2) {
      alertService.raise({
        busId: trip.bus_id, tripId: trip.id, type: 'ROUTE_DEVIATION', severity: 'WARNING',
        message: `${trip.bus_number}: route deviation detected (${eta.offRouteMeters} m off route).`,
      }).catch(() => {});
    }

    // 10. Approaching notifications (once per stop per trip)
    for (const s of eta.stops) {
      if (s.passed) continue;
      const waiting = recipients.filter((r) => String(r.assigned_stop_id) === String(s.stopId));
      if (!waiting.length) continue;
      // "Bus is coming" alert: each student picks how many minutes before (default 10).
      // A key per (stop, minutes) so a 15-min student and a 5-min student both get theirs once.
      // `approach:<stop>` (loaded after a server restart) means this stop was already alerted.
      const due = new Map();
      for (const r of waiting) {
        const minutes = Number(r.alert_minutes) || env.APPROACHING_MINUTES;
        const key = `approach:${s.stopId}:${minutes}`;
        if (s.etaSeconds > minutes * 60 || state.notified.has(key) || state.notified.has(`approach:${s.stopId}`)) continue;
        if (!due.has(key)) due.set(key, []);
        due.get(key).push(r);
      }
      for (const [key, group] of due) {
        state.notified.add(key);
        const mins = Math.max(1, Math.round(s.etaSeconds / 60));
        notifyQuietly(group, {
          title: `🚌 ${trip.bus_number} arriving in ~${mins} min`,
          message: `Get ready at ${s.stopName}. Your bus is about ${mins} min away.`,
          type: 'APPROACHING',
          data: { busId: trip.bus_id, stopId: s.stopId },
        });
      }
      if (due.size) await markStopEvent(trip.id, s.stopId, 'approaching_notified_at');
      if (s.remainingMeters <= 1000 && !state.notified.has(`near:${s.stopId}`)) {
        state.notified.add(`near:${s.stopId}`);
        await markStopEvent(trip.id, s.stopId, 'near_1km_notified_at');
        notifyQuietly(waiting, { title: `${trip.bus_number} is close`, message: `Your bus is about 1 km from ${s.stopName}.`, type: 'NEAR_1KM', data: { busId: trip.bus_id, stopId: s.stopId } });
      }
    }
  }

  // Overspeed
  const speedKmh = loc.speed != null ? loc.speed * 3.6 : null;
  if (speedKmh != null && speedKmh > env.OVERSPEED_KMH) {
    alertService.raise({
      busId: trip.bus_id, tripId: trip.id, type: 'OVERSPEED', severity: 'CRITICAL',
      message: `${trip.bus_number}: overspeed ${Math.round(speedKmh)} km/h (limit ${env.OVERSPEED_KMH}).`,
    }).catch(() => {});
  }

  state.lastReliable = { latitude: loc.latitude, longitude: loc.longitude, timestamp: timestamp.toISOString() };

  // 9. Broadcast
  const message = {
    busId: Number(trip.bus_id),
    busNumber: trip.bus_number,
    tripId: Number(trip.id),
    routeId: trip.route_id ? Number(trip.route_id) : null,
    direction,
    latitude: loc.latitude,
    longitude: loc.longitude,
    accuracy: loc.accuracy,
    accuracyLevel: level,
    speed: loc.speed,
    speedKmh: speedKmh != null ? Math.round(speedKmh) : null,
    heading: loc.heading,
    timestamp: timestamp.toISOString(),
    isSimulation: trip.is_simulation, // clients must show "DEMO / SIMULATION" when true
    atStopId: state.insideStopId ? Number(state.insideStopId) : null,
    start: state.start, // where this trip started: shown as the START pin on every map
    eta,
  };
  realtime.toBusAndAdmins(trip.bus_id, 'bus:location', message);
  if (stopEvent) {
    realtime.toBusAndAdmins(trip.bus_id, 'bus:status', {
      busId: Number(trip.bus_id), status: stopEvent.status,
      stopId: Number(stopEvent.stop.id), stopName: stopEvent.stop.stop_name, at: new Date().toISOString(),
    });
  }

  return {
    accepted: true, reliable: true, accuracyLevel: level,
    // Small ETA summary for the driver app's trip screen.
    eta: eta && {
      nextStop: eta.nextStop,
      destination: eta.destination,
      stopsPassed: eta.stops.filter((x) => x.passed).length,
      stopsTotal: eta.stops.length,
    },
  };
}

function getLatestEta(busId) {
  return latestEta.get(String(busId)) || null;
}

module.exports = { processLocation, getLatestEta };
