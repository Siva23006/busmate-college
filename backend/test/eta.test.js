const test = require('node:test');
const assert = require('node:assert');
const { buildRouteGeometry, computeEta } = require('../src/services/etaEngine');

// Straight north-south test line, stops every ~1.1 km (test fixture only).
const stops = [0, 1, 2, 3].map((i) => ({
  id: i + 1, stop_name: `Stop ${i + 1}`, stop_order: i + 1,
  latitude: 13 + i * 0.01, longitude: 80, geofence_radius: 100,
}));
const geom = buildRouteGeometry(null, stops);
const now = new Date('2026-10-07T08:00:00Z');

test('next stop and remaining distance', () => {
  const eta = computeEta(geom, { lat: 13.005, lng: 80 }, { now, defaultSpeedKmh: 36, dwellSeconds: 0 });
  assert.equal(eta.label, 'Estimated arrival');
  assert.equal(eta.nextStop.stopId, 2);
  assert.ok(Math.abs(eta.nextStop.remainingMeters - 556) < 10, `${eta.nextStop.remainingMeters}`);
  // 36 km/h = 10 m/s, ~556 m => ~56 s
  assert.ok(Math.abs(eta.nextStop.etaSeconds - 56) <= 2, `${eta.nextStop.etaSeconds}`);
  assert.equal(eta.stops[0].passed, true);
});

test('ETA shrinks as bus moves forward', () => {
  const a = computeEta(geom, { lat: 13.002, lng: 80 }, { now });
  const b = computeEta(geom, { lat: 13.008, lng: 80 }, { now });
  assert.ok(b.destination.etaSeconds < a.destination.etaSeconds);
});

test('dwell time is added for stops in between', () => {
  const eta = computeEta(geom, { lat: 13.0, lng: 80 }, { now, defaultSpeedKmh: 36, dwellSeconds: 30 });
  const s4 = eta.stops.find((s) => s.stopId === 4);
  const s2 = eta.stops.find((s) => s.stopId === 2);
  assert.ok(s4.etaSeconds - s2.etaSeconds > 2 * 111 + 50); // travel + 2 dwells
});

test('stops marked visited by geofence count as passed', () => {
  const eta = computeEta(geom, { lat: 13.0, lng: 80 }, { now, visitedStopIds: new Set(['1', '2']) });
  assert.equal(eta.nextStop.stopId, 3);
});

test('at the destination: 0 m left; once geofence marks it visited, no next stop', () => {
  const at = computeEta(geom, { lat: 13.03, lng: 80 }, { now, visitedStopIds: new Set(['1', '2', '3']) });
  assert.equal(at.destination.remainingMeters, 0);
  const eta = computeEta(geom, { lat: 13.03, lng: 80 }, { now, visitedStopIds: new Set(['1', '2', '3', '4']) });
  assert.equal(eta.destination, null);
  assert.equal(eta.nextStop, null);
});
