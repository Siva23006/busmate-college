const test = require('node:test');
const assert = require('node:assert');
const { evaluateGeofence } = require('../src/services/geofenceEngine');

const stops = [{ id: 1, latitude: 13, longitude: 80, geofence_radius: 100 },
               { id: 2, latitude: 13.01, longitude: 80, geofence_radius: 100 }];

test('enter, stay with jitter, then depart', () => {
  let r = evaluateGeofence(stops, { lat: 13.002, lng: 80 }, null); // ~222 m away
  assert.equal(r.entered, null);
  r = evaluateGeofence(stops, { lat: 13.0005, lng: 80 }, r.insideStopId); // ~55 m
  assert.equal(r.entered.id, 1);
  r = evaluateGeofence(stops, { lat: 13.001, lng: 80 }, r.insideStopId); // ~111 m: still inside (hysteresis)
  assert.equal(r.exited, null); assert.equal(r.insideStopId, '1');
  r = evaluateGeofence(stops, { lat: 13.0015, lng: 80 }, r.insideStopId); // ~167 m: departed
  assert.equal(r.exited.id, 1); assert.equal(r.insideStopId, null);
});
