// Real app + real middleware, database mocked. Usage: node --test test/trips.test.js
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-0123';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
const test = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');

let calls = [];
let reply = () => ({ rows: [], rowCount: 0 });
const query = async (sql, params) => { calls.push({ sql, params }); return reply(sql, params); };
const dbPath = require.resolve('../src/config/db');
require.cache[dbPath] = {
  id: dbPath, filename: dbPath, loaded: true,
  exports: { pool: {}, query, withTransaction: (fn) => fn({ query }), checkConnection: async () => new Date() },
};
const app = require('../src/app');

let server;
let base;
test.before(() => new Promise((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}/api`; r(); }); }));
test.after(() => server.close());
test.beforeEach(() => { calls = []; reply = () => ({ rows: [], rowCount: 0 }); });

const token = (role) => jwt.sign({ sub: '7', role, name: 'T' }, process.env.JWT_SECRET);
const call = async (method, path, role, body) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(role ? { authorization: `Bearer ${token(role)}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const rows = (r) => ({ rows: r, rowCount: r.length });

const DRIVER = { id: 3, user_id: 7, status: 'ACTIVE', is_active: true };
const BUS = { id: 1, bus_number: 'B1', driver_id: 3, route_id: 2, status: 'INACTIVE' };
const TRIP = { id: 11, bus_id: 1, bus_number: 'B1', driver_id: 3, route_id: 2, status: 'ACTIVE', direction: 'TO_COLLEGE', is_simulation: false };

/** Mock database: answers each query from the SQL text. */
function world({ driver = DRIVER, bus = BUS, activeTrip = null, trip = TRIP } = {}) {
  reply = (sql, params) => {
    if (sql.includes('FROM drivers d')) return rows(driver ? [driver] : []);
    if (sql.includes('FROM buses b')) return rows(bus ? [bus] : []);
    if (sql.includes('INSERT INTO trips')) return rows([{ id: 11 }]);
    if (sql.includes("t.bus_id = $1 AND t.status = 'ACTIVE'")) return rows(activeTrip ? [activeTrip] : []);
    if (sql.includes('WHERE t.id = $1')) {
      const insert = calls.find((c) => c.sql.includes('INSERT INTO trips'));
      return rows(trip ? [{ ...trip, id: params[0], ...(insert ? { direction: insert.params[4] } : {}) }] : []);
    }
    return rows([]);
  };
}
const insertParams = () => calls.find((c) => c.sql.includes('INSERT INTO trips'))?.params;

test('trip endpoints: no token 401, student/admin cannot start 403', async () => {
  assert.equal((await call('GET', '/trips/active')).status, 401);
  assert.equal((await call('POST', '/trips/start', 'STUDENT', { busId: 1 })).status, 403);
  assert.equal((await call('POST', '/trips/start', 'ADMIN', { busId: 1 })).status, 403);
  assert.equal(calls.length, 0);
});

test('start: disabled driver 403, bus of another driver 403', async () => {
  world({ driver: { ...DRIVER, status: 'INACTIVE' } });
  assert.equal((await call('POST', '/trips/start', 'DRIVER', { busId: 1 })).status, 403);
  world({ bus: { ...BUS, driver_id: 99 } });
  assert.equal((await call('POST', '/trips/start', 'DRIVER', { busId: 1 })).status, 403);
  assert.equal(insertParams(), undefined);
});

test('start: missing bus 404, no route 400, maintenance 400, bus busy with another driver 409', async () => {
  world({ bus: null });
  assert.equal((await call('POST', '/trips/start', 'DRIVER', { busId: 1 })).status, 404);
  world({ bus: { ...BUS, route_id: null } });
  assert.match((await call('POST', '/trips/start', 'DRIVER', { busId: 1 })).body.error.message, /no route/);
  world({ bus: { ...BUS, status: 'MAINTENANCE' } });
  assert.match((await call('POST', '/trips/start', 'DRIVER', { busId: 1 })).body.error.message, /maintenance/);
  world({ activeTrip: { ...TRIP, driver_id: 99 } });
  assert.equal((await call('POST', '/trips/start', 'DRIVER', { busId: 1 })).status, 409);
  assert.equal(insertParams(), undefined);
});

test('start: direction defaults to TO_COLLEGE and is stored with a parameterized insert', async () => {
  world();
  const r = await call('POST', '/trips/start', 'DRIVER', { busId: 1 });
  assert.equal(r.status, 201);
  assert.equal(r.body.trip.bus_number, 'B1');
  assert.equal(r.body.trip.direction, 'TO_COLLEGE');
  assert.deepEqual(insertParams(), [1, 3, 2, false, 'TO_COLLEGE']);
});

test('start: FROM_COLLEGE is accepted, an unknown direction is rejected', async () => {
  world();
  const r = await call('POST', '/trips/start', 'DRIVER', { busId: 1, direction: 'FROM_COLLEGE' });
  assert.equal(r.status, 201);
  assert.equal(r.body.trip.direction, 'FROM_COLLEGE');
  assert.deepEqual(insertParams(), [1, 3, 2, false, 'FROM_COLLEGE']);

  calls = [];
  assert.equal((await call('POST', '/trips/start', 'DRIVER', { busId: 1, direction: 'SIDEWAYS' })).status, 400);
  assert.equal(insertParams(), undefined);
});

test('start: same driver re-opening the app resumes the active trip (200, no new insert)', async () => {
  world({ activeTrip: { ...TRIP, direction: 'FROM_COLLEGE' } });
  const r = await call('POST', '/trips/start', 'DRIVER', { busId: 1 });
  assert.equal(r.status, 200);
  assert.equal(r.body.resumed, true);
  assert.equal(r.body.trip.direction, 'FROM_COLLEGE');
  assert.equal(insertParams(), undefined);
});

test("end: missing trip 404, finished trip 400, another driver's trip 403, active trip 200", async () => {
  world({ trip: null });
  assert.equal((await call('POST', '/trips/end', 'DRIVER', { tripId: 5 })).status, 404);
  world({ trip: { ...TRIP, status: 'COMPLETED' } });
  assert.equal((await call('POST', '/trips/end', 'DRIVER', { tripId: 5 })).status, 400);
  world({ trip: { ...TRIP, driver_id: 99 } });
  assert.equal((await call('POST', '/trips/end', 'DRIVER', { tripId: 5 })).status, 403);
  world();
  const r = await call('POST', '/trips/end', 'DRIVER', { tripId: 5 });
  assert.equal(r.status, 200);
  assert.ok(calls.some((c) => c.sql.includes("SET status = 'COMPLETED'")));
  assert.equal((await call('POST', '/trips/end', 'DRIVER', { tripId: 'abc' })).status, 400);
});
