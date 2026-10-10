const db = require('../config/db');

const PUBLIC_COLS = 'id, name, email, phone, role, is_active, notifications_enabled, created_at, updated_at';

/** Finds a login account by email, driver employee ID, or student ID (case-insensitive). */
async function findForLogin(identifier) {
  const { rows } = await db.query(
    `SELECT u.* FROM users u
       LEFT JOIN drivers d  ON d.user_id = u.id
       LEFT JOIN students s ON s.user_id = u.id
      WHERE lower(u.email) = lower($1) OR lower(d.employee_id) = lower($1) OR lower(s.student_id) = lower($1)
      LIMIT 1`,
    [identifier],
  );
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await db.query(`SELECT ${PUBLIC_COLS} FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function create({ name, email, phone, password_hash, role }, client = db) {
  const { rows } = await client.query(
    `INSERT INTO users (name, email, phone, password_hash, role) VALUES ($1,$2,$3,$4,$5) RETURNING ${PUBLIC_COLS}`,
    [name, email || null, phone || null, password_hash, role],
  );
  return rows[0];
}

async function update(id, data, client = db) {
  const cols = ['name', 'email', 'phone', 'password_hash', 'is_active', 'fcm_token', 'notifications_enabled', 'alert_minutes']
    .filter((f) => data[f] !== undefined);
  if (!cols.length) return;
  await client.query(
    `UPDATE users SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')} WHERE id = $1`,
    [id, ...cols.map((c) => data[c])],
  );
}

module.exports = { findForLogin, findById, create, update };
