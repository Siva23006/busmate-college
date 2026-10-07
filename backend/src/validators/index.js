const { z } = require('zod');

const id = z.coerce.number().int().positive();
const idParam = z.object({ id });
const optionalId = z.union([id, z.null()]).optional();
const text = (max = 200) => z.string().trim().min(1).max(max);
const optText = (max = 500) => z.string().trim().max(max).optional().nullable();
const lat = z.coerce.number().min(-90).max(90);
const lng = z.coerce.number().min(-180).max(180);
const password = z.string().min(8, 'Password must be at least 8 characters').max(128);
const email = z.string().trim().toLowerCase().email();

// ---------- Auth ----------
const login = z.object({
  // Email, driver employee ID, or student ID
  identifier: text(200),
  password: z.string().min(1).max(128),
});
const register = z.object({
  name: text(),
  email,
  phone: optText(30),
  password,
  role: z.enum(['ADMIN', 'DRIVER', 'STUDENT']),
});

// ---------- Buses ----------
const busStatus = z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'OFFLINE']);
const busCreate = z.object({
  bus_number: text(50),
  registration_number: optText(50),
  capacity: z.coerce.number().int().positive().max(200).optional().nullable(),
  status: busStatus.optional(),
  driver_id: optionalId,
  route_id: optionalId,
});
const busUpdate = busCreate.partial();

// ---------- Routes & stops ----------
const routeCreate = z.object({
  route_name: text(100),
  description: optText(),
  start_location: optText(200),
  destination: optText(200),
  path: z.array(z.tuple([lat, lng])).min(2).max(5000).optional().nullable(),
  active: z.boolean().optional(),
});
const routeUpdate = routeCreate.partial();

const stopCreate = z.object({
  route_id: id,
  stop_name: text(100),
  latitude: lat,
  longitude: lng,
  stop_order: z.coerce.number().int().min(1).optional(),
  geofence_radius: z.coerce.number().int().min(10).max(2000).optional(),
  estimated_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Use HH:MM').optional().nullable(),
});
const stopUpdate = stopCreate.omit({ route_id: true }).partial();
const stopReorder = z.object({ stopIds: z.array(id).min(1) });
const stopsQuery = z.object({ routeId: id.optional() });

// ---------- Drivers ----------
const driverCreate = z.object({
  name: text(),
  email: email.optional().nullable(),
  phone: optText(30),
  password,
  employee_id: text(50),
  license_number: optText(50),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  bus_id: optionalId,
});
const driverUpdate = driverCreate.partial().extend({ password: password.optional() });

// ---------- Students ----------
const studentCreate = z.object({
  name: text(),
  email: email.optional().nullable(),
  phone: optText(30),
  password,
  student_id: text(50),
  department: optText(100),
  year: z.coerce.number().int().min(1).max(6).optional().nullable(),
  assigned_route_id: optionalId,
  assigned_stop_id: optionalId,
  assigned_bus_id: optionalId,
});
const studentUpdate = studentCreate.partial().extend({ password: password.optional() });
const studentsQuery = z.object({
  search: z.string().trim().max(100).optional(),
  department: z.string().trim().max(100).optional(),
  year: z.coerce.number().int().optional(),
  routeId: id.optional(),
});

// ---------- Trips & tracking ----------
const direction = z.enum(['TO_COLLEGE', 'FROM_COLLEGE']);
const tripStart = z.object({ busId: id, simulation: z.boolean().optional(), direction: direction.default('TO_COLLEGE') });
const tripEnd = z.object({ tripId: id });
const tripsQuery = z.object({
  status: z.enum(['SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
  busId: id.optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const location = z.object({
  busId: id,
  tripId: id,
  latitude: lat,
  longitude: lng,
  accuracy: z.coerce.number().min(0).max(100000).nullable().optional(),
  speed: z.coerce.number().min(0).max(100).nullable().optional(),       // m/s (100 m/s = 360 km/h cap)
  heading: z.coerce.number().min(0).max(360).nullable().optional(),
  timestamp: z.union([z.coerce.number(), z.string()]).optional(),       // ms epoch or ISO
});

// ---------- Me / settings ----------
const fcmToken = z.object({ token: z.string().min(10).max(4096) });
const notificationPrefs = z.object({ enabled: z.boolean() });
const chooseStop = z.object({ stopId: id });
const chooseBus = z.object({ busId: id });

const trackQuery = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

module.exports = {
  trackQuery,
  idParam, login, register,
  busCreate, busUpdate,
  routeCreate, routeUpdate, stopCreate, stopUpdate, stopReorder, stopsQuery,
  driverCreate, driverUpdate, studentCreate, studentUpdate, studentsQuery,
  tripStart, tripEnd, tripsQuery, location,
  fcmToken, notificationPrefs, chooseStop, chooseBus,
};
