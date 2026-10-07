// Caches route geometry (polyline + stop positions) so ETA does not hit the DB for
// the route on every GPS point. One entry per route + direction (a FROM_COLLEGE trip
// uses the reversed stops and path). Invalidated whenever a route or its stops change.
const routeModel = require('../models/routeModel');
const { DIRECTIONS, buildRouteGeometry } = require('./etaEngine');

const cache = new Map();
const keyOf = (routeId, direction) => `${routeId}:${direction}`;

async function get(routeId, direction = 'TO_COLLEGE') {
  if (!routeId) return null;
  const key = keyOf(routeId, direction);
  if (cache.has(key)) return cache.get(key);
  const route = await routeModel.findById(routeId);
  if (!route || !route.stops.length) return null;
  const geometry = { route, ...buildRouteGeometry(route.path, route.stops, direction) };
  cache.set(key, geometry);
  return geometry;
}

/** Drops both directions of a route (or everything when routeId is omitted). */
function invalidate(routeId) {
  if (routeId == null) cache.clear();
  else for (const direction of DIRECTIONS) cache.delete(keyOf(routeId, direction));
}

module.exports = { get, invalidate };
