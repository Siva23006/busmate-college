// DEMO / SIMULATION seed. Everything created here is flagged is_demo = TRUE and named "DEMO".
// It is for trying the system before you enter your real buses, routes and stops.
// Remove it any time with:  npm run db:seed:demo -- --remove
const bcrypt = require('bcryptjs');
const db = require('../src/config/db');
const roadRouteService = require('../src/services/roadRouteService');

const PASSWORD = process.env.DEMO_PASSWORD || 'Demo@12345';

// DEMO coordinates only (approximate points north of Chennai). Replace with your real stops in the admin dashboard.
const DEMO_STOPS = [
  ['DEMO Madhavaram', 13.1488, 80.2306, '07:00'],
  ['DEMO Redhills', 13.1916, 80.1847, '07:12'],
  ['DEMO Karanodai', 13.2561, 80.1683, '07:25'],
  ['DEMO Kavaraipettai', 13.3480, 80.1388, '07:40'],
  ['DEMO Gummidipoondi', 13.4073, 80.1095, '07:52'],
  ['DEMO College', 13.4410, 80.1010, '08:05'],
];

async function remove(client) {
  await client.query('DELETE FROM buses WHERE is_demo');
  await client.query('DELETE FROM routes WHERE is_demo');
  await client.query('DELETE FROM users WHERE is_demo');
}

(async () => {
  try {
    let demoRouteId = null;
    await db.withTransaction(async (client) => {
      await remove(client);
      if (process.argv.includes('--remove')) { console.log('[demo] demo data removed'); return; }

      const hash = await bcrypt.hash(PASSWORD, 12);
      const mkUser = async (name, email, role) => (await client.query(
        `INSERT INTO users (name, email, password_hash, role, is_demo) VALUES ($1,$2,$3,$4,TRUE) RETURNING id`,
        [name, email, hash, role])).rows[0].id;

      const routeId = (await client.query(
        `INSERT INTO routes (route_name, description, start_location, destination, is_demo)
         VALUES ('DEMO Route A', 'DEMO / SIMULATION route for testing', 'DEMO Madhavaram', 'DEMO College', TRUE) RETURNING id`)).rows[0].id;
      demoRouteId = routeId;
      const stopIds = [];
      for (let i = 0; i < DEMO_STOPS.length; i++) {
        const [name, lat, lng, time] = DEMO_STOPS[i];
        stopIds.push((await client.query(
          `INSERT INTO stops (route_id, stop_name, latitude, longitude, stop_order, geofence_radius, estimated_time)
           VALUES ($1,$2,$3,$4,$5,150,$6) RETURNING id`, [routeId, name, lat, lng, i + 1, time])).rows[0].id);
      }

      const driverUser = await mkUser('DEMO Driver', 'demo.driver@busmate.local', 'DRIVER');
      const driverId = (await client.query(
        `INSERT INTO drivers (user_id, employee_id, license_number, phone) VALUES ($1,'DEMO-DRV-01','DEMO-LICENSE','0000000000') RETURNING id`,
        [driverUser])).rows[0].id;

      await client.query(
        `INSERT INTO buses (bus_number, registration_number, capacity, status, driver_id, route_id, is_demo)
         VALUES ('DEMO BUS 01', 'DEMO-REG-01', 50, 'INACTIVE', $1, $2, TRUE)`, [driverId, routeId]);

      const studentUser = await mkUser('DEMO Student', 'demo.student@busmate.local', 'STUDENT');
      await client.query(
        `INSERT INTO students (user_id, student_id, department, year, assigned_route_id, assigned_stop_id)
         VALUES ($1,'DEMO-STU-01','DEMO Dept',2,$2,$3)`, [studentUser, routeId, stopIds[4]]);

      await mkUser('DEMO Admin', 'demo.admin@busmate.local', 'ADMIN');
    });
    if (demoRouteId) {
      // Make the demo route follow real roads (falls back to straight lines if OSRM is unreachable).
      const road = await roadRouteService.regenerate(demoRouteId);
      console.log(road.ok ? `[demo] road route generated (${road.points} points)` : `[demo] ${road.message}`);
    }
    if (!process.argv.includes('--remove')) {
      console.log('[demo] DEMO data created (all labeled DEMO). Logins (password for all: %s):', PASSWORD);
      console.log('       admin   : demo.admin@busmate.local');
      console.log('       driver  : DEMO-DRV-01   (or demo.driver@busmate.local)');
      console.log('       student : DEMO-STU-01   (or demo.student@busmate.local)');
    }
  } catch (err) {
    console.error('[demo] failed:', err.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
