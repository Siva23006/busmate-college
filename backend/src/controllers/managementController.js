// CRUD for buses, routes, stops, drivers and students (admin; some reads open to all roles).
const bcrypt = require('bcryptjs');
const fbAuth = require('../services/firebaseAuthService');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const busModel = require('../models/busModel');
const routeModel = require('../models/routeModel');
const driverModel = require('../models/driverModel');
const studentModel = require('../models/studentModel');
const userModel = require('../models/userModel');
const geometryCache = require('../services/routeGeometryCache');
const roadRouteService = require('../services/roadRouteService');
const trackingService = require('../services/trackingService');
const realtime = require('../services/realtime');

const idOf = (req) => req.valid.params.id;

// ---------------- Buses ----------------
const buses = {
  async list(_req, res) { res.json({ buses: await busModel.list() }); },
  async get(req, res) {
    const bus = await busModel.findById(idOf(req));
    if (!bus) throw AppError.notFound('Bus');
    const route = bus.route_id ? await routeModel.findById(bus.route_id) : null;
    res.json({ bus, route });
  },
  async create(req, res) { res.status(201).json({ bus: await busModel.create(req.valid.body) }); },
  async update(req, res) {
    const bus = await busModel.update(idOf(req), req.valid.body);
    if (!bus) throw AppError.notFound('Bus');
    realtime.toAdmins('bus:updated', bus);
    res.json({ bus });
  },
  async remove(req, res) {
    const active = await db.query(`SELECT 1 FROM trips WHERE bus_id = $1 AND status = 'ACTIVE'`, [idOf(req)]);
    if (active.rowCount) throw AppError.conflict('End the active trip before deleting this bus.');
    if (!(await busModel.remove(idOf(req)))) throw AppError.notFound('Bus');
    res.status(204).end();
  },
  async location(req, res) {
    const bus = await busModel.findById(idOf(req));
    if (!bus) throw AppError.notFound('Bus');
    res.json({
      busId: bus.id, busNumber: bus.bus_number, status: bus.status, activeTripId: bus.active_trip_id,
      location: bus.latitude == null ? null : {
        latitude: bus.latitude, longitude: bus.longitude, accuracy: bus.accuracy, speed: bus.speed,
        heading: bus.heading, timestamp: bus.location_time, isSimulation: bus.location_is_simulation,
        direction: bus.active_trip_direction,
      },
      // Where the driver actually started this trip (first good GPS fix).
      start: bus.active_trip_id && bus.trip_start_latitude != null
        ? { latitude: bus.trip_start_latitude, longitude: bus.trip_start_longitude } : null,
    });
  },
  async eta(req, res) {
    const bus = await busModel.findById(idOf(req));
    if (!bus) throw AppError.notFound('Bus');
    const eta = bus.active_trip_id ? trackingService.getLatestEta(bus.id) : null;
    res.json({ busId: bus.id, activeTripId: bus.active_trip_id, eta });
  },
};

// ---------------- Routes ----------------
const routes = {
  async list(_req, res) { res.json({ routes: await routeModel.list() }); },
  async get(req, res) {
    const route = await routeModel.findById(idOf(req));
    if (!route) throw AppError.notFound('Route');
    res.json({ route });
  },
  async create(req, res) { res.status(201).json({ route: await routeModel.create(req.valid.body) }); },
  async update(req, res) {
    const route = await routeModel.update(idOf(req), req.valid.body);
    if (!route) throw AppError.notFound('Route');
    geometryCache.invalidate(route.id);
    res.json({ route });
  },
  async remove(req, res) {
    if (!(await routeModel.remove(idOf(req)))) throw AppError.notFound('Route');
    geometryCache.invalidate(idOf(req));
    res.status(204).end();
  },
  async reorderStops(req, res) {
    const ok = await routeModel.reorderStops(idOf(req), req.valid.body.stopIds);
    if (!ok) throw AppError.badRequest('stopIds must list every stop of this route exactly once.');
    geometryCache.invalidate(idOf(req));
    const roadRoute = await roadRouteService.regenerate(idOf(req));
    res.json({ route: await routeModel.findById(idOf(req)), roadRoute });
  },
  /** Admin button "Regenerate road route": rebuild routes.path from the stops via OSRM. */
  async generatePath(req, res) {
    if (!(await routeModel.findById(idOf(req)))) throw AppError.notFound('Route');
    const roadRoute = await roadRouteService.regenerate(idOf(req), { clearOnFailure: false });
    res.json({ route: await routeModel.findById(idOf(req)), roadRoute });
  },
};

