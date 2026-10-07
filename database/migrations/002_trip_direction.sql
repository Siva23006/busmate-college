-- BusMate College: trip direction (morning run to college / evening run from college).
-- A route's stops are stored in TO_COLLEGE order (last stop = college);
-- FROM_COLLEGE trips travel the same stops and road line in reverse.

DO $$ BEGIN
  CREATE TYPE trip_direction AS ENUM ('TO_COLLEGE', 'FROM_COLLEGE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE trips ADD COLUMN IF NOT EXISTS direction trip_direction NOT NULL DEFAULT 'TO_COLLEGE';
