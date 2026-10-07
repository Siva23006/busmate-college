const db = require('../config/db');

const BUS_SELECT = `
  SELECT b.*,
         u.name           AS driver_name,
         d.employee_id    AS driver_employee_id,
         d.phone          AS driver_phone,
         r.route_name,
         t.id             AS active_trip_id,
         t.start_time     AS active_trip_start,
         t.is_simulation  AS active_trip_is_simulation,
         t.direction      AS active_trip_direction,
         t.start_latitude AS trip_start_latitude,
         t.start_longitude AS trip_start_longitude,
         r.start_location AS route_start,
         r.destination    AS route_destination,
         r.morning_time   AS route_morning_time,
         r.evening_time   AS route_evening_time,
         ll.latitude, ll.longitude, ll.accuracy, ll.speed, ll.heading,
         ll.timestamp     AS location_time,
         ll.is_simulation AS location_is_simulation
    FROM buses b
    LEFT JOIN drivers d        ON d.id = b.driver_id
    LEFT JOIN users u          ON u.id = d.user_id
    LEFT JOIN routes r         ON r.id = b.route_id
    LEFT JOIN trips t          ON t.bus_id = b.id AND t.status = 'ACTIVE'
    LEFT JOIN live_locations ll ON ll.bus_id = b.id`;

async function list() {
  const { rows } = await db.query(`${BUS_SELECT} ORDER BY b.bus_number`);
  return rows;
}

async function findById(id) {
  const { rows } = await db.query(`${BUS_SELECT} WHERE b.id = $1`, [id]);
  return rows[0] || null;
}

async function findByDriverId(driverId) {
  const { rows } = await db.query(`${BUS_SELECT} WHERE b.driver_id = $1 ORDER BY b.bus_number`, [driverId]);
  return rows;
}

async function findByRouteId(routeId) {
  const { rows } = await db.query(`${BUS_SELECT} WHERE b.route_id = $1 ORDER BY b.bus_number`, [routeId]);
  return rows;
}

const FIELDS = ['bus_number', 'registration_number', 'capacity', 'status', 'driver_id', 'route_id'];

async function create(data) {
  const cols = FIELDS.filter((f) => data[f] !== undefined);
  const { rows } = await db.query(
    `INSERT INTO buses (${cols.join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`,
    cols.map((c) => data[c]),
  );
  return findById(rows[0].id);
}

async function update(id, data, client = db) {
  const cols = FIELDS.filter((f) => data[f] !== undefined);
  if (cols.length) {
    const { rowCount } = await client.query(
      `UPDATE buses SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')} WHERE id = $1`,
      [id, ...cols.map((c) => data[c])],
    );
    if (!rowCount) return null;
  }
  return client === db ? findById(id) : true;
}

async function remove(id) {
  const { rowCount } = await db.query('DELETE FROM buses WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { list, findById, findByDriverId, findByRouteId, create, update, remove };
