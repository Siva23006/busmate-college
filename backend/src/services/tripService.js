const db = require('../config/db');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { haversine } = require('../utils/geo');
const busModel = require('../models/busModel');
const driverModel = require('../models/driverModel');
const tripModel = require('../models/tripModel');
const studentModel = require('../models/studentModel');
const realtime = require('./realtime');
const notificationService = require('./notificationService');
const tripState = require('./tripState');

async function driverForUser(user) {
  const driver = await driverModel.findByUserId(user.id);
  if (!driver) throw AppError.forbidden('This account is not linked to a driver profile.');
  if (driver.status !== 'ACTIVE' || !driver.is_active) throw AppError.forbidden('Your driver account is disabled. Contact the transport office.');
  return driver;
}

/**
 * Driver starts a trip on a bus assigned to them.
 * isSimulation: only allowed when ALLOW_SIMULATION=true; such trips are labeled DEMO / SIMULATION everywhere.
 * direction: TO_COLLEGE (morning, stops in stored order) or FROM_COLLEGE (evening, stops reversed).
 */
async function startTrip(user, busId, { isSimulation = false, direction = 'TO_COLLEGE' } = {}) {
  if (isSimulation && !env.allowSimulation) throw AppError.forbidden('Simulation mode is disabled on this server.');
  const driver = await driverForUser(user);
  const bus = await busModel.findById(busId);
  if (!bus) throw AppError.notFound('Bus');
  if (String(bus.driver_id) !== String(driver.id)) throw AppError.forbidden('This bus is not assigned to you.');
  if (bus.status === 'MAINTENANCE') throw AppError.badRequest('This bus is marked as under maintenance.');
  if (!bus.route_id) throw AppError.badRequest('This bus has no route assigned. Contact the transport office.');

  const existing = await tripModel.findActiveByBus(busId);
  if (existing) {
    // Same driver re-opening the app: resume the trip instead of failing.
    if (String(existing.driver_id) === String(driver.id)) return { trip: existing, resumed: true };
    throw AppError.conflict('This bus already has an active trip.');
  }

  const tripId = await db.withTransaction(async (client) => {
    const id = await tripModel.createActive({ busId, driverId: driver.id, routeId: bus.route_id, isSimulation, direction }, client);
    await client.query(`UPDATE buses SET status = 'ACTIVE' WHERE id = $1`, [busId]);
    return id;
  });
  const trip = await tripModel.findById(tripId);

  const event = { tripId, busId: Number(busId), busNumber: bus.bus_number, routeId: bus.route_id, startTime: trip.start_time, isSimulation, direction };
  realtime.toBusAndAdmins(busId, 'trip:started', event);
  realtime.toBusAndAdmins(busId, 'bus:status', { busId: Number(busId), status: 'ACTIVE', tripId, direction, at: new Date().toISOString() });

  // Never send real notifications to students for simulated trips.
  if (!isSimulation) {
    const students = await studentModel.listForBus(busId, bus.route_id);
    notificationService.notify(students, {
      title: `${bus.bus_number} started`,
      message: direction === 'FROM_COLLEGE' ? 'Bus has left the college.' : `${bus.bus_number} has started its trip to the college.`,
      type: 'TRIP_STARTED',
      data: { busId, tripId, direction },
    }).catch((e) => console.warn('[notify] trip start:', e.message));
  }
  return { trip, resumed: false };
}

/** Sum of distances between consecutive reliable points, ignoring impossible GPS jumps. */
function pathDistance(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (!a.is_reliable || !b.is_reliable) continue;
    const d = haversine({ lat: a.latitude, lng: a.longitude }, { lat: b.latitude, lng: b.longitude });
    const dt = (new Date(b.timestamp) - new Date(a.timestamp)) / 1000;
    if (dt > 0 && d / dt > 50) continue; // > 180 km/h: GPS glitch
    total += d;
  }
  return Math.round(total);
}

async function endTrip(user, tripId, { byAdmin = false } = {}) {
  const trip = await tripModel.findById(tripId);
  if (!trip) throw AppError.notFound('Trip');
  if (trip.status !== 'ACTIVE') throw AppError.badRequest('This trip is not active.');
  if (!byAdmin) {
    const driver = await driverForUser(user);
    if (String(trip.driver_id) !== String(driver.id)) throw AppError.forbidden('This is not your trip.');
  }
  const distance = pathDistance(await tripModel.path(tripId));
  await db.withTransaction(async (client) => {
    await tripModel.complete(tripId, distance, client);
    await client.query(`UPDATE buses SET status = 'INACTIVE' WHERE id = $1`, [trip.bus_id]);
  });
  tripState.drop(tripId);
  const done = await tripModel.findById(tripId);
  const event = {
    tripId: Number(tripId), busId: Number(trip.bus_id), busNumber: trip.bus_number,
    startTime: done.start_time, endTime: done.end_time, durationSeconds: done.duration_seconds,
    distanceMeters: distance, isSimulation: done.is_simulation, direction: done.direction,
  };
  realtime.toBusAndAdmins(trip.bus_id, 'trip:completed', event);
  realtime.toBusAndAdmins(trip.bus_id, 'bus:status', { busId: Number(trip.bus_id), status: 'INACTIVE', tripId: Number(tripId), at: new Date().toISOString() });
  return done;
}

module.exports = { startTrip, endTrip, pathDistance, driverForUser };
