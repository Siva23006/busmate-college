// Driver SOS + delay messages, bulk student upload, monthly report, own profile.
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const tripService = require('../services/tripService');
const tripState = require('../services/tripState');
const alertService = require('../services/alertService');
const notificationService = require('../services/notificationService');
const realtime = require('../services/realtime');
const fbAuth = require('../services/firebaseAuthService');
const studentModel = require('../models/studentModel');
const userModel = require('../models/userModel');
const authController = require('./authController');

const mapLink = (lat, lng) => (lat != null && lng != null ? `https://maps.google.com/?q=${lat},${lng}` : null);

/** The driver's running trip on this bus (or null). */
async function activeTripFor(driver, busId) {
  const { rows } = await db.query(
    `SELECT t.*, b.bus_number FROM trips t JOIN buses b ON b.id = t.bus_id
      WHERE t.status = 'ACTIVE' AND t.driver_id = $1 ${busId ? 'AND t.bus_id = $2' : ''}
      ORDER BY t.start_time DESC LIMIT 1`,
    busId ? [driver.id, busId] : [driver.id],
  );
  return rows[0] || null;
}

async function lastPosition(busId) {
  const { rows } = await db.query('SELECT latitude, longitude FROM live_locations WHERE bus_id = $1', [busId]);
  return rows[0] || null;
}

// ---------------- Driver SOS ----------------
async function sos(req, res) {
  const driver = await tripService.driverForUser(req.user);
  const { busId, latitude, longitude, note } = req.valid.body;
  const trip = await activeTripFor(driver, busId);
  const bus = trip ? { id: trip.bus_id, bus_number: trip.bus_number }
    : (await db.query('SELECT id, bus_number FROM buses WHERE driver_id = $1 ORDER BY id LIMIT 1', [driver.id])).rows[0];
  if (!bus) throw AppError.badRequest('No bus is assigned to you.');
  const pos = latitude != null ? { latitude, longitude } : await lastPosition(bus.id);
  const link = pos ? mapLink(pos.latitude, pos.longitude) : null;
  const text = `SOS from ${driver.name} on ${bus.bus_number}${note ? `: ${note}` : ''}.${link ? ` Location: ${link}` : ''}`;

  await db.query(
    `INSERT INTO trip_messages (trip_id, bus_id, driver_id, kind, message, latitude, longitude)
     VALUES ($1,$2,$3,'SOS',$4,$5,$6)`,
    [trip ? trip.id : null, bus.id, driver.id, note || 'Emergency', pos ? pos.latitude : null, pos ? pos.longitude : null],
  );
  const alert = await alertService.raise({
    busId: bus.id, tripId: trip ? trip.id : null, type: 'SOS', severity: 'CRITICAL', message: text, throttle: false,
  });
  realtime.toAdmins('admin:sos', {
    busId: Number(bus.id), busNumber: bus.bus_number, driverName: driver.name, driverPhone: driver.phone,
    note: note || null, latitude: pos ? pos.latitude : null, longitude: pos ? pos.longitude : null, mapLink: link,
    at: new Date().toISOString(), alertId: alert ? alert.id : null,
  });
  res.json({ ok: true, message: 'SOS sent. The transport office has been alerted.' });
}

// ---------------- Driver delay / status message ----------------
const KIND_TEXT = {
  TRAFFIC: 'Heavy traffic',
  BREAKDOWN: 'Bus breakdown',
  LATE: 'Running late',
  OTHER: 'Message from driver',
};

