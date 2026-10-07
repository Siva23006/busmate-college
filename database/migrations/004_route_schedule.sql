-- BusMate College: the admin sets each route's two daily runs.
--   start_location = home area (e.g. Redhills)  -> morning trip starts here
--   destination    = the college (e.g. Dr. MGR University) -> evening trip starts here
ALTER TABLE routes ADD COLUMN IF NOT EXISTS morning_time TIME;  -- morning run leaves the home area
ALTER TABLE routes ADD COLUMN IF NOT EXISTS evening_time TIME;  -- evening run leaves the college
