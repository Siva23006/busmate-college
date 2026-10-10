// Stores notifications, pushes them over Socket.IO, and sends FCM pushes when configured.
const db = require('../config/db');
const firebase = require('./firebase');
const realtime = require('./realtime');

let messaging = null; // firebase-admin messaging, if configured
const ARRIVAL_TYPES = new Set(['APPROACHING', 'NEAR_1KM', 'REACHED_STOP']);

function initFirebase() {
  const admin = firebase.init();
  if (admin) {
    messaging = admin.messaging();
    console.log('[fcm] Firebase Cloud Messaging enabled.');
  }
}

async function sendPush(tokens, title, message, data) {
  if (!messaging || !tokens.length) return;
  try {
    const res = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body: message },
      data: Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, String(v)])),
      // "Bus is near / at your stop" uses the loud arrival channel; other alerts the normal one.
      // Both channels are created by the student app (MainActivity.kt).
      android: {
        priority: 'high',
        ttl: 30 * 60 * 1000, // a stale "bus is coming" alert is useless after 30 min
        notification: {
          channelId: ARRIVAL_TYPES.has(data && data.type) ? 'busmate_arrival' : 'busmate_alerts',
          sound: 'default',
          defaultVibrateTimings: true,
        },
      },
    });
    // Remove tokens Firebase says are dead so we stop sending to them.
    const dead = [];
    res.responses.forEach((r, i) => {
      const code = r.error && r.error.code;
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') dead.push(tokens[i]);
    });
    if (dead.length) await db.query('UPDATE users SET fcm_token = NULL WHERE fcm_token = ANY($1)', [dead]);
  } catch (err) {
    console.warn('[fcm] send failed:', err.message);
  }
}

/**
 * recipients: [{ user_id, fcm_token, notifications_enabled }]
 * Stored for everyone (inbox); push/socket only if the user has notifications on.
 */
async function notify(recipients, { title, message, type, data }) {
  if (!recipients.length) return;
  const ids = recipients.map((r) => r.user_id);
  const { rows } = await db.query(
    `INSERT INTO notifications (user_id, title, message, type)
     SELECT unnest($1::bigint[]), $2, $3, $4 RETURNING id, user_id, title, message, type, read, created_at`,
    [ids, title, message, type],
  );
  const enabled = new Set(recipients.filter((r) => r.notifications_enabled).map((r) => String(r.user_id)));
  for (const n of rows) {
    if (enabled.has(String(n.user_id))) realtime.toUser(n.user_id, 'notification:new', { ...n, data: data || {} });
  }
  const tokens = recipients.filter((r) => r.notifications_enabled && r.fcm_token).map((r) => r.fcm_token);
  await sendPush(tokens, title, message, { type, ...(data || {}) });
}

module.exports = { initFirebase, notify };
