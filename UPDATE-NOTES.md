# BusMate update: Track Bus, new app designs, online backend

## What's new
- **Admin → Track Bus** (new menu item, also a "Track" button on the Buses page):
  search a bus number → live map with the bus, where the trip started, the route to follow,
  next stop + ETA, college ETA, and the day log: morning start / reached college / return start /
  return end, every trip with start & end place and time, stop-by-stop arrivals (scheduled vs actual,
  on time / late), date picker for past days, link to route replay.
- **Database:** each trip now stores its start and end location (`003_trip_locations.sql`).
- **Student app:** map-first home. Live Google map fills the screen; a sheet shows bus status,
  "Gummidipoondi → College" (reversed in the evening), a big ETA to your stop, next stop, speed,
  last update, and the whole journey timeline. If the live connection drops, it fetches position
  and ETA over HTTP every 10 s, so ETA keeps showing.
- **Driver app:** trip screen is map-first with FROM → TO ribbon, speed bubble, timer, next stop with
  minutes, stops progress bar, college ETA, GPS/network badges, hold-to-end. Home shows the route
  map and the stop order for the chosen trip (morning / evening).
- **No more IP:** apps use the online backend by default (see documentation/DEPLOY.md).

## Install this update
1. Copy the files from this zip into your `BUSMATE-COLLEGE` folder → **Replace**.
2. `cd backend` → `npm run db:migrate` → restart `npm run dev`.
3. `cd admin-dashboard` → `npm run dev` → open **Track Bus**.
4. `cd student-app` → `flutter pub get` → `flutter run --dart-define=API_URL=http://192.168.1.7:4000`
   (same for `driver-app`). After deployment just `flutter run`.
5. Deploy: follow `documentation/DEPLOY.md`.
