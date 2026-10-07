// Applies database/migrations/*.sql in order, once each. Usage: npm run db:migrate
const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

const DIR = path.join(__dirname, '..', '..', 'database', 'migrations');

(async () => {
  try {
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
      console.log(`[migrate] applied ${file}`);
      count += 1;
    }
    console.log(count ? `[migrate] done (${count} new)` : '[migrate] database already up to date');
  } catch (err) {
    console.error('[migrate] failed:', err.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
