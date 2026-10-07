const test = require('node:test');
const assert = require('node:assert');
const { buildRouteGeometry, computeEta, stopsInTravelOrder } = require('../src/services/etaEngine');

// Stops stored in TO_COLLEGE order: Stop 1 (south) ... Stop 4 = college (north). Test fixture only.
const stops = [0, 1, 2, 3].map((i) => ({
  id: i + 1, stop_name: i === 3 ? 'College' : `Stop ${i + 1}`, stop_order: i + 1,
  latitude: 13 + i * 0.01, longitude: 80, geofence_radius: 100,
}));
// An L-shaped road line (not the straight line between stops), in TO_COLLEGE order.
const path = [[13, 80], [13, 80.002], [13.03, 80.002], [13.03, 80]];
const now = new Date('2026-10-07T16:00:00Z');

test('stops are visited in reverse for FROM_COLLEGE and renumbered from 1', () => {
  assert.deepEqual(stopsInTravelOrder(stops, 'TO_COLLEGE').map((s) => s.id), [1, 2, 3, 4]);
  const back = stopsInTravelOrder(stops, 'FROM_COLLEGE');
  assert.deepEqual(back.map((s) => s.id), [4, 3, 2, 1]);
  assert.deepEqual(back.map((s) => s.travel_order), [1, 2, 3, 4]);
});

test('FROM_COLLEGE geometry starts at the college and reverses the road path', () => {
  const geom = buildRouteGeometry(path, stops, 'FROM_COLLEGE');
  assert.deepEqual(geom.poly.points[0], { lat: 13.03, lng: 80 });
  assert.deepEqual(geom.poly.points.at(-1), { lat: 13, lng: 80 });
  assert.equal(geom.stops[0].stop_name, 'College');
  assert.ok(geom.stops[0].along < 1);
  for (let i = 1; i < geom.stops.length; i++) assert.ok(geom.stops[i].along > geom.stops[i - 1].along);
  // Same road, same length in both directions.
  assert.ok(Math.abs(geom.poly.length - buildRouteGeometry(path, stops).poly.length) < 1);
});

test('FROM_COLLEGE: next stop and destination follow the reversed order', () => {
  const geom = buildRouteGeometry(null, stops, 'FROM_COLLEGE');
  // Bus has left the college and is between stop 3 and stop 2, heading south.
  const eta = computeEta(geom, { lat: 13.015, lng: 80 }, { now, visitedStopIds: new Set(['4']) });
  assert.equal(eta.nextStop.stopId, 2);
  assert.equal(eta.nextStop.stopOrder, 3); // third stop of the evening run
  assert.equal(eta.destination.stopId, 1);
  assert.deepEqual(eta.stops.map((s) => s.stopId), [4, 3, 2, 1]);
  assert.deepEqual(eta.stops.map((s) => s.passed), [true, true, false, false]);
});

test('the same position gives opposite next stops in the two directions', () => {
  const position = { lat: 13.015, lng: 80 };
  const morning = computeEta(buildRouteGeometry(null, stops, 'TO_COLLEGE'), position, { now });
  const evening = computeEta(buildRouteGeometry(null, stops, 'FROM_COLLEGE'), position, { now });
  assert.equal(morning.nextStop.stopId, 3);
  assert.equal(evening.nextStop.stopId, 2);
  assert.equal(morning.destination.stopName, 'College');
  assert.equal(evening.destination.stopName, 'Stop 1');
});
