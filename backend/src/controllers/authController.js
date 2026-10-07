const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');
const { signToken } = require('../middleware/auth');
const userModel = require('../models/userModel');
const driverModel = require('../models/driverModel');
const studentModel = require('../models/studentModel');

// A fixed hash so a wrong username takes as long as a wrong password (no user enumeration).
const DUMMY_HASH = bcrypt.hashSync('busmate-timing-equaliser', 12);

async function profileFor(user) {
  const base = { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, notificationsEnabled: user.notifications_enabled };
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

async function login(req, res) {
  const { identifier, password } = req.valid.body;
  const user = await userModel.findForLogin(identifier);
  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) throw new AppError(401, 'Incorrect ID/email or password.', 'INVALID_LOGIN');
  if (!user.is_active) throw AppError.forbidden('This account is disabled. Contact the transport office.');
  res.json({ token: signToken(user), user: await profileFor(user) });
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
  await userModel.update(req.user.id, { fcm_token: req.valid.body.token });
  res.json({ ok: true });
}

async function setNotificationPrefs(req, res) {
  await userModel.update(req.user.id, { notifications_enabled: req.valid.body.enabled });
  res.json({ ok: true, enabled: req.valid.body.enabled });
}

module.exports = { login, register, me, setFcmToken, setNotificationPrefs, profileFor };
