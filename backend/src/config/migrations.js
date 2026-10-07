// Applies database/migrations/*.sql in order, once each.
// Used by `npm run db:migrate` and automatically when the server starts (so Render stays up to date).
const fs = require('fs');
const path = require('path');
const db = require('./db');

const DIR = path.join(__dirname, '..', '..', '..', 'database', 'migrations');

async function runMigrations(log = console.log) {
  if (!fs.existsSync(DIR)) {
    log(`[migrate] folder not found (${DIR}), skipped`);
    return 0;
  }
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const { rows } = await db.query('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name));
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(DIR, file), 'utf8');
    await db.withTransaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    });
    log(`[migrate] applied ${file}`);
    count += 1;
  }
  log(count ? `[migrate] done (${count} new)` : '[migrate] database already up to date');
  return count;
}

module.exports = { runMigrations };
