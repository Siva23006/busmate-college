// Small admin-editable settings (app_settings table) with a short in-memory cache.
const db = require('../config/db');
const env = require('../config/env');

const CACHE_MS = 30 * 1000;
const cache = new Map(); // key -> { value, at }

async function get(key, fallback) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const { rows } = await db.query('SELECT value FROM app_settings WHERE key = $1', [key]);
  const value = rows[0] ? rows[0].value : fallback;
  cache.set(key, { value, at: Date.now() });
  return value;
}

async function set(key, value) {
  await db.query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
  cache.set(key, { value, at: Date.now() });
}

/** Default speed limit for all buses (km/h). */
async function defaultSpeedLimit() {
  return Number(await get('default_speed_limit_kmh', env.OVERSPEED_KMH)) || env.OVERSPEED_KMH;
}

/** The limit that applies to one bus: its own limit, else the default. */
async function speedLimitFor(busSpeedLimit) {
  return busSpeedLimit ? Number(busSpeedLimit) : defaultSpeedLimit();
}

module.exports = { get, set, defaultSpeedLimit, speedLimitFor };
