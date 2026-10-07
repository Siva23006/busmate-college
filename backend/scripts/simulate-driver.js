// DEMO / SIMULATION driver. Pretends to be the driver app so you can test the student app
// and admin dashboard without driving. Requires ALLOW_SIMULATION=true in backend/.env.
// Every trip it creates is flagged is_simulation and shown as "DEMO / SIMULATION".
//
// Usage:
//   npm run simulate -- --id DEMO-DRV-01 --password Demo@12345 [--bus 1] [--speedup 5] [--url http://localhost:4000]
//   Extra flags: --poor-gps (sometimes sends bad accuracy)  --drop 20 (go silent for 20 s midway to test OFFLINE)
//                --direction FROM_COLLEGE (evening run: drives the route in reverse; default TO_COLLEGE)
const { io } = require('socket.io-client');

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));
const URL = args.url || process.env.SIM_API_URL || 'http://localhost:4000';
const SPEEDUP = Number(args.speedup || 5);
const SPEED_KMH = Number(args.kmh || 30);
const INTERVAL_MS = 2000;
const DIRECTION = String(args.direction || 'TO_COLLEGE').toUpperCase();

const toRad = (d) => (d * Math.PI) / 180;
function dist(a, b) {
  const h = Math.sin(toRad(b.lat - a.lat) / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(h));
}
function bearing(a, b) {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

async function api(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${URL}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message || `HTTP ${res.status}`);
  return json;
}

(async () => {
  if (!args.id || !args.password) {
    console.error('Usage: npm run simulate -- --id <driver id/email> --password <password> [--bus <busId>]');
    process.exit(1);
  }
  const { token } = await api('/auth/login', { method: 'POST', body: { identifier: args.id, password: args.password } });
  const home = await api('/driver/home', { token });
  const bus = args.bus ? home.buses.find((b) => String(b.id) === String(args.bus)) : home.buses[0];
  if (!bus) throw new Error('This driver has no assigned bus.');
  if (!bus.route || bus.route.stops.length < 2) throw new Error('The bus route needs at least 2 stops.');

  const points = (bus.route.path && bus.route.path.length >= 2)
    ? bus.route.path.map(([lat, lng]) => ({ lat, lng }))
    : bus.route.stops.map((s) => ({ lat: s.latitude, lng: s.longitude }));
  if (DIRECTION === 'FROM_COLLEGE') points.reverse();

  const { trip } = await api('/trips/start', { token, method: 'POST', body: { busId: bus.id, simulation: true, direction: DIRECTION } });
  console.log(`[DEMO / SIMULATION] trip ${trip.id} started on ${bus.bus_number} (${bus.route.route_name}, ${trip.direction}), x${SPEEDUP} speed`);

  const socket = io(URL, { auth: { token }, transports: ['websocket'] });
  await new Promise((resolve, reject) => { socket.on('connect', resolve); socket.on('connect_error', reject); });

  let seg = 0, t = 0, sent = 0, silentUntil = 0;
  const totalSegments = points.length - 1;
  const timer = setInterval(async () => {
    if (Date.now() < silentUntil) return;
    // Advance along the polyline
    let move = (SPEED_KMH / 3.6) * (INTERVAL_MS / 1000) * SPEEDUP;
    while (move > 0 && seg < totalSegments) {
      const segLen = dist(points[seg], points[seg + 1]);
      const left = segLen * (1 - t);
      if (move < left) { t += move / segLen; move = 0; } else { move -= left; seg += 1; t = 0; }
    }
    const a = points[Math.min(seg, totalSegments)];
    const b = points[Math.min(seg + 1, totalSegments)];
    const pos = { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
    const poor = args['poor-gps'] && Math.random() < 0.1;
    const payload = {
      busId: bus.id, tripId: trip.id,
      latitude: pos.lat + (Math.random() - 0.5) * 0.00006,
      longitude: pos.lng + (Math.random() - 0.5) * 0.00006,
      accuracy: poor ? 150 + Math.random() * 100 : 5 + Math.random() * 15,
      speed: (SPEED_KMH / 3.6) * (0.8 + Math.random() * 0.4),
      heading: bearing(a, b),
      timestamp: Date.now(),
    };
    socket.emit('driver:locationUpdate', payload, (ack) => {
      sent += 1;
      const next = ack.eta?.nextStop;
      console.log(`[DEMO] #${sent} ${payload.latitude.toFixed(5)},${payload.longitude.toFixed(5)} ±${Math.round(payload.accuracy)}m`
        + (ack.ok ? (next ? `  next: ${next.stopName} ~${Math.round(next.etaSeconds / 60)} min` : '') : `  ERROR ${ack.error?.message}`));
    });
    if (args.drop && sent === 15) {
      console.log(`[DEMO] going silent for ${args.drop}s to test OFFLINE detection`);
      silentUntil = Date.now() + Number(args.drop) * 1000;
    }
    if (seg >= totalSegments) {
      clearInterval(timer);
      setTimeout(() => {
        socket.emit('driver:endTrip', { tripId: trip.id }, (ack) => {
          console.log(ack.ok ? `[DEMO] trip completed, distance ${ack.trip.distance_meters} m` : `[DEMO] end failed: ${ack.error?.message}`);
          socket.close();
        });
      }, 3000);
    }
  }, INTERVAL_MS);

  process.on('SIGINT', () => {
    console.log('\n[DEMO] stopping, ending trip...');
    socket.emit('driver:endTrip', { tripId: trip.id }, () => process.exit(0));
    setTimeout(() => process.exit(0), 3000);
  });
})().catch((err) => {
  console.error('[DEMO] failed:', err.message);
  process.exit(1);
});
