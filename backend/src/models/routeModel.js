const db = require('../config/db');

async function list() {
  const { rows } = await db.query(`
    SELECT r.*,
           (SELECT count(*)::int FROM stops s WHERE s.route_id = r.id) AS stop_count,
           (SELECT json_agg(json_build_object('id', b.id, 'bus_number', b.bus_number) ORDER BY b.bus_number)
              FROM buses b WHERE b.route_id = r.id) AS buses
      FROM routes r ORDER BY r.route_name`);
  return rows;
}

async function findById(id) {
  const { rows } = await db.query('SELECT * FROM routes WHERE id = $1', [id]);
  if (!rows[0]) return null;
  return { ...rows[0], stops: await listStops(id) };
}

async function listStops(routeId) {
  const sql = routeId
    ? 'SELECT * FROM stops WHERE route_id = $1 ORDER BY stop_order, id'
    : 'SELECT * FROM stops ORDER BY route_id, stop_order, id';
  const { rows } = await db.query(sql, routeId ? [routeId] : []);
  return rows;
}

const ROUTE_FIELDS = ['route_name', 'description', 'start_location', 'destination', 'path', 'active', 'morning_time', 'evening_time'];
const prep = (c, v) => (c === 'path' && v != null ? JSON.stringify(v) : v);

async function create(data) {
  const cols = ROUTE_FIELDS.filter((f) => data[f] !== undefined);
  const { rows } = await db.query(
    `INSERT INTO routes (${cols.join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`,
    cols.map((c) => prep(c, data[c])),
  );
  return findById(rows[0].id);
}

async function update(id, data) {
  const cols = ROUTE_FIELDS.filter((f) => data[f] !== undefined);
  if (cols.length) {
    const { rowCount } = await db.query(
      `UPDATE routes SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')} WHERE id = $1`,
      [id, ...cols.map((c) => prep(c, data[c]))],
    );
    if (!rowCount) return null;
  }
  return findById(id);
}

async function remove(id) {
  const { rowCount } = await db.query('DELETE FROM routes WHERE id = $1', [id]);
  return rowCount > 0;
}

// ---------- stops ----------
const STOP_FIELDS = ['stop_name', 'latitude', 'longitude', 'stop_order', 'geofence_radius', 'estimated_time'];

async function findStop(id) {
  const { rows } = await db.query('SELECT * FROM stops WHERE id = $1', [id]);
  return rows[0] || null;
}

async function createStop(data) {
  let order = data.stop_order;
  if (order == null) {
    const { rows } = await db.query('SELECT COALESCE(max(stop_order), 0) + 1 AS next FROM stops WHERE route_id = $1', [data.route_id]);
    order = rows[0].next;
  }
  const { rows } = await db.query(
    `INSERT INTO stops (route_id, stop_name, latitude, longitude, stop_order, geofence_radius, estimated_time)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6,100),$7) RETURNING *`,
    [data.route_id, data.stop_name, data.latitude, data.longitude, order, data.geofence_radius ?? null, data.estimated_time ?? null],
  );
  return rows[0];
}

async function updateStop(id, data) {
  const cols = STOP_FIELDS.filter((f) => data[f] !== undefined);
  if (!cols.length) return findStop(id);
  const { rows } = await db.query(
    `UPDATE stops SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')} WHERE id = $1 RETURNING *`,
    [id, ...cols.map((c) => data[c])],
  );
  return rows[0] || null;
}

async function removeStop(id) {
  const { rows } = await db.query('DELETE FROM stops WHERE id = $1 RETURNING route_id', [id]);
  return rows[0] || null;
}

/** stopIds in the new order; all must belong to the route. */
async function reorderStops(routeId, stopIds) {
  return db.withTransaction(async (client) => {
    const { rows } = await client.query('SELECT id FROM stops WHERE route_id = $1', [routeId]);
    const existing = new Set(rows.map((r) => Number(r.id)));
    if (stopIds.length !== existing.size || !stopIds.every((s) => existing.has(Number(s)))) return false;
    for (let i = 0; i < stopIds.length; i++) {
      await client.query('UPDATE stops SET stop_order = $1 WHERE id = $2', [i + 1, stopIds[i]]);
    }
    return true;
  });
}

module.exports = { list, findById, listStops, create, update, remove, findStop, createStop, updateStop, removeStop, reorderStops };
