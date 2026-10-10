// Admin alerts with throttling so one problem does not flood the dashboard.
const db = require('../config/db');
const realtime = require('./realtime');

const THROTTLE_MS = 5 * 60 * 1000;
// Shown to the admin. (Weak GPS is normal in traffic/tunnels and is no longer an alert.)
const IMPORTANT_TYPES = ['OVERSPEED', 'BUS_OFFLINE', 'ROUTE_DEVIATION', 'SOS'];
const lastRaised = new Map(); // `${busId}:${type}` -> time

async function raise({ busId = null, tripId = null, type, severity = 'WARNING', message, throttle = true }) {
  const key = `${busId}:${type}`;
  const now = Date.now();
  if (throttle && lastRaised.has(key) && now - lastRaised.get(key) < THROTTLE_MS) return null;
  lastRaised.set(key, now);
  const { rows } = await db.query(
    `INSERT INTO alerts (bus_id, trip_id, type, severity, message) VALUES ($1,$2,$3,$4,$5)
     RETURNING *, (SELECT bus_number FROM buses WHERE id = $1) AS bus_number`,
    [busId, tripId, type, severity, message],
  );
  realtime.toAdmins('admin:alert', rows[0]);
  return rows[0];
}

async function list({ resolved = false, limit = 300 } = {}) {
  const { rows } = await db.query(
    `SELECT a.*, b.bus_number FROM alerts a LEFT JOIN buses b ON b.id = a.bus_id
      WHERE a.resolved = $1 AND a.type = ANY($3) ORDER BY a.created_at DESC LIMIT $2`,
    [resolved, limit, IMPORTANT_TYPES],
  );
  return rows;
}

/** Marks every open alert as handled. */
async function resolveAll() {
  const { rowCount } = await db.query(
    'UPDATE alerts SET resolved = TRUE, resolved_at = now() WHERE NOT resolved AND type = ANY($1)', [IMPORTANT_TYPES]);
  return rowCount;
}

async function resolve(id) {
  const { rows } = await db.query(
    'UPDATE alerts SET resolved = TRUE, resolved_at = now() WHERE id = $1 RETURNING *',
    [id],
  );
  return rows[0] || null;
}

module.exports = { raise, list, resolve, resolveAll, IMPORTANT_TYPES };
