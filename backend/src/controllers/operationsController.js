// Trips, tracking, driver/student home screens, dashboard stats, alerts, notifications.
const db = require('../config/db');
const AppError = require('../utils/AppError');
const busModel = require('../models/busModel');
const routeModel = require('../models/routeModel');
const tripModel = require('../models/tripModel');
const studentModel = require('../models/studentModel');
const tripService = require('../services/tripService');
const trackingService = require('../services/trackingService');
const alertService = require('../services/alertService');

// ---------------- Trips ----------------
const trips = {
  async start(req, res) {
    const { busId, simulation, direction } = req.valid.body;
    const result = await tripService.startTrip(req.user, busId, { isSimulation: !!simulation, direction });
    res.status(result.resumed ? 200 : 201).json(result);
  },
  async end(req, res) {
    const trip = await tripService.endTrip(req.user, req.valid.body.tripId, { byAdmin: req.user.role === 'ADMIN' });
    res.json({ trip });
  },
  async list(req, res) { res.json({ trips: await tripModel.list(req.valid.query) }); },
  async active(_req, res) { res.json({ trips: await tripModel.listActive() }); },
  async get(req, res) {
    const trip = await tripModel.findById(req.valid.params.id);
    if (!trip) throw AppError.notFound('Trip');
    res.json({ trip, stopEvents: await tripModel.stopEvents(trip.id, trip.direction) });
  },
  /** Ordered GPS points for route replay. */
  async path(req, res) {
    const trip = await tripModel.findById(req.valid.params.id);
    if (!trip) throw AppError.notFound('Trip');
    res.json({ tripId: trip.id, isSimulation: trip.is_simulation, direction: trip.direction, points: await tripModel.path(trip.id) });
  },
};

// ---------------- Tracking ----------------
async function postLocation(req, res) {
  res.json(await trackingService.processLocation(req.user, req.valid.body));
}

// ---------------- Driver home ----------------
async function driverHome(req, res) {
  const driver = await tripService.driverForUser(req.user);
  const buses = await busModel.findByDriverId(driver.id);
  const activeTrip = driver.active_trip_id ? await tripModel.findById(driver.active_trip_id) : null;
  const withRoutes = await Promise.all(buses.map(async (b) => ({
    ...b,
    route: b.route_id ? await routeModel.findById(b.route_id) : null,
  })));
  res.json({
    driver: { id: driver.id, name: driver.name, employeeId: driver.employee_id, phone: driver.phone },
    buses: withRoutes,
    activeTrip,
  });
}

/** The signed-in driver's last 20 trips (Trips tab in the driver app). */
async function driverTrips(req, res) {
  const driver = await tripService.driverForUser(req.user);
  res.json({ trips: await tripModel.listForDriver(driver.id, 20) });
}

// ---------------- Student home ----------------
async function studentProfile(req) {
  const student = await studentModel.findByUserId(req.user.id);
  if (!student) throw AppError.forbidden('This account is not linked to a student profile.');
  return student;
}

async function studentHome(req, res) {
  const student = await studentProfile(req);
  const busId = student.bus_id;
  const bus = busId ? await busModel.findById(busId) : null;
  const route = bus && bus.route_id ? await routeModel.findById(bus.route_id)
    : student.assigned_route_id ? await routeModel.findById(student.assigned_route_id) : null;
  res.json({
    student: {
      id: student.id, name: student.name, studentId: student.student_id,
      stopId: student.assigned_stop_id, stopName: student.assigned_stop_name,
      notificationsEnabled: student.notifications_enabled,
    },
    bus,
    route,
    // Direction of the running trip (null when the bus is not on a trip). The route's stops and
    // path are always sent in stored (TO_COLLEGE) order; clients reverse them for FROM_COLLEGE.
    direction: bus && bus.active_trip_id ? bus.active_trip_direction : null,
    eta: bus && bus.active_trip_id ? trackingService.getLatestEta(bus.id) : null,
  });
}

/** Buses a student may pick: their route's buses first, then all others. */
async function studentBuses(req, res) {
  const student = await studentProfile(req);
  const all = await busModel.list();
  all.sort((a, b) => (String(b.route_id) === String(student.assigned_route_id)) - (String(a.route_id) === String(student.assigned_route_id)));
  res.json({ buses: all.map((b) => ({ ...b, isMyRoute: String(b.route_id) === String(student.assigned_route_id) })) });
}

async function studentChooseBus(req, res) {
  const student = await studentProfile(req);
  const bus = await busModel.findById(req.valid.body.busId);
  if (!bus) throw AppError.notFound('Bus');
  // Changing bus also moves the student to that bus's route; their stop is cleared if it is not on it.
  const keepStop = student.assigned_stop_id && (await routeModel.findStop(student.assigned_stop_id))?.route_id == bus.route_id;
  await studentModel.update(student.id, {
    assigned_bus_id: bus.id,
    assigned_route_id: bus.route_id,
    assigned_stop_id: keepStop ? student.assigned_stop_id : null,
  });
  res.json({ ok: true });
}

async function studentChooseStop(req, res) {
  const student = await studentProfile(req);
  const stop = await routeModel.findStop(req.valid.body.stopId);
  if (!stop) throw AppError.notFound('Stop');
  const routeId = student.bus_id ? (await busModel.findById(student.bus_id))?.route_id : student.assigned_route_id;
  if (routeId && String(stop.route_id) !== String(routeId)) throw AppError.badRequest('That stop is not on your bus route.');
  await studentModel.update(student.id, { assigned_stop_id: stop.id, assigned_route_id: stop.route_id });
  res.json({ ok: true });
}

// ---------------- Dashboard ----------------
async function dashboardStats(_req, res) {
  const { rows } = await db.query(`
    SELECT
      (SELECT count(*) FROM buses)::int                                         AS total_buses,
      (SELECT count(*) FROM buses WHERE status = 'ACTIVE')::int                 AS active_buses,
      (SELECT count(*) FROM buses WHERE status = 'OFFLINE')::int                AS offline_buses,
      (SELECT count(*) FROM trips WHERE trip_date = CURRENT_DATE)::int          AS todays_trips,
      (SELECT count(*) FROM trips WHERE status = 'ACTIVE')::int                 AS active_trips,
      (SELECT count(*) FROM students)::int                                      AS total_students,
      (SELECT count(*) FROM drivers WHERE status = 'ACTIVE')::int               AS active_drivers,
      (SELECT count(*) FROM alerts WHERE NOT resolved)::int                     AS open_alerts`);
  res.json({ stats: rows[0] });
}

const alerts = {
  async list(req, res) {
    res.json({ alerts: await alertService.list({ resolved: req.query.resolved === 'true' }) });
  },
  async resolve(req, res) {
    const alert = await alertService.resolve(req.valid.params.id);
    if (!alert) throw AppError.notFound('Alert');
    res.json({ alert });
  },
};

// ---------------- Notifications (inbox) ----------------
const notifications = {
  async list(req, res) {
    const { rows } = await db.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100', [req.user.id]);
    res.json({ notifications: rows });
  },
  async markRead(req, res) {
    await db.query('UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2', [req.valid.params.id, req.user.id]);
    res.json({ ok: true });
  },
};

module.exports = {
  trips, postLocation, driverHome, driverTrips, studentHome, studentBuses, studentChooseBus, studentChooseStop,
  dashboardStats, alerts, notifications,
};
