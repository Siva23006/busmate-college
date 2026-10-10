-- BusMate College: driver SOS / delay messages, and full-screen arrival alarm preference.
CREATE TABLE IF NOT EXISTS trip_messages (
  id         BIGSERIAL PRIMARY KEY,
  trip_id    BIGINT REFERENCES trips(id) ON DELETE CASCADE,
  bus_id     BIGINT REFERENCES buses(id) ON DELETE CASCADE,
  driver_id  BIGINT REFERENCES drivers(id) ON DELETE SET NULL,
  kind       TEXT NOT NULL,          -- SOS | TRAFFIC | BREAKDOWN | LATE | OTHER
  minutes    INT,                    -- "about N minutes late" (optional)
  message    TEXT NOT NULL,
  latitude   DOUBLE PRECISION,
  longitude  DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trip_messages_bus_idx ON trip_messages (bus_id, created_at DESC);

-- Phone can show a full-screen ringing alarm (new student app) and the student wants it.
ALTER TABLE users ADD COLUMN IF NOT EXISTS alarm_capable BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS alarm_style   BOOLEAN NOT NULL DEFAULT TRUE;
