// Firebase Authentication for BusMate logins.
//
// Users still log in with their ID (DRV001, student ID) or email. The server finds their email,
// and Firebase checks the password. Firebase also sends "forgot password" reset emails.
//
// Gradual switch-over: a user with no Firebase account yet is checked with the old bcrypt hash;
// on that successful login their Firebase account is created with the same password.
// Users without an email keep working with bcrypt only. If Firebase is not configured
// (no FIREBASE_SERVICE_ACCOUNT / FIREBASE_WEB_API_KEY), everything stays on bcrypt.
const crypto = require('crypto');
const env = require('../config/env');
const db = require('../config/db');
const firebase = require('./firebase');

const IDT = 'https://identitytoolkit.googleapis.com/v1/accounts';

function enabled() {
  return Boolean(firebase.init() && env.FIREBASE_WEB_API_KEY);
}

const hasEmail = (user) => Boolean(user && user.email && /.+@.+\..+/.test(user.email));

async function identityToolkit(action, body) {
  const res = await fetch(`${IDT}:${action}?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json, code: json && json.error && json.error.message ? String(json.error.message) : null };
}

/**
 * Checks email + password with Firebase.
 * Returns { ok: true, uid } | { ok: false, reason: 'WRONG' | 'TOO_MANY' | 'DISABLED' | 'NETWORK' }.
 */
async function checkPassword(email, password) {
  try {
    const r = await identityToolkit('signInWithPassword', { email, password, returnSecureToken: false });
    if (r.ok) return { ok: true, uid: r.json.localId };
    const code = r.code || '';
    if (code.startsWith('TOO_MANY_ATTEMPTS')) return { ok: false, reason: 'TOO_MANY' };
    if (code.startsWith('USER_DISABLED')) return { ok: false, reason: 'DISABLED' };
    if (/INVALID|EMAIL_NOT_FOUND|PASSWORD/.test(code)) return { ok: false, reason: 'WRONG' };
    console.warn('[auth] firebase sign-in error:', code);
    return { ok: false, reason: 'NETWORK' };
  } catch (err) {
    console.warn('[auth] firebase unreachable:', err.message);
    return { ok: false, reason: 'NETWORK' };
  }
}

async function saveUid(userId, uid) {
  await db.query('UPDATE users SET firebase_uid = $2 WHERE id = $1', [userId, uid]);
}

/** Makes sure the user has a Firebase account; sets its password when one is given. Returns the uid. */
async function ensureAccount(user, password) {
  const auth = firebase.init().auth();
  const profile = { email: user.email, displayName: user.name, disabled: user.is_active === false };
  let uid = user.firebase_uid || null;
  if (uid) {
    try {
      await auth.updateUser(uid, { ...profile, ...(password ? { password } : {}) });
      return uid;
    } catch (err) {
      if (err.code !== 'auth/user-not-found') throw err;
      uid = null; // deleted in the Firebase console: create it again below
    }
  }
  try {
    const existing = await auth.getUserByEmail(user.email);
    uid = existing.uid;
    await auth.updateUser(uid, { ...profile, ...(password ? { password } : {}) });
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    const created = await auth.createUser({
      ...profile,
      // No password known yet (e.g. "forgot password" before first login): a random one;
      // the user sets their own through the reset email.
      password: password || crypto.randomBytes(24).toString('base64url'),
    });
    uid = created.uid;
  }
  await saveUid(user.id, uid);
  return uid;
}

/** After an admin creates/edits a driver or student: keep Firebase in step (never blocks the save). */
async function syncAfterAdminSave(userId, password) {
  if (!enabled()) return;
  try {
    const { rows } = await db.query('SELECT id, name, email, is_active, firebase_uid FROM users WHERE id = $1', [userId]);
    const user = rows[0];
    if (!hasEmail(user)) return;
    if (password || user.firebase_uid) await ensureAccount(user, password || undefined);
  } catch (err) {
    console.warn('[auth] firebase sync failed for user', userId, err.message);
  }
}

async function removeAccount(firebaseUid) {
  if (!firebaseUid || !enabled()) return;
  try {
    await firebase.init().auth().deleteUser(firebaseUid);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') console.warn('[auth] firebase delete failed:', err.message);
  }
}

/** Sends Firebase's "reset your password" email. */
async function sendResetEmail(user) {
  await ensureAccount(user);
  const r = await identityToolkit('sendOobCode', { requestType: 'PASSWORD_RESET', email: user.email });
  if (!r.ok) throw new Error(r.code || 'reset email failed');
}

module.exports = { enabled, hasEmail, checkPassword, ensureAccount, syncAfterAdminSave, removeAccount, sendResetEmail };