// ---------------- Stops ----------------
const stops = {
  async list(req, res) { res.json({ stops: await routeModel.listStops(req.valid.query.routeId) }); },
  async create(req, res) {
    const route = await routeModel.findById(req.valid.body.route_id);
    if (!route) throw AppError.notFound('Route');
    const stop = await routeModel.createStop(req.valid.body);
    geometryCache.invalidate(stop.route_id);
    // The road line now has to pass through the new stop. regenerate() never throws.
    const roadRoute = await roadRouteService.regenerate(stop.route_id);
    res.status(201).json({ stop, roadRoute });
  },
  async update(req, res) {
    const stop = await routeModel.updateStop(idOf(req), req.valid.body);
    if (!stop) throw AppError.notFound('Stop');
    geometryCache.invalidate(stop.route_id);
    // Only a moved or re-ordered stop changes the road line (not a rename or a new radius).
    const moved = ['latitude', 'longitude', 'stop_order'].some((f) => req.valid.body[f] !== undefined);
    const roadRoute = moved ? await roadRouteService.regenerate(stop.route_id) : undefined;
    res.json({ stop, roadRoute });
  },
  async remove(req, res) {
    const removed = await routeModel.removeStop(idOf(req));
    if (!removed) throw AppError.notFound('Stop');
    geometryCache.invalidate(removed.route_id);
    await roadRouteService.regenerate(removed.route_id);
    res.status(204).end();
  },
};

// ---------------- Drivers ----------------
async function assignDriverBus(client, driverId, busId) {
  if (busId === undefined) return;
  await client.query('UPDATE buses SET driver_id = NULL WHERE driver_id = $1', [driverId]);
  if (busId) {
    const { rowCount } = await client.query('UPDATE buses SET driver_id = $1 WHERE id = $2', [driverId, busId]);
    if (!rowCount) throw AppError.notFound('Bus');
  }
}

const drivers = {
  async list(_req, res) { res.json({ drivers: await driverModel.list() }); },
  async get(req, res) {
    const driver = await driverModel.findById(idOf(req));
    if (!driver) throw AppError.notFound('Driver');
    res.json({ driver });
  },
  async create(req, res) {
    const data = req.valid.body;
    const password_hash = await bcrypt.hash(data.password, 12);
    const id = await db.withTransaction(async (client) => {
      const user = await userModel.create({ ...data, role: 'DRIVER', password_hash }, client);
      const driverId = await driverModel.create(user.id, data, client);
      await assignDriverBus(client, driverId, data.bus_id);
      return driverId;
    });
    const created = await driverModel.findById(id);
    await fbAuth.syncAfterAdminSave(created.user_id, data.password);
    res.status(201).json({ driver: created });
  },
  async update(req, res) {
    const driver = await driverModel.findById(idOf(req));
    if (!driver) throw AppError.notFound('Driver');
    const data = req.valid.body;
    const userData = { name: data.name, email: data.email, phone: data.phone };
    if (data.password) userData.password_hash = await bcrypt.hash(data.password, 12);
    if (data.status) userData.is_active = data.status === 'ACTIVE';
    await db.withTransaction(async (client) => {
      await userModel.update(driver.user_id, userData, client);
      await driverModel.update(driver.id, data, client);
      await assignDriverBus(client, driver.id, data.bus_id);
    });
    await fbAuth.syncAfterAdminSave(driver.user_id, data.password);
    res.json({ driver: await driverModel.findById(driver.id) });
  },
};

// ---------------- Students ----------------
async function checkStopOnRoute(routeId, stopId) {
  if (!stopId) return;
  const stop = await routeModel.findStop(stopId);
  if (!stop) throw AppError.notFound('Stop');
  if (routeId && String(stop.route_id) !== String(routeId)) throw AppError.badRequest('That stop is not on the selected route.');
}

const students = {
  async list(req, res) { res.json({ students: await studentModel.list(req.valid.query) }); },
  async get(req, res) {
    const student = await studentModel.findById(idOf(req));
    if (!student) throw AppError.notFound('Student');
    res.json({ student });
  },
  async create(req, res) {
    const data = req.valid.body;
    await checkStopOnRoute(data.assigned_route_id, data.assigned_stop_id);
    const password_hash = await bcrypt.hash(data.password, 12);
    const id = await db.withTransaction(async (client) => {
      const user = await userModel.create({ ...data, role: 'STUDENT', password_hash }, client);
      return studentModel.create(user.id, data, client);
    });
    const created = await studentModel.findById(id);
    await fbAuth.syncAfterAdminSave(created.user_id, data.password);
    res.status(201).json({ student: created });
  },
  async update(req, res) {
    const student = await studentModel.findById(idOf(req));
    if (!student) throw AppError.notFound('Student');
    const data = req.valid.body;
    await checkStopOnRoute(data.assigned_route_id ?? student.assigned_route_id, data.assigned_stop_id);
    const userData = { name: data.name, email: data.email, phone: data.phone };
    if (data.password) userData.password_hash = await bcrypt.hash(data.password, 12);
    await db.withTransaction(async (client) => {
      await userModel.update(student.user_id, userData, client);
      await studentModel.update(student.id, data, client);
    });
    await fbAuth.syncAfterAdminSave(student.user_id, data.password);
    res.json({ student: await studentModel.findById(student.id) });
  },
  async remove(req, res) {
    const student = await studentModel.findById(idOf(req));
    if (!student) throw AppError.notFound('Student');
    const { rows } = await db.query('DELETE FROM users WHERE id = $1 RETURNING firebase_uid', [student.user_id]);
    await fbAuth.removeAccount(rows[0] && rows[0].firebase_uid);
    res.status(204).end();
  },
};

module.exports = { buses, routes, stops, drivers, students };
