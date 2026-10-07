const http = require('http');
const env = require('./config/env');
const app = require('./app');
const db = require('./config/db');
const { initSockets } = require('./sockets');
const notificationService = require('./services/notificationService');
const offlineMonitor = require('./services/offlineMonitor');

async function main() {
  try {
    const now = await db.checkConnection();
    console.log(`[db] connected (server time ${new Date(now).toISOString()})`);
  } catch (err) {
    console.error('[db] could not connect:', err.message);
    console.error('     Check DATABASE_URL in backend/.env, then run: npm run db:migrate');
    process.exit(1);
  }

  notificationService.initFirebase();
  const server = http.createServer(app);
  initSockets(server);
  offlineMonitor.start();

  // 0.0.0.0 so phones on the same Wi-Fi can reach the laptop.
  server.listen(env.PORT, '0.0.0.0', () => {
    console.log(`[api] BusMate backend on http://localhost:${env.PORT}  (health: /api/health)`);
    if (env.allowSimulation) console.log('[api] ALLOW_SIMULATION=true: DEMO / SIMULATION trips are allowed.');
  });

  const shutdown = () => {
    console.log('\n[api] shutting down...');
    server.close(() => db.pool.end().then(() => process.exit(0)));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