async function delay(req, res) {
  const driver = await tripService.driverForUser(req.user);
  const { busId, kind, minutes, note } = req.valid.body;
  const trip = await activeTripFor(driver, busId);
  if (!trip) throw AppError.badRequest('Start the trip first to send a message to students.');
  const head = KIND_TEXT[kind] || KIND_TEXT.OTHER;
  const text = `${head}${minutes ? ` · about ${minutes} min late` : ''}${note ? ` · ${note}` : ''}`;
  const pos = await lastPosition(trip.bus_id);

  const { rows } = await db.query(
    `INSERT INTO trip_messages (trip_id, bus_id, driver_id, kind, minutes, message, latitude, longitude)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [trip.id, trip.bus_id, driver.id, kind, minutes ?? null, text, pos ? pos.latitude : null, pos ? pos.longitude : null],
  );
  const msg = rows[0];
  realtime.toBusAndAdmins(trip.bus_id, 'bus:message', {
    busId: Number(trip.bus_id), tripId: Number(trip.id), kind, minutes: minutes ?? null, text, at: msg.created_at,
  });
  if (kind === 'BREAKDOWN') {
    alertService.raise({
      busId: trip.bus_id, tripId: trip.id, type: 'BREAKDOWN', severity: 'CRITICAL',
      message: `${trip.bus_number}: breakdown reported by ${driver.name}.${pos ? ` Location: ${mapLink(pos.latitude, pos.longitude)}` : ''}`,
      throttle: false,
    }).catch(() => {});
  }
  if (!trip.is_simulation) {
    const state = await tripState.load(trip.id);
    const students = state ? await tripState.students(state) : await studentModel.listForBus(trip.bus_id, trip.route_id);
    notificationService.notify(students, {
      title: `${trip.bus_number}: ${head}`, message: text, type: 'DELAY', data: { busId: trip.bus_id },
    }).catch((e) => console.warn('[notify] delay:', e.message));
  }
  res.json({ ok: true, message: 'Sent to students.' });
}

/** Latest driver messages for a bus's running trip (student app banner, admin). */
async function busMessages(req, res) {
  const busId = req.valid.params.id;
  const { rows } = await db.query(
    `SELECT m.id, m.kind, m.minutes, m.message, m.created_at
       FROM trip_messages m JOIN trips t ON t.id = m.trip_id
      WHERE m.bus_id = $1 AND t.status = 'ACTIVE' AND m.kind <> 'SOS'
      ORDER BY m.created_at DESC LIMIT 5`,
    [busId],
  );
  res.json({ messages: rows });
}

// ---------------- Bulk student upload ----------------
async function bulkStudents(req, res) {
  const rows = req.valid.body.students;
  const { rows: buses } = await db.query('SELECT id, bus_number, route_id FROM buses');
  const busByNumber = new Map(buses.map((b) => [b.bus_number.trim().toLowerCase(), b]));
  const results = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      let bus = null;
      if (r.bus_number) {
        bus = busByNumber.get(r.bus_number.trim().toLowerCase());
        if (!bus) throw AppError.badRequest(`Bus "${r.bus_number}" not found.`);
      }
      let stopId = null;
      if (r.stop_name) {
        if (!bus || !bus.route_id) throw AppError.badRequest('A stop needs a bus with a route.');
        const { rows: st } = await db.query(
          'SELECT id FROM stops WHERE route_id = $1 AND lower(stop_name) = lower($2) LIMIT 1', [bus.route_id, r.stop_name.trim()]);
        if (!st[0]) throw AppError.badRequest(`Stop "${r.stop_name}" is not on ${bus.bus_number}'s route.`);
        stopId = st[0].id;
      }
      const password_hash = await bcrypt.hash(r.password, 12);
      const data = {
        name: r.name, email: r.email || null, phone: r.phone || null, student_id: r.student_id,
        department: r.department || null, year: r.year ?? null,
        assigned_bus_id: bus ? bus.id : null, assigned_route_id: bus ? bus.route_id : null, assigned_stop_id: stopId,
      };
      const userId = await db.withTransaction(async (client) => {
        const user = await userModel.create({ ...data, role: 'STUDENT', password_hash }, client);
        await studentModel.create(user.id, data, client);
        return user.id;
      });
      fbAuth.syncAfterAdminSave(userId, r.password).catch(() => {});
      results.push({ row: i + 1, studentId: r.student_id, ok: true });
    } catch (err) {
      const message = err instanceof AppError ? err.message
        : err.code === '23505' ? 'Student ID or email already exists.' : 'Could not add this row.';
      results.push({ row: i + 1, studentId: r.student_id, ok: false, error: message });
    }
  }
  res.json({ added: results.filter((x) => x.ok).length, failed: results.filter((x) => !x.ok).length, results });
}

