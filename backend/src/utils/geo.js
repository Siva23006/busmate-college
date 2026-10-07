// Pure geometry helpers. No dependencies, unit-tested in test/geo.test.js.
const EARTH_RADIUS_M = 6371008.8;
const toRad = (d) => (d * Math.PI) / 180;

/** Great-circle distance in metres between {lat,lng} points. */
function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Project point p onto segment a-b using a local flat approximation (accurate for
 * segments of a few km). Returns { t (0..1), distance (m from p to segment) }.
 */
function projectOnSegment(p, a, b) {
  const lat0 = toRad((a.lat + b.lat) / 2);
  const kx = EARTH_RADIUS_M * Math.cos(lat0);
  const ky = EARTH_RADIUS_M;
  const ax = toRad(a.lng) * kx, ay = toRad(a.lat) * ky;
  const bx = toRad(b.lng) * kx, by = toRad(b.lat) * ky;
  const px = toRad(p.lng) * kx, py = toRad(p.lat) * ky;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return { t, distance: Math.hypot(px - cx, py - cy) };
}

/**
 * Prepare a polyline [{lat,lng}, ...] with cumulative distances so projections are cheap.
 */
function buildPolyline(points) {
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + haversine(points[i - 1], points[i]));
  return { points, cumulative, length: cumulative[cumulative.length - 1] || 0 };
}

/**
 * Where is p along the polyline?
 * Returns { along (m from start), offRoute (m from line), segmentIndex }.
 * minAlong lets callers prefer positions at/after a known point (routes that loop back).
 */
function locateOnPolyline(poly, p, minAlong = -Infinity) {
  const { points, cumulative } = poly;
  if (points.length === 0) return { along: 0, offRoute: Infinity, segmentIndex: -1 };
  if (points.length === 1) return { along: 0, offRoute: haversine(points[0], p), segmentIndex: 0 };
  let best = null;
  for (let i = 0; i < points.length - 1; i++) {
    const { t, distance } = projectOnSegment(p, points[i], points[i + 1]);
    const along = cumulative[i] + t * (cumulative[i + 1] - cumulative[i]);
    // Small penalty for going backwards keeps the bus from "jumping" to an earlier leg.
    const penalty = along < minAlong - 50 ? (minAlong - along) * 0.5 : 0;
    const score = distance + penalty;
    if (!best || score < best.score) best = { score, along, offRoute: distance, segmentIndex: i };
  }
  return { along: best.along, offRoute: best.offRoute, segmentIndex: best.segmentIndex };
}

/** Accuracy (metres) to the quality labels in the spec. */
function accuracyLevel(accuracy, poorThreshold = 100) {
  if (accuracy == null || Number.isNaN(accuracy)) return 'UNKNOWN';
  if (accuracy <= 10) return 'EXCELLENT';
  if (accuracy <= 30) return 'GOOD';
  if (accuracy <= poorThreshold) return 'FAIR';
  return 'POOR';
}

module.exports = { haversine, projectOnSegment, buildPolyline, locateOnPolyline, accuracyLevel };
