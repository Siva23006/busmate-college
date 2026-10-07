// Road routing (OSRM) with the database and the network mocked.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-0123';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
const test = require('node:test');
const assert = require('node:assert');

let calls = [];
let stops = [];
const query = async (sql, params) => {
  calls.push({ sql, params });
  return sql.includes('FROM stops') ? { rows: stops, rowCount: stops.length } : { rows: [], rowCount: 1 };
};
const dbPath = require.resolve('../src/config/db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { pool: {}, query, withTransaction: (fn) => fn({ query }) } };
const road = require('../src/services/roadRouteService');

const STOPS = [
  { id: 1, stop_order: 1, latitude: 13.1488, longitude: 80.2306 },
  { id: 2, stop_order: 2, latitude: 13.1916, longitude: 80.1847 },
];
const realFetch = global.fetch;
const realWarn = console.warn;
test.beforeEach(() => { calls = []; stops = STOPS; console.warn = () => {}; });
test.afterEach(() => { global.fetch = realFetch; console.warn = realWarn; });
const saved = () => calls.find((c) => c.sql.includes('UPDATE routes SET path'));

test('buildUrl sends the stops in order as lng,lat pairs', () => {
  assert.match(road.buildUrl(STOPS), /\/route\/v1\/driving\/80\.230600,13\.148800;80\.184700,13\.191600\?overview=full&geometries=geojson$/);
});

test('parsePath turns OSRM [lng,lat] into [lat,lng] and rejects bad replies', () => {
  const ok = { code: 'Ok', routes: [{ geometry: { coordinates: [[80.23, 13.14], [80.2, 13.17], [80.18, 13.19]] } }] };
  assert.deepEqual(road.parsePath(ok), [[13.14, 80.23], [13.17, 80.2], [13.19, 80.18]]);
  assert.equal(road.parsePath({ code: 'NoRoute', routes: [] }), null);
  assert.equal(road.parsePath({ code: 'Ok', routes: [{ geometry: { coordinates: [[80, 13]] } }] }), null);
  assert.equal(road.parsePath(null), null);
});

test('regenerate saves the road line returned by OSRM', async () => {
  let requested;
  global.fetch = async (url) => {
    requested = url;
    return { ok: true, json: async () => ({ code: 'Ok', routes: [{ geometry: { coordinates: [[80.2306, 13.1488], [80.21, 13.17], [80.1847, 13.1916]] } }] }) };
  };
  const result = await road.regenerate(5);
  assert.deepEqual(result, { ok: true, points: 3, message: 'Road route updated.' });
  assert.match(requested, /router\.project-osrm\.org/);
  assert.deepEqual(saved().params, [5, JSON.stringify([[13.1488, 80.2306], [13.17, 80.21], [13.1916, 80.1847]])]);
});

test('OSRM failure never throws: the path is cleared so stops are joined by straight lines', async () => {
  global.fetch = async () => { throw new Error('network down'); };
  const result = await road.regenerate(5);
  assert.equal(result.ok, false);
  assert.deepEqual(saved().params, [5, null]);

  calls = [];
  global.fetch = async () => ({ ok: false, status: 429 });
  assert.equal((await road.regenerate(5)).ok, false);
  assert.deepEqual(saved().params, [5, null]);
});

test('manual regenerate keeps the existing line when OSRM fails', async () => {
  global.fetch = async () => { throw new Error('network down'); };
  const result = await road.regenerate(5, { clearOnFailure: false });
  assert.equal(result.ok, false);
  assert.equal(saved(), undefined);
});

test('fewer than 2 stops: OSRM is not called and the path is cleared', async () => {
  stops = STOPS.slice(0, 1);
  global.fetch = async () => { throw new Error('must not be called'); };
  const result = await road.regenerate(5);
  assert.equal(result.ok, false);
  assert.deepEqual(saved().params, [5, null]);
});
