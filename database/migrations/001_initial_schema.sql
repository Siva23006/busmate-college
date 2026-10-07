-- BusMate College: initial schema
-- Applied by: backend/scripts/migrate.js  (npm run db:migrate)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Enums ----------
DO $$ BEGIN
  CREATE TYPE user_role      AS ENUM ('ADMIN', 'DRIVER', 'STUDENT');
  CREATE TYPE bus_status     AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'OFFLINE');
  CREATE TYPE driver_status  AS ENUM ('ACTIVE', 'INACTIVE');
  CREATE TYPE trip_status    AS ENUM ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED');
  CREATE TYPE alert_severity AS ENUM ('INFO', 'WARNING', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------- updated_at helper ----------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ---------- users ----------
CREATE TABLE IF NOT EXISTS users (
  id                    BIGSERIAL PRIMARY KEY,
  name                  TEXT NOT NULL,
  email                 TEXT UNIQUE,
  phone                 TEXT,
  password_hash         TEXT NOT NULL,
  role                  user_role NOT NULL,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  fcm_token             TEXT,
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo               BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));
DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- routes ----------
CREATE TABLE IF NOT EXISTS routes (
  id             BIGSERIAL PRIMARY KEY,
  route_name     TEXT NOT NULL,
  description    TEXT,
  start_location TEXT,
  destination    TEXT,
  -- Optional detailed road path as [[lat,lng], ...]. If empty, stops are joined in order.
  path           JSONB,
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS routes_updated_at ON routes;
CREATE TRIGGER routes_updated_at BEFORE UPDATE ON routes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- stops ----------
CREATE TABLE IF NOT EXISTS stops (
  id              BIGSERIAL PRIMARY KEY,
  route_id        BIGINT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  stop_name       TEXT NOT NULL,
  latitude        DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude       DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  stop_order      INT NOT NULL,
  geofence_radius INT NOT NULL DEFAULT 100 CHECK (geofence_radius BETWEEN 10 AND 2000),
  estimated_time  TIME,           -- scheduled time at this stop (optional)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stops_route_order_idx ON stops (route_id, stop_order);

-- ---------- drivers ----------
CREATE TABLE IF NOT EXISTS drivers (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  employee_id    TEXT NOT NULL UNIQUE,
  license_number TEXT,
  phone          TEXT,
  status         driver_status NOT NULL DEFAULT 'ACTIVE',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- buses ----------
CREATE TABLE IF NOT EXISTS buses (
  id                  BIGSERIAL PRIMARY KEY,
  bus_number          TEXT NOT NULL UNIQUE,
  registration_number TEXT UNIQUE,
  capacity            INT CHECK (capacity IS NULL OR capacity > 0),
  status              bus_status NOT NULL DEFAULT 'INACTIVE',
  driver_id           BIGINT REFERENCES drivers(id) ON DELETE SET NULL,
  route_id            BIGINT REFERENCES routes(id) ON DELETE SET NULL,
  is_demo             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS buses_route_idx ON buses (route_id);
DROP TRIGGER IF EXISTS buses_updated_at ON buses;
CREATE TRIGGER buses_updated_at BEFORE UPDATE ON buses FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- students ----------
CREATE TABLE IF NOT EXISTS students (
  id                BIGSERIAL PRIMARY KEY,
  user_id           BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  student_id        TEXT NOT NULL UNIQUE,
  department        TEXT,
  year              INT CHECK (year IS NULL OR year BETWEEN 1 AND 6),
  assigned_route_id BIGINT REFERENCES routes(id) ON DELETE SET NULL,
  assigned_stop_id  BIGINT REFERENCES stops(id) ON DELETE SET NULL,
  assigned_bus_id   BIGINT REFERENCES buses(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS students_route_idx ON students (assigned_route_id);
CREATE INDEX IF NOT EXISTS students_stop_idx  ON students (assigned_stop_id);

-- ---------- trips ----------
CREATE TABLE IF NOT EXISTS trips (
  id               BIGSERIAL PRIMARY KEY,
  bus_id           BIGINT NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
  driver_id        BIGINT REFERENCES drivers(id) ON DELETE SET NULL,
  route_id         BIGINT REFERENCES routes(id) ON DELETE SET NULL,
  trip_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time       TIMESTAMPTZ,
  end_time         TIMESTAMPTZ,
  status           trip_status NOT NULL DEFAULT 'SCHEDULED',
  distance_meters  DOUBLE PRECISION,
  -- DEMO / SIMULATION trips are flagged so they never mix with real tracking.
  is_simulation    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trips_bus_status_idx ON trips (bus_id, status);
CREATE INDEX IF NOT EXISTS trips_date_idx ON trips (trip_date DESC);
-- Only one ACTIVE trip per bus at a time.
CREATE UNIQUE INDEX IF NOT EXISTS trips_one_active_per_bus ON trips (bus_id) WHERE status = 'ACTIVE';

-- ---------- live_locations (latest point per bus) ----------
CREATE TABLE IF NOT EXISTS live_locations (
  id            BIGSERIAL PRIMARY KEY,
  bus_id        BIGINT NOT NULL UNIQUE REFERENCES buses(id) ON DELETE CASCADE,
  trip_id       BIGINT REFERENCES trips(id) ON DELETE SET NULL,
  latitude      DOUBLE PRECISION NOT NULL,
  longitude     DOUBLE PRECISION NOT NULL,
  accuracy      DOUBLE PRECISION,
  speed         DOUBLE PRECISION,   -- metres per second
  heading       DOUBLE PRECISION,   -- degrees 0-360
  timestamp     TIMESTAMPTZ NOT NULL,
  is_simulation BOOLEAN NOT NULL DEFAULT FALSE,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- location_history ----------
CREATE TABLE IF NOT EXISTS location_history (
  id            BIGSERIAL PRIMARY KEY,
  bus_id        BIGINT NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
  trip_id       BIGINT REFERENCES trips(id) ON DELETE CASCADE,
  latitude      DOUBLE PRECISION NOT NULL,
  longitude     DOUBLE PRECISION NOT NULL,
  accuracy      DOUBLE PRECISION,
  speed         DOUBLE PRECISION,
  heading       DOUBLE PRECISION,
  timestamp     TIMESTAMPTZ NOT NULL,
  is_reliable   BOOLEAN NOT NULL DEFAULT TRUE,  -- false when accuracy was POOR
  is_simulation BOOLEAN NOT NULL DEFAULT FALSE,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS location_history_trip_time_idx ON location_history (trip_id, timestamp);

-- ---------- trip_stop_events (geofencing state, restart-safe) ----------
CREATE TABLE IF NOT EXISTS trip_stop_events (
  id                     BIGSERIAL PRIMARY KEY,
  trip_id                BIGINT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  stop_id                BIGINT NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
  arrived_at             TIMESTAMPTZ,
  departed_at            TIMESTAMPTZ,
  near_1km_notified_at   TIMESTAMPTZ,
  approaching_notified_at TIMESTAMPTZ,
  UNIQUE (trip_id, stop_id)
);

-- ---------- notifications ----------
CREATE TABLE IF NOT EXISTS notifications (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  type       TEXT NOT NULL,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);

-- ---------- alerts (admin) ----------
CREATE TABLE IF NOT EXISTS alerts (
  id          BIGSERIAL PRIMARY KEY,
  bus_id      BIGINT REFERENCES buses(id) ON DELETE CASCADE,
  trip_id     BIGINT REFERENCES trips(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,   -- GPS_POOR, BUS_OFFLINE, OVERSPEED, ROUTE_DEVIATION, ...
  severity    alert_severity NOT NULL DEFAULT 'INFO',
  message     TEXT NOT NULL,
  resolved    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS alerts_open_idx ON alerts (resolved, created_at DESC);
