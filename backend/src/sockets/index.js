// Socket.IO: authenticated with the same JWT as the REST API.
//
// Client -> server
//   driver:startTrip      { busId, direction? }        (DRIVER)   ack { ok, trip } | { ok:false, error }
//                         direction: TO_COLLEGE (default) | FROM_COLLEGE
//   driver:locationUpdate { busId, tripId, latitude, longitude, accuracy, speed, heading, timestamp }  (DRIVER)
//   driver:endTrip        { tripId }                   (DRIVER)
//   bus:subscribe         { busId }                    (any role) joins room bus:<id>, ack { ok, location, eta }
//   bus:unsubscribe       { busId }
// Server -> client
//   bus:location, bus:status, trip:started, trip:completed, notification:new, admin:alert, bus:updated
const { Server } = require('socket.io');
const env = require('../config/env');
const { verifyToken } = require('../middleware/auth');
const v = require('../validators');
const realtime = require('../services/realtime');
const tripService = require('../services/tripService');
const trackingService = require('../services/trackingService');
const locationModel = require('../models/locationModel');
const AppError = require('../utils/AppError');

function toAckError(err) {
  if (err instanceof AppError) return { ok: false, error: { code: err.code, message: err.message } };
  console.error('[socket]', err);
  return { ok: false, error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } };
}

/** Wraps a handler: validates input, checks role, always replies through the ack callback. */
function handler(socket, { role, schema }, fn) {
  return async (raw, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      if (role && !role.includes(socket.user.role)) throw AppError.forbidden();
      let data = raw;
      if (schema) {
        const parsed = schema.safeParse(raw || {});
        if (!parsed.success) throw AppError.badRequest('Invalid data.', parsed.error.issues.map((i) => i.path.join('.')));
        data = parsed.data;
      }
      reply({ ok: true, ...(await fn(data)) });
    } catch (err) {
      reply(toAckError(err));
    }
  };
}

function initSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.corsOrigins, credentials: true },
    pingInterval: 20000,
    pingTimeout: 20000,
  });
  realtime.setIo(io);

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || (socket.handshake.headers.authorization || '').replace(/^Bearer /, '');
    try {
      socket.user = verifyToken(token);
      next();
    } catch (err) {
      next(new Error(err.code === 'TOKEN_EXPIRED' ? 'TOKEN_EXPIRED' : 'UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket) => {
    const { user } = socket;
    socket.join(`user:${user.id}`);
    if (user.role === 'ADMIN') socket.join('admins');

    socket.on('bus:subscribe', handler(socket, { schema: v.chooseBus }, async ({ busId }) => {
      socket.join(`bus:${busId}`);
      const live = await locationModel.getLive(busId);
      return { location: live, eta: trackingService.getLatestEta(busId) };
    }));
    socket.on('bus:unsubscribe', handler(socket, { schema: v.chooseBus }, async ({ busId }) => {
      socket.leave(`bus:${busId}`);
      return {};
    }));

    socket.on('driver:startTrip', handler(socket, { role: ['DRIVER'], schema: v.tripStart }, async ({ busId, direction }) => {
      const result = await tripService.startTrip(user, busId, { direction });
      socket.join(`bus:${busId}`);
      return result;
    }));
    let lastLocationAt = 0;
    socket.on('driver:locationUpdate', handler(socket, { role: ['DRIVER'], schema: v.location }, async (data) => {
      // Flood guard: at most one point per second (by GPS time, so a backlog sent
      // quickly after reconnecting is still accepted).
      const t = typeof data.timestamp === 'number' ? data.timestamp : Date.parse(data.timestamp) || Date.now();
      if (Math.abs(t - lastLocationAt) < 1000) return { accepted: false, throttled: true };
      lastLocationAt = t;
      return trackingService.processLocation(user, data);
    }));
    socket.on('driver:endTrip', handler(socket, { role: ['DRIVER'], schema: v.tripEnd }, async ({ tripId }) => ({
      trip: await tripService.endTrip(user, tripId),
    })));
  });

  return io;
}

module.exports = { initSockets };
