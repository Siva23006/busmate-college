// ETA engine (pure logic, no DB). Unit-tested in test/eta.test.js.
//
// MVP algorithm (spec section 15):
//   1. Find the bus position along the route line.
//   2. Find the next stop that has not been passed.
//   3. Remaining distance = stop position along route - bus position along route.
//   4. Travel time = remaining distance / effective speed (+ dwell time at stops in between).
//   5. ETA = now + travel time. Recomputed on every new GPS point.
// It is always an ESTIMATE; clients must label it "Estimated arrival".
const { buildPolyline, locateOnPolyline } = require('../utils/geo');

const DIRECTIONS = ['TO_COLLEGE', 'FROM_COLLEGE'];

/**
 * Stops in the order the bus visits them. They are stored in TO_COLLEGE order
 * (last stop = college), so a FROM_COLLEGE trip visits them in reverse.
 * Each stop gets travel_order: its number along this direction (1 = first stop visited).
 */
function stopsInTravelOrder(stops, direction = 'TO_COLLEGE') {
  const ordered = [...stops].sort((a, b) => a.stop_order - b.stop_order);
  if (direction !== 'FROM_COLLEGE') return ordered.map((s) => ({ ...s, travel_order: s.stop_order }));
  return ordered.reverse().map((s, i) => ({ ...s, travel_order: i + 1 }));
}

/**
 * Build route geometry. path: optional [[lat,lng],...] in TO_COLLEGE order; stops as stored.
 * For FROM_COLLEGE both the stop order and the path are reversed.
 * Returns { poly, stops: [{...stop, travel_order, along}] } with stops in travel order.
 */
function buildRouteGeometry(path, stops, direction = 'TO_COLLEGE') {
  const ordered = stopsInTravelOrder(stops, direction);
  const points = Array.isArray(path) && path.length >= 2
    ? path.map(([lat, lng]) => ({ lat: Number(lat), lng: Number(lng) }))
    : ordered.map((s) => ({ lat: Number(s.latitude), lng: Number(s.longitude) }));
  if (direction === 'FROM_COLLEGE' && Array.isArray(path) && path.length >= 2) points.reverse();
  const poly = buildPolyline(points);
  let previous = -Infinity;
  const withAlong = ordered.map((s) => {
    // Stops are located in order, so a route that passes the same road twice still works.
    const loc = locateOnPolyline(poly, { lat: Number(s.latitude), lng: Number(s.longitude) }, previous);
    previous = loc.along;
    return { ...s, along: loc.along };
  });
  return { poly, stops: withAlong, direction };
}

/** Choose a sensible travel speed (m/s) from recent measured speed. */
function effectiveSpeed(measuredMps, defaultKmh) {
  const fallback = defaultKmh / 3.6;
  if (measuredMps == null || !(measuredMps >= 2)) return fallback; // stopped or unknown
  const clamped = Math.min(Math.max(measuredMps, 3), 20);
  return 0.6 * clamped + 0.4 * fallback; // blend: avoids wild ETA swings in traffic
}

/**
 * @param geometry   result of buildRouteGeometry
 * @param position   {lat, lng}
 * @param opts       { speedMps, lastAlong, visitedStopIds:Set, defaultSpeedKmh, dwellSeconds, now:Date }
 */
function computeEta(geometry, position, opts = {}) {
  const {
    speedMps = null,
    lastAlong = -Infinity,
    visitedStopIds = new Set(),
    defaultSpeedKmh = 25,
    dwellSeconds = 30,
    now = new Date(),
  } = opts;
  const { poly, stops } = geometry;
  if (!stops.length) return null;

  const loc = locateOnPolyline(poly, position, lastAlong);
  const speed = effectiveSpeed(speedMps, defaultSpeedKmh);
  const PASSED_TOLERANCE_M = 25;

  let intermediateStops = 0;
  const result = stops.map((s) => {
    const passed = visitedStopIds.has(String(s.id)) || s.along <= loc.along - PASSED_TOLERANCE_M;
    const stopOrder = s.travel_order ?? s.stop_order;
    if (passed) return { stopId: s.id, stopName: s.stop_name, stopOrder, passed: true };
    const remainingMeters = Math.max(0, s.along - loc.along);
    const etaSeconds = Math.round(remainingMeters / speed + intermediateStops * dwellSeconds);
    intermediateStops += 1;
    return {
      stopId: s.id,
      stopName: s.stop_name,
      stopOrder,
      passed: false,
      remainingMeters: Math.round(remainingMeters),
      etaSeconds,
      expectedAt: new Date(now.getTime() + etaSeconds * 1000).toISOString(),
    };
  });

  const nextStop = result.find((r) => !r.passed) || null;
  const destination = result[result.length - 1];
  return {
    label: 'Estimated arrival',
    along: Math.round(loc.along),
    routeLength: Math.round(poly.length),
    offRouteMeters: Math.round(loc.offRoute),
    speedUsedKmh: Math.round(speed * 3.6),
    nextStop,
    destination: destination.passed ? null : destination,
    stops: result,
    computedAt: now.toISOString(),
  };
}

module.exports = { DIRECTIONS, stopsInTravelOrder, buildRouteGeometry, computeEta, effectiveSpeed };
