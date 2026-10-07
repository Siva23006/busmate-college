// Applies database/migrations/*.sql in order, once each. Usage: npm run db:migrate
// (The server also does this automatically when it starts.)
const db = require('../src/config/db');
const { runMigrations } = require('../src/config/migrations');

(async () => {
  try {
    await runMigrations();
  } catch (err) {
    console.error('[migrate] failed:', err.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
