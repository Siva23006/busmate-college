// Loads and validates environment variables once at startup.
// The server refuses to start with a clear message if something required is missing.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { z } = require('zod');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required (paste your Neon connection string)'),
  DATABASE_SSL: z.enum(['true', 'false']).default('true'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // Tracking / ETA tuning
  GPS_POOR_ACCURACY_M: z.coerce.number().positive().default(100),
  ETA_DEFAULT_SPEED_KMH: z.coerce.number().positive().default(25),
  ETA_STOP_DWELL_SECONDS: z.coerce.number().nonnegative().default(30),
  BUS_OFFLINE_AFTER_SECONDS: z.coerce.number().positive().default(60),
  OVERSPEED_KMH: z.coerce.number().positive().default(60),
  ROUTE_DEVIATION_M: z.coerce.number().positive().default(300),
  APPROACHING_MINUTES: z.coerce.number().positive().default(5),

  // Firebase Cloud Messaging (Phase 13). Optional: path to service-account JSON.
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),

  // Allows the simulator to create DEMO / SIMULATION trips. Keep false in production.
  ALLOW_SIMULATION: z.enum(['true', 'false']).default('false'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('\n[env] Invalid environment configuration in backend/.env:');
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  console.error('Copy backend/.env.example to backend/.env and fill it in.\n');
  process.exit(1);
}

const env = parsed.data;
module.exports = {
  ...env,
  isProd: env.NODE_ENV === 'production',
  corsOrigins: env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  allowSimulation: env.ALLOW_SIMULATION === 'true',
};
