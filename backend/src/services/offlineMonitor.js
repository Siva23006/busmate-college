// Every 15 s: any ACTIVE trip whose bus has not reported for BUS_OFFLINE_AFTER_SECONDS
// is marked OFFLINE, admins get an alert, and student apps get a bus:status event.
const db = require('../config/db');
const env = require('../config/env');
const realtime = require('./realtime');
const alertService = require('./alertService');
const tripState = require('./tripState');

async function check() {
  const { rows } = await db.query(
    `SELECT t.id AS trip_id, t.bus_id, b.bus_number, b.status, ll.received_at, t.start_time
       FROM trips t
       JOIN buses b ON b.id = t.bus_id
       LEFT JOIN live_locations ll ON ll.bus_id = t.bus_id AND ll.trip_id = t.id
      WHERE t.status = 'ACTIVE'
        AND COALESCE(ll.received_at, t.start_time) < now() - make_interval(secs => $1)`,
    [env.BUS_OFFLINE_AFTER_SECONDS],
  );
  for (const r of rows) {
    if (r.status === 'OFFLINE') continue;
    await db.query(`UPDATE buses SET status = 'OFFLINE' WHERE id = $1`, [r.bus_id]);
    const state = await tripState.load(r.trip_id);
    if (state) state.offline = true;
    realtime.toBusAndAdmins(r.bus_id, 'bus:status', {
      busId: Number(r.bus_id), status: 'OFFLINE', lastSeen: r.received_at, at: new Date().toISOString(),
    });
    await alertService.raise({
      busId: r.bus_id, tripId: r.trip_id, type: 'BUS_OFFLINE', severity: 'CRITICAL',
      message: `${r.bus_number} stopped sending location (no update for over ${env.BUS_OFFLINE_AFTER_SECONDS} s).`,
    });
  }
}

function start() {
  const timer = setInterval(() => check().catch((e) => console.warn('[offline-monitor]', e.message)), 15000);
  timer.unref();
  return timer;
}

module.exports = { start, check };
