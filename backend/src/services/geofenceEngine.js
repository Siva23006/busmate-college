// Stop geofencing (pure logic). Unit-tested in test/geofence.test.js.
// Enter when distance <= radius. Leave only when distance > radius * EXIT_FACTOR
// so GPS jitter at the edge does not flip AT STOP / DEPARTED repeatedly.
const { haversine } = require('../utils/geo');

const EXIT_FACTOR = 1.25;

/**
 * @param stops         [{id, latitude, longitude, geofence_radius}]
 * @param position      {lat, lng}
 * @param insideStopId  stop the bus is currently inside (or null)
 * @returns { entered: stop|null, exited: stop|null, insideStopId }
 */
function evaluateGeofence(stops, position, insideStopId) {
  let exited = null;
  let current = insideStopId != null ? String(insideStopId) : null;

  if (current) {
    const stop = stops.find((s) => String(s.id) === current);
    if (!stop) {
      current = null;
    } else {
      const d = haversine(position, { lat: Number(stop.latitude), lng: Number(stop.longitude) });
      if (d > stop.geofence_radius * EXIT_FACTOR) {
        exited = stop;
        current = null;
      } else {
        return { entered: null, exited: null, insideStopId: current };
      }
    }
  }

  // Not inside any stop: find the closest stop whose radius contains the bus.
  let entered = null;
  let bestDistance = Infinity;
  for (const stop of stops) {
    if (exited && String(stop.id) === String(exited.id)) continue;
    const d = haversine(position, { lat: Number(stop.latitude), lng: Number(stop.longitude) });
    if (d <= stop.geofence_radius && d < bestDistance) {
      entered = stop;
      bestDistance = d;
    }
  }
  return { entered, exited, insideStopId: entered ? String(entered.id) : null };
}

module.exports = { evaluateGeofence, EXIT_FACTOR };
