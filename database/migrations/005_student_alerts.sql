-- BusMate College: each student chooses how many minutes before their stop they want the "bus is coming" alert.
ALTER TABLE users ADD COLUMN IF NOT EXISTS alert_minutes INT NOT NULL DEFAULT 10;
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_alert_minutes_range CHECK (alert_minutes BETWEEN 1 AND 60);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
