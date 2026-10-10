const db = require('../config/db');

// A student's bus is assigned_bus_id if set, otherwise the first bus on their route.
const SELECT = `
  SELECT s.*, u.name, u.email, u.phone, u.is_active, u.notifications_enabled, u.alert_minutes,
         r.route_name, st.stop_name AS assigned_stop_name,
         COALESCE(s.assigned_bus_id, rb.id) AS bus_id,
         COALESCE(ab.bus_number, rb.bus_number) AS bus_number
    FROM students s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN routes r ON r.id = s.assigned_route_id
    LEFT JOIN stops st ON st.id = s.assigned_stop_id
    LEFT JOIN buses ab ON ab.id = s.assigned_bus_id
    LEFT JOIN LATERAL (SELECT id, bus_number FROM buses WHERE route_id = s.assigned_route_id ORDER BY bus_number LIMIT 1) rb ON TRUE`;

async function list(filters = {}) {
  const where = [];
  const params = [];
  if (filters.search) {
    params.push(`%${filters.search}%`);
    where.push(`(u.name ILIKE $${params.length} OR s.student_id ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
  }
  if (filters.department) { params.push(filters.department); where.push(`s.department = $${params.length}`); }
  if (filters.year) { params.push(filters.year); where.push(`s.year = $${params.length}`); }
  if (filters.routeId) { params.push(filters.routeId); where.push(`s.assigned_route_id = $${params.length}`); }
  const { rows } = await db.query(
    `${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY u.name LIMIT 500`,
    params,
  );
  return rows;
}

async function findById(id) {
  const { rows } = await db.query(`${SELECT} WHERE s.id = $1`, [id]);
  return rows[0] || null;
}

async function findByUserId(userId) {
  const { rows } = await db.query(`${SELECT} WHERE s.user_id = $1`, [userId]);
  return rows[0] || null;
}

/** Users who should hear about a bus: students on its route or assigned to it directly. */
async function listForBus(busId, routeId) {
  const { rows } = await db.query(
    `SELECT s.id AS student_id, s.assigned_stop_id, u.id AS user_id, u.fcm_token, u.notifications_enabled, u.alert_minutes
       FROM students s JOIN users u ON u.id = s.user_id
      WHERE u.is_active AND (s.assigned_bus_id = $1 OR (s.assigned_bus_id IS NULL AND s.assigned_route_id = $2))`,
    [busId, routeId],
  );
  return rows;
}

const FIELDS = ['student_id', 'department', 'year', 'assigned_route_id', 'assigned_stop_id', 'assigned_bus_id'];

async function create(userId, data, client = db) {
  const cols = FIELDS.filter((f) => data[f] !== undefined);
  const { rows } = await client.query(
    `INSERT INTO students (user_id, ${cols.join(',')}) VALUES ($1, ${cols.map((_, i) => `$${i + 2}`).join(',')}) RETURNING id`,
    [userId, ...cols.map((c) => data[c])],
  );
  return rows[0].id;
}

async function update(id, data, client = db) {
  const cols = FIELDS.filter((f) => data[f] !== undefined);
  if (!cols.length) return;
  await client.query(
    `UPDATE students SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')} WHERE id = $1`,
    [id, ...cols.map((c) => data[c])],
  );
}

module.exports = { list, findById, findByUserId, listForBus, create, update };
