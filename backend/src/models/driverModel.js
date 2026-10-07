const db = require('../config/db');

const SELECT = `
  SELECT d.*, u.name, u.email, u.is_active,
         b.id AS bus_id, b.bus_number,
         t.id AS active_trip_id
    FROM drivers d
    JOIN users u ON u.id = d.user_id
    LEFT JOIN LATERAL (SELECT id, bus_number FROM buses WHERE driver_id = d.id ORDER BY bus_number LIMIT 1) b ON TRUE
    LEFT JOIN trips t ON t.driver_id = d.id AND t.status = 'ACTIVE'`;

async function list() {
  const { rows } = await db.query(`${SELECT} ORDER BY u.name`);
  return rows;
}

async function findById(id) {
  const { rows } = await db.query(`${SELECT} WHERE d.id = $1`, [id]);
  return rows[0] || null;
}

async function findByUserId(userId) {
  const { rows } = await db.query(`${SELECT} WHERE d.user_id = $1`, [userId]);
  return rows[0] || null;
}

async function create(userId, data, client = db) {
  const { rows } = await client.query(
    `INSERT INTO drivers (user_id, employee_id, license_number, phone, status)
     VALUES ($1,$2,$3,$4,COALESCE($5::driver_status, 'ACTIVE')) RETURNING id`,
    [userId, data.employee_id, data.license_number || null, data.phone || null, data.status || null],
  );
  return rows[0].id;
}

async function update(id, data, client = db) {
  const cols = ['employee_id', 'license_number', 'phone', 'status'].filter((f) => data[f] !== undefined);
  if (!cols.length) return;
  await client.query(
    `UPDATE drivers SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')} WHERE id = $1`,
    [id, ...cols.map((c) => data[c])],
  );
}

module.exports = { list, findById, findByUserId, create, update };
