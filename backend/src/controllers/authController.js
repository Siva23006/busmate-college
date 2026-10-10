const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');
const { signToken } = require('../middleware/auth');
const userModel = require('../models/userModel');
const driverModel = require('../models/driverModel');
const studentModel = require('../models/studentModel');
const db = require('../config/db');
const fbAuth = require('../services/firebaseAuthService');

// A fixed hash so a wrong username takes as long as a wrong password (no user enumeration).
const DUMMY_HASH = bcrypt.hashSync('busmate-timing-equaliser', 12);

async function profileFor(user) {
  const base = { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, notificationsEnabled: user.notifications_enabled, alertMinutes: user.alert_minutes };
  if (user.role === 'DRIVER') {
    const d = await driverModel.findByUserId(user.id);
    return { ...base, driver: d && { id: d.id, employeeId: d.employee_id, busId: d.bus_id, busNumber: d.bus_number } };
  }
  if (user.role === 'STUDENT') {
    const s = await studentModel.findByUserId(user.id);
    return {
      ...base,
      student: s && {
        id: s.id, studentId: s.student_id, department: s.department, year: s.year,
        routeId: s.assigned_route_id, routeName: s.route_name,
        stopId: s.assigned_stop_id, stopName: s.assigned_stop_name,
        busId: s.bus_id, busNumber: s.bus_number,
      },
    };
  }
  return base;
}

/**
 * Is this the user's password?
 * - Linked to Firebase: Firebase checks it (falls back to the bcrypt copy only if Firebase is unreachable).
 * - Not linked yet: bcrypt checks it, and on success the Firebase account is created with it.
 */
async function verifyPassword(user, password) {
  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH); // same timing as a real check
    return false;
  }
  if (fbAuth.enabled() && fbAuth.hasEmail(user) && user.firebase_uid) {
    const r = await fbAuth.checkPassword(user.email, password);
    if (r.ok) {
      // Keep a bcrypt copy of the current password so login still works if Firebase is ever switched off.
      bcrypt.hash(password, 12)
        .then((h) => db.query('UPDATE users SET password_hash = $2 WHERE id = $1', [user.id, h]))
        .catch(() => {});
      return true;
    }
    if (r.reason === 'TOO_MANY') throw new AppError(429, 'Too many attempts. Wait a few minutes, or use "Forgot password".', 'TOO_MANY_ATTEMPTS');
    if (r.reason !== 'NETWORK') return false;
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (ok && fbAuth.enabled() && fbAuth.hasEmail(user) && !user.firebase_uid) {
    fbAuth.ensureAccount(user, password).catch((e) => console.warn('[auth] firebase link failed:', e.message));
  }
  return ok;
}

async function login(req, res) {
  const { identifier, password } = req.valid.body;
  const user = await userModel.findForLogin(identifier);
  const ok = await verifyPassword(user, password);
  if (!user || !ok) throw new AppError(401, 'Incorrect ID/email or password.', 'INVALID_LOGIN');
  if (!user.is_active) throw AppError.forbidden('This account is disabled. Contact the transport office.');
  res.json({ token: signToken(user), user: await profileFor(user) });
}

/**
 * "Forgot password": emails a Firebase reset link to the account's email.
 * Always answers the same way, so nobody can find out which IDs exist.
 */
async function forgotPassword(req, res) {
  if (!fbAuth.enabled()) {
    throw new AppError(503, 'Password reset by email is not set up yet. Ask the transport office to reset your password.', 'RESET_UNAVAILABLE');
  }
  const user = await userModel.findForLogin(req.valid.body.identifier);
  if (user && user.is_active && fbAuth.hasEmail(user)) {
    try {
      await fbAuth.sendResetEmail(user);
    } catch (err) {
      console.warn('[auth] reset email failed:', err.message);
    }
  }
  res.json({
    ok: true,
    message: 'If this account has an email address, a password reset link has been sent to it. Check your inbox and spam folder. No email on your account? Ask the transport office.',
  });
}

/** Logged-in user changes their own password (needs the current one). */
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.valid.body;
  const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  const user = rows[0];
  if (!user || !user.is_active) throw AppError.unauthorized();
  if (!(await verifyPassword(user, currentPassword))) throw new AppError(400, 'Your current password is not correct.', 'WRONG_PASSWORD');
  const hash = await bcrypt.hash(newPassword, 12);
  await db.query('UPDATE users SET password_hash = $2 WHERE id = $1', [user.id, hash]);
  if (fbAuth.enabled() && fbAuth.hasEmail(user)) await fbAuth.ensureAccount(user, newPassword);
  res.json({ ok: true, message: 'Password changed.' });
}

/** Admin-only: create another ADMIN account. Drivers/students are created via their own endpoints. */
async function register(req, res) {
  const data = req.valid.body;
  if (data.role !== 'ADMIN') throw AppError.badRequest('Use /api/drivers or /api/students to create drivers and students.');
  const password_hash = await bcrypt.hash(data.password, 12);
  const user = await userModel.create({ ...data, password_hash });
  res.status(201).json({ user });
}

async function me(req, res) {
  const user = await userModel.findById(req.user.id);
  if (!user || !user.is_active) throw AppError.unauthorized();
  res.json({ user: await profileFor(user) });
}

async function setFcmToken(req, res) {
  // alarm: this app version can show the full-screen "bus arriving" alarm.
  await userModel.update(req.user.id, { fcm_token: req.valid.body.token, alarm_capable: req.valid.body.alarm === true });
  res.json({ ok: true });
}

async function setNotificationPrefs(req, res) {
  const { enabled, alertMinutes, alarmStyle } = req.valid.body;
  await userModel.update(req.user.id, { notifications_enabled: enabled, alert_minutes: alertMinutes, alarm_style: alarmStyle });
  res.json({ ok: true, enabled, alertMinutes, alarmStyle });
}

module.exports = { login, forgotPassword, changePassword, register, me, setFcmToken, setNotificationPrefs, profileFor };
