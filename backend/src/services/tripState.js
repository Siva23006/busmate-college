// In-memory state for each ACTIVE trip (rebuilt from the DB after a server restart).
const db = require('../config/db');
const tripModel = require('../models/tripModel');
const driverModel = require('../models/driverModel');
const studentModel = require('../models/studentModel');

const STUDENT_REFRESH_MS = 5 * 60 * 1000;
const states = new Map();

async function load(tripId) {
  const key = String(tripId);
  if (states.has(key)) return states.get(key);
  const trip = await tripModel.findById(tripId);
  if (!trip || trip.status !== 'ACTIVE') return null;
  const driver = trip.driver_id ? await driverModel.findById(trip.driver_id) : null;
  const { rows: events } = await db.query('SELECT * FROM trip_stop_events WHERE trip_id = $1', [tripId]);
  const state = {
    trip,
    driverUserId: driver ? String(driver.user_id) : null,
    lastAlong: -Infinity,
    lastTimestamp: 0,
    lastReliable: null,
    insideStopId: events.find((e) => e.arrived_at && !e.departed_at)?.stop_id?.toString() || null,
    visitedStopIds: new Set(events.filter((e) => e.arrived_at).map((e) => String(e.stop_id))),
    notified: new Set(events.flatMap((e) => [
      e.near_1km_notified_at ? `near:${e.stop_id}` : null,
      e.approaching_notified_at ? `approach:${e.stop_id}` : null,
    ].filter(Boolean))),
    students: [],
    studentsLoadedAt: 0,
    offline: false,
  };
  states.set(key, state);
  return state;
}

async function students(state) {
  if (Date.now() - state.studentsLoadedAt > STUDENT_REFRESH_MS) {
    state.students = await studentModel.listForBus(state.trip.bus_id, state.trip.route_id);
    state.studentsLoadedAt = Date.now();
  }
  return state.students;
}

function drop(tripId) { states.delete(String(tripId)); }
function all() { return [...states.values()]; }

module.exports = { load, students, drop, all };
