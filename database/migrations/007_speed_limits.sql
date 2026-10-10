-- BusMate College: admin-set speed limits and app settings.
--   buses.speed_limit_kmh : optional limit for one bus (empty = use the default)
--   app_settings          : small key/value settings edited in the admin portal
ALTER TABLE buses ADD COLUMN IF NOT EXISTS speed_limit_kmh INT;
DO $$ BEGIN
  ALTER TABLE buses ADD CONSTRAINT buses_speed_limit_range CHECK (speed_limit_kmh IS NULL OR speed_limit_kmh BETWEEN 10 AND 150);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Weak-GPS alerts are no longer raised; close the old ones so they stop showing.
UPDATE alerts SET resolved = TRUE, resolved_at = now() WHERE type = 'GPS_POOR' AND NOT resolved;
