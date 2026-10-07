-- BusMate College: where each trip started and ended (for the admin "Track Bus" page).
ALTER TABLE trips ADD COLUMN IF NOT EXISTS start_latitude  DOUBLE PRECISION;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS start_longitude DOUBLE PRECISION;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS end_latitude    DOUBLE PRECISION;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS end_longitude   DOUBLE PRECISION;
CREATE INDEX IF NOT EXISTS trips_bus_date_idx ON trips (bus_id, trip_date DESC);
