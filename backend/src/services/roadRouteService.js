// Makes a route follow real roads. Whenever a route's stops change, the stops (in order)
// are sent to the free public OSRM server and the returned road line is saved in
// routes.path as [[lat,lng], ...]. If OSRM cannot be reached the path is cleared, so the
// route falls back to straight lines between stops; saving a stop is never blocked.
//
// The public server (router.project-osrm.org) is for light / demo use only. For
// production, host OSRM yourself and set OSRM_URL in backend/.env.
const db = require('../config/db');
const routeModel = require('../models/routeModel');
const geometryCache = require('./routeGeometryCache');

const OSRM_URL = (process.env.OSRM_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
const TIMEOUT_MS = 10000;
const MAX_POINTS = 4000; // keeps the per-GPS-point ETA projection cheap on very long routes

const latestRun = new Map(); // routeId -> counter, so an older slow request never overwrites a newer one

/** OSRM wants lng,lat pairs separated by ";". */
function buildUrl(stops) {
  const coords = stops.map((s) => `${Number(s.longitude).toFixed(6)},${Number(s.latitude).toFixed(6)}`).join(';');
  return `${OSRM_URL}/route/v1/driving/${coords}?overview=full&geometries=geojson`;
}

/** OSRM response -> [[lat,lng], ...], or null if it holds no usable line. */
function parsePath(json) {
  const coords = json && json.code === 'Ok' && json.routes && json.routes[0] && json.routes[0].geometry
    ? json.routes[0].geometry.coordinates : null;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const step = Math.ceil(coords.length / MAX_POINTS);
  const kept = step > 1 ? coords.filter((_, i) => i % step === 0 || i === coords.length - 1) : coords;
  const path = kept.map(([lng, lat]) => [Number(Number(lat).toFixed(6)), Number(Number(lng).toFixed(6))]);
  return path.every(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)) ? path : null;
}

/** Road line through the stops in order. Throws if OSRM fails, times out, or finds no road. */
async function fetchRoadPath(stops) {
  const res = await fetch(buildUrl(stops), {
    headers: { 'User-Agent': 'BusMate-College/1.0' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`OSRM replied HTTP ${res.status}`);
  const path = parsePath(await res.json());
  if (!path) throw new Error('OSRM found no road between these stops');
  return path;
}

/**
 * Regenerates and saves the road path of a route. Never throws.
 * Returns { ok, points, message }.
 * clearOnFailure: the stops changed, so an old road line would be wrong: fall back to
 * straight lines. Pass false when the stops did not change (manual "regenerate").
 */
async function regenerate(routeId, { clearOnFailure = true } = {}) {
  const run = (latestRun.get(String(routeId)) || 0) + 1;
  latestRun.set(String(routeId), run);
  let result;
  let path = null;
  try {
    const stops = await routeModel.listStops(routeId);
    if (stops.length < 2) {
      result = { ok: false, points: 0, message: 'Add at least 2 stops to draw a road route.' };
    } else {
      path = await fetchRoadPath(stops);
      result = { ok: true, points: path.length, message: 'Road route updated.' };
    }
  } catch (err) {
    const reason = err.name === 'TimeoutError' ? `no reply within ${TIMEOUT_MS / 1000} s` : err.message;
    console.warn(`[road-route] route ${routeId}: ${reason}. ${clearOnFailure ? 'Using straight lines between stops.' : 'Keeping the current line.'}`);
    result = {
      ok: false, points: 0,
      message: clearOnFailure
        ? 'Could not reach the road routing service. Using straight lines between stops for now.'
        : 'Could not reach the road routing service. The route line was left unchanged.',
    };
  }
  try {
    if (latestRun.get(String(routeId)) === run && (path || clearOnFailure)) {
      await db.query('UPDATE routes SET path = $2 WHERE id = $1', [routeId, path ? JSON.stringify(path) : null]);
      geometryCache.invalidate(routeId);
    }
  } catch (err) {
    console.warn(`[road-route] route ${routeId}: could not save path: ${err.message}`);
    result = { ok: false, points: 0, message: 'Could not save the road route.' };
  }
  return result;
}

module.exports = { regenerate, fetchRoadPath, buildUrl, parsePath };
