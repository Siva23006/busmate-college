// Creates the first (real) admin account.
// Usage: npm run create-admin -- "Your Name" admin@yourcollege.edu "StrongPassword123"
const bcrypt = require('bcryptjs');
const db = require('../src/config/db');

(async () => {
  const [name, email, password] = process.argv.slice(2);
  if (!name || !email || !password || password.length < 8) {
    console.error('Usage: npm run create-admin -- "Full Name" email@college.edu "password (8+ chars)"');
    process.exit(1);
  }
  try {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await db.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, lower($2), $3, 'ADMIN')
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'ADMIN', is_active = TRUE
       RETURNING id, email`,
      [name, email, hash],
    );
    console.log(`[admin] ready: ${rows[0].email} (id ${rows[0].id})`);
  } catch (err) {
    console.error('[admin] failed:', err.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
