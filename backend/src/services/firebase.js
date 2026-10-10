// One shared firebase-admin app, used for push notifications and for login (Firebase Auth).
// Configured with FIREBASE_SERVICE_ACCOUNT (one-line JSON) or FIREBASE_SERVICE_ACCOUNT_PATH (file).
const fs = require('fs');
const env = require('../config/env');

let admin = null;
let tried = false;

function init() {
  if (tried) return admin;
  tried = true;
  if (!env.FIREBASE_SERVICE_ACCOUNT && !env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    console.log('[firebase] FIREBASE_SERVICE_ACCOUNT not set: push notifications and Firebase login are off.');
    return null;
  }
  try {
    // eslint-disable-next-line global-require
    const fa = require('firebase-admin');
    const raw = env.FIREBASE_SERVICE_ACCOUNT || fs.readFileSync(env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8');
    fa.initializeApp({ credential: fa.credential.cert(JSON.parse(raw)) });
    admin = fa;
    console.log('[firebase] connected.');
  } catch (err) {
    console.warn('[firebase] could not start:', err.message);
    admin = null;
  }
  return admin;
}

module.exports = { init, get: () => admin };
