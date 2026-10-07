const { Pool, types } = require('pg');
const env = require('./env');

// BIGINT ids come back as strings by default; our ids are far below 2^53, so use numbers.
types.setTypeParser(20, (v) => parseInt(v, 10));
// DATE columns stay as 'YYYY-MM-DD' strings (avoids timezone shifts, e.g. IST vs UTC).
types.setTypeParser(1082, (v) => v);

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => console.error('[db] idle client error:', err.message));

const query = (text, params) => pool.query(text, params);

/** Run fn(client) inside a transaction. */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function checkConnection() {
  const { rows } = await pool.query('SELECT now() AS now');
  return rows[0].now;
}

module.exports = { pool, query, withTransaction, checkConnection };
