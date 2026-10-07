const test = require('node:test');
const assert = require('node:assert');
const { haversine, buildPolyline, locateOnPolyline, accuracyLevel } = require('../src/utils/geo');

test('haversine: 1 degree of latitude is about 111 km', () => {
  const d = haversine({ lat: 13, lng: 80 }, { lat: 14, lng: 80 });
  assert.ok(Math.abs(d - 111195) < 200, `got ${d}`);
});

test('locateOnPolyline finds distance along an L-shaped route', () => {
  const poly = buildPolyline([{ lat: 13, lng: 80 }, { lat: 13.01, lng: 80 }, { lat: 13.01, lng: 80.01 }]);
  const first = haversine({ lat: 13, lng: 80 }, { lat: 13.01, lng: 80 });
  const loc = locateOnPolyline(poly, { lat: 13.0101, lng: 80.005 }); // half way along leg 2, slightly off
  const expected = first + haversine({ lat: 13.01, lng: 80 }, { lat: 13.01, lng: 80.005 });
  assert.ok(Math.abs(loc.along - expected) < 15, `along ${loc.along} vs ${expected}`);
  assert.ok(loc.offRoute > 5 && loc.offRoute < 20, `offRoute ${loc.offRoute}`);
});

test('accuracyLevel matches spec bands', () => {
  assert.equal(accuracyLevel(8), 'EXCELLENT');
  assert.equal(accuracyLevel(20), 'GOOD');
  assert.equal(accuracyLevel(42), 'FAIR');
  assert.equal(accuracyLevel(150), 'POOR');
  assert.equal(accuracyLevel(null), 'UNKNOWN');
});