// ---------------- Monthly report ----------------
async function monthlyReport(req, res) {
  const month = req.valid.query.month; // YYYY-MM
  const start = `${month}-01`;
  const tz = env.APP_TIME_ZONE || 'Asia/Kolkata';
  const { rows } = await db.query(
    `WITH t AS (
       SELECT t.*, r.morning_time, r.evening_time,
              (t.start_time AT TIME ZONE $2)::time AS start_local,
              CASE WHEN t.direction = 'FROM_COLLEGE' THEN r.evening_time ELSE r.morning_time END AS sched
         FROM trips t LEFT JOIN routes r ON r.id = t.route_id
        WHERE t.trip_date >= $1::date AND t.trip_date < ($1::date + INTERVAL '1 month') AND NOT t.is_simulation
     ), a AS (
       SELECT bus_id,
              count(*) FILTER (WHERE type = 'OVERSPEED')::int AS overspeed,
              count(*) FILTER (WHERE type = 'BUS_OFFLINE')::int AS offline,
              count(*) FILTER (WHERE type = 'ROUTE_DEVIATION')::int AS off_route,
              count(*) FILTER (WHERE type IN ('SOS', 'BREAKDOWN'))::int AS emergencies
         FROM alerts
        WHERE (created_at AT TIME ZONE $2)::date >= $1::date
          AND (created_at AT TIME ZONE $2)::date < ($1::date + INTERVAL '1 month')
        GROUP BY bus_id
     ), m AS (
       SELECT bus_id, count(*)::int AS delays
         FROM trip_messages
        WHERE kind IN ('TRAFFIC', 'BREAKDOWN', 'LATE', 'OTHER')
          AND (created_at AT TIME ZONE $2)::date >= $1::date
          AND (created_at AT TIME ZONE $2)::date < ($1::date + INTERVAL '1 month')
        GROUP BY bus_id
     )
     SELECT b.id AS bus_id, b.bus_number,
            count(t.id)::int AS trips,
            count(t.id) FILTER (WHERE t.status = 'COMPLETED')::int AS completed,
            count(t.id) FILTER (WHERE t.direction = 'TO_COLLEGE')::int AS morning_trips,
            count(t.id) FILTER (WHERE t.direction = 'FROM_COLLEGE')::int AS evening_trips,
            round(COALESCE(sum(t.distance_meters), 0)::numeric / 1000, 1)::float AS distance_km,
            round(avg(EXTRACT(EPOCH FROM (t.end_time - t.start_time)) / 60) FILTER (WHERE t.end_time IS NOT NULL))::int AS avg_minutes,
            count(t.id) FILTER (WHERE t.sched IS NOT NULL)::int AS scheduled,
            count(t.id) FILTER (WHERE t.sched IS NOT NULL AND t.start_local > t.sched + INTERVAL '5 minutes')::int AS late_starts,
            COALESCE(max(a.overspeed), 0)::int AS overspeed,
            COALESCE(max(a.offline), 0)::int AS offline,
            COALESCE(max(a.off_route), 0)::int AS off_route,
            COALESCE(max(a.emergencies), 0)::int AS emergencies,
            COALESCE(max(m.delays), 0)::int AS delay_messages
       FROM buses b
       LEFT JOIN t ON t.bus_id = b.id
       LEFT JOIN a ON a.bus_id = b.id
       LEFT JOIN m ON m.bus_id = b.id
      GROUP BY b.id, b.bus_number
      ORDER BY b.bus_number`,
    [start, tz],
  );
  const buses = rows.map((r) => ({
    ...r,
    on_time_pct: r.scheduled ? Math.round(((r.scheduled - r.late_starts) / r.scheduled) * 100) : null,
  }));
  const sum = (k) => buses.reduce((s, b) => s + (Number(b[k]) || 0), 0);
  const scheduled = sum('scheduled');
  const totals = {
    trips: sum('trips'), completed: sum('completed'), distance_km: Math.round(sum('distance_km') * 10) / 10,
    late_starts: sum('late_starts'), overspeed: sum('overspeed'), offline: sum('offline'),
    off_route: sum('off_route'), emergencies: sum('emergencies'), delay_messages: sum('delay_messages'),
    on_time_pct: scheduled ? Math.round(((scheduled - sum('late_starts')) / scheduled) * 100) : null,
  };
  res.json({ month, timeZone: tz, lateAfterMinutes: 5, totals, buses });
}

// ---------------- My profile (any role; used by the admin portal) ----------------
async function getMe(req, res) {
  const { rows } = await db.query('SELECT id, name, email, phone, role, created_at FROM users WHERE id = $1', [req.user.id]);
  if (!rows[0]) throw AppError.unauthorized();
  res.json({ user: rows[0] });
}

async function updateMe(req, res) {
  const { name, email, phone } = req.valid.body;
  await userModel.update(req.user.id, { name, email: email === '' ? null : email, phone: phone === '' ? null : phone });
  await fbAuth.syncAfterAdminSave(req.user.id);
  const user = await userModel.findById(req.user.id);
  res.json({ user: await authController.profileFor(user) });
}

module.exports = { sos, delay, busMessages, bulkStudents, monthlyReport, getMe, updateMe };
