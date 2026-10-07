const db = require('../config/db');

const SELECT = `
  SELECT t.*, b.bus_number, r.route_name, u.name AS driver_name,
         EXTRACT(EPOCH FROM (COALESCE(t.end_time, now()) - t.start_time))::int AS duration_seconds,
         (SELECT count(*)::int FROM trip_stop_events e WHERE e.trip_id = t.id AND e.arrived_at IS NOT NULL) AS stops_reached,
         (SELECT count(*)::int FROM stops s WHERE s.route_id = t.route_id) AS stops_total
    FROM trips t
    JOIN buses b ON b.id = t.bus_id
    LEFT JOIN routes r  ON r.id = t.route_id
    LEFT JOIN drivers d ON d.id = t.driver_id
    LEFT JOIN users u   ON u.id = d.user_id`;

async function list({ status, busId, date, limit = 50, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (status) { params.push(status); where.push(`t.status = $${params.length}`); }
  if (busId) { params.push(busId); where.push(`t.bus_id = $${params.length}`); }
  if (date) { params.push(date); where.push(`t.trip_date = $${params.length}`); }
  params.push(limit, offset);
  const { rows } = await db.query(
    `${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY t.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}

async function findById(id) {
  const { rows } = await db.query(`${SELECT} WHERE t.id = $1`, [id]);
  return rows[0] || null;
}

async function findActiveByBus(busId) {
  const { rows } = await db.query(`${SELECT} WHERE t.bus_id = $1 AND t.status = 'ACTIVE'`, [busId]);
  return rows[0] || null;
}

async function listActive() {
  const { rows } = await db.query(`${SELECT} WHERE t.status = 'ACTIVE'`);
  return rows;
}

async function createActive({ busId, driverId, routeId, isSimulation, direction = 'TO_COLLEGE' }, client = db) {
  const { rows } = await client.query(
    `INSERT INTO trips (bus_id, driver_id, route_id, trip_date, start_time, status, is_simulation, direction)
     VALUES ($1, $2, $3, CURRENT_DATE, now(), 'ACTIVE', $4, $5) RETURNING id`,
    [busId, driverId, routeId, !!isSimulation, direction],
  );
  return rows[0].id;
}

async function complete(id, distanceMeters, client = db) {
  await client.query(
    `UPDATE trips t SET status = 'COMPLETED', end_time = now(), distance_meters = $2,
            end_latitude = ll.latitude, end_longitude = ll.longitude
       FROM (SELECT $1::bigint AS trip_id) x
       LEFT JOIN live_locations ll ON ll.trip_id = x.trip_id
      WHERE t.id = $1`,
    [id, distanceMeters],
  );
}

/** Ordered reliable points of a trip, for replay and distance. */
async function path(tripId) {
  const { rows } = await db.query(
    `SELECT latitude, longitude, accuracy, speed, heading, timestamp, is_reliable
       FROM location_history WHERE trip_id = $1 ORDER BY timestamp`,
    [tripId],
  );
  return rows;
}

/** Stop arrivals in the order the bus visited them; stop_order is the number along that direction. */
async function stopEvents(tripId, direction = 'TO_COLLEGE') {
  const { rows } = await db.query(
    `SELECT e.*, s.stop_name, s.stop_order,
            (SELECT max(x.stop_order) FROM stops x WHERE x.route_id = s.route_id) AS last_order
       FROM trip_stop_events e JOIN stops s ON s.id = e.stop_id
      WHERE e.trip_id = $1 ORDER BY s.stop_order`,
    [tripId],
  );
  const events = rows.map(({ last_order: lastOrder, ...e }) => (
    direction === 'FROM_COLLEGE' ? { ...e, stop_order: lastOrder - e.stop_order + 1 } : e));
  return direction === 'FROM_COLLEGE' ? events.reverse() : events;
}

/** All trips of one bus on one date (oldest first), for the Track Bus timeline. */
async function listForBusDay(busId, date) {
  const { rows } = await db.query(
    `${SELECT} WHERE t.bus_id = $1 AND t.trip_date = $2 ORDER BY t.start_time NULLS LAST, t.id`,
    [busId, date],
  );
  return rows;
}

/** Dates with trips for a bus (latest first), for the date picker. */
async function daysForBus(busId, limit = 30) {
  const { rows } = await db.query(
    `SELECT trip_date, count(*)::int AS trips FROM trips WHERE bus_id = $1
      GROUP BY trip_date ORDER BY trip_date DESC LIMIT $2`,
    [busId, limit],
  );
  return rows;
}

module.exports = { listForBusDay, daysForBus, list, findById, findActiveByBus, listActive, createActive, complete, path, stopEvents };
