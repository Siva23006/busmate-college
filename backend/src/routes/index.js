const express = require('express');
const rateLimit = require('express-rate-limit');
const h = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const v = require('../validators');
const auth = require('../controllers/authController');
const m = require('../controllers/managementController');
const ops = require('../controllers/operationsController');
const trackCtl = require('../controllers/trackController');
const db = require('../config/db');

const router = express.Router();
const ADMIN = requireRole('ADMIN');
const DRIVER = requireRole('DRIVER');
const STUDENT = requireRole('STUDENT');
const ANY = requireRole('ADMIN', 'DRIVER', 'STUDENT');
const byId = validate({ params: v.idParam });

// ---------- Health ----------
router.get('/health', h(async (_req, res) => {
  let database = 'ok';
  try { await db.checkConnection(); } catch { database = 'unavailable'; }
  res.status(database === 'ok' ? 200 : 503).json({ status: database === 'ok' ? 'ok' : 'degraded', database, time: new Date().toISOString() });
}));

// ---------- Auth ----------
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_ATTEMPTS', message: 'Too many login attempts. Try again in 15 minutes.' } } });
router.post('/auth/login', loginLimiter, validate({ body: v.login }), h(auth.login));
const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_ATTEMPTS', message: 'Too many reset requests. Try again in 15 minutes.' } } });
router.post('/auth/forgot-password', resetLimiter, validate({ body: v.forgotPassword }), h(auth.forgotPassword));
router.put('/me/password', requireAuth, loginLimiter, validate({ body: v.changePassword }), h(auth.changePassword));
router.post('/auth/register', requireAuth, ADMIN, validate({ body: v.register }), h(auth.register));
router.get('/auth/me', requireAuth, h(auth.me));
router.put('/me/fcm-token', requireAuth, validate({ body: v.fcmToken }), h(auth.setFcmToken));
router.put('/me/notifications', requireAuth, validate({ body: v.notificationPrefs }), h(auth.setNotificationPrefs));

// Everything below requires login
router.use(requireAuth);

// ---------- Buses ----------
router.get('/buses', ANY, h(m.buses.list));
router.post('/buses', ADMIN, validate({ body: v.busCreate }), h(m.buses.create));
router.get('/buses/:id', ANY, byId, h(m.buses.get));
router.put('/buses/:id', ADMIN, validate({ params: v.idParam, body: v.busUpdate }), h(m.buses.update));
router.delete('/buses/:id', ADMIN, byId, h(m.buses.remove));
router.get('/buses/:id/location', ANY, byId, h(m.buses.location));
router.get('/buses/:id/eta', ANY, byId, h(m.buses.eta));
router.get('/buses/:id/track', ADMIN, validate({ params: v.idParam, query: v.trackQuery }), h(trackCtl.track));

// ---------- Routes ----------
router.get('/routes', ANY, h(m.routes.list));
router.post('/routes', ADMIN, validate({ body: v.routeCreate }), h(m.routes.create));
router.get('/routes/:id', ANY, byId, h(m.routes.get));
router.put('/routes/:id', ADMIN, validate({ params: v.idParam, body: v.routeUpdate }), h(m.routes.update));
router.delete('/routes/:id', ADMIN, byId, h(m.routes.remove));
router.post('/routes/:id/generate-path', ADMIN, byId, h(m.routes.generatePath));
router.put('/routes/:id/stops/order', ADMIN, validate({ params: v.idParam, body: v.stopReorder }), h(m.routes.reorderStops));

// ---------- Stops ----------
router.get('/stops', ANY, validate({ query: v.stopsQuery }), h(m.stops.list));
router.post('/stops', ADMIN, validate({ body: v.stopCreate }), h(m.stops.create));
router.put('/stops/:id', ADMIN, validate({ params: v.idParam, body: v.stopUpdate }), h(m.stops.update));
router.delete('/stops/:id', ADMIN, byId, h(m.stops.remove));

// ---------- Drivers ----------
router.get('/drivers', ADMIN, h(m.drivers.list));
router.post('/drivers', ADMIN, validate({ body: v.driverCreate }), h(m.drivers.create));
router.get('/drivers/:id', ADMIN, byId, h(m.drivers.get));
router.put('/drivers/:id', ADMIN, validate({ params: v.idParam, body: v.driverUpdate }), h(m.drivers.update));

// ---------- Students ----------
router.get('/students', ADMIN, validate({ query: v.studentsQuery }), h(m.students.list));
router.post('/students', ADMIN, validate({ body: v.studentCreate }), h(m.students.create));
router.get('/students/:id', ADMIN, byId, h(m.students.get));
router.put('/students/:id', ADMIN, validate({ params: v.idParam, body: v.studentUpdate }), h(m.students.update));
router.delete('/students/:id', ADMIN, byId, h(m.students.remove));

// ---------- Trips ----------
router.post('/trips/start', DRIVER, validate({ body: v.tripStart }), h(ops.trips.start));
router.post('/trips/end', requireRole('DRIVER', 'ADMIN'), validate({ body: v.tripEnd }), h(ops.trips.end));
router.get('/trips', ADMIN, validate({ query: v.tripsQuery }), h(ops.trips.list));
router.get('/trips/active', ANY, h(ops.trips.active));
router.get('/trips/:id', ADMIN, byId, h(ops.trips.get));
router.get('/trips/:id/path', ADMIN, byId, h(ops.trips.path));

// ---------- Tracking (REST fallback; the app normally uses Socket.IO) ----------
const trackingLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });
router.post('/tracking/location', DRIVER, trackingLimiter, validate({ body: v.location }), h(ops.postLocation));

// ---------- Driver / student app screens ----------
router.get('/driver/home', DRIVER, h(ops.driverHome));
router.get('/driver/trips', DRIVER, h(ops.driverTrips));
router.get('/student/home', STUDENT, h(ops.studentHome));
router.get('/student/buses', STUDENT, h(ops.studentBuses));
router.put('/student/bus', STUDENT, validate({ body: v.chooseBus }), h(ops.studentChooseBus));
router.put('/student/stop', STUDENT, validate({ body: v.chooseStop }), h(ops.studentChooseStop));

// ---------- Admin dashboard ----------
router.get('/dashboard/stats', ADMIN, h(ops.dashboardStats));
router.get('/alerts', ADMIN, h(ops.alerts.list));
router.patch('/alerts/:id/resolve', ADMIN, byId, h(ops.alerts.resolve));
router.post('/alerts/resolve-all', ADMIN, h(ops.alerts.resolveAll));
router.get('/settings/alerts', ADMIN, h(ops.alerts.getSettings));
router.put('/settings/alerts', ADMIN, validate({ body: v.alertSettings }), h(ops.alerts.saveSettings));

// ---------- Notifications ----------
router.get('/notifications', ANY, h(ops.notifications.list));
router.patch('/notifications/read-all', ANY, h(ops.notifications.markAllRead));
router.patch('/notifications/:id/read', ANY, byId, h(ops.notifications.markRead));
router.delete('/notifications', ANY, h(ops.notifications.clear));
router.delete('/notifications/:id', ANY, byId, h(ops.notifications.remove));

module.exports = router;
