# Connect and run BusMate, step by step

Follow these steps in order. Each step ends with a **check** so you know it worked before moving on.
Commands are shown for Windows PowerShell; on macOS/Linux use `cp` instead of `copy`.

---

## Step 0. Put the files in your project

1. Unzip `busmate-college.zip`.
2. Copy its folders over your existing `BUSMATE-COLLEGE` folder and allow it to replace files:
   `backend`, `admin-dashboard`, `driver-app`, `student-app`, `database`, `documentation`, `README.md`.
3. Clean up two leftovers from the earlier scaffold, or Next.js will fail:
   - Delete `admin-dashboard/app/page.tsx` (the default Next.js page; the dashboard home is now `app/(dashboard)/page.tsx`).
   - If a folder `admin-dashboard/src` exists, delete it (the app lives in `admin-dashboard/app`).

---

## Step 1. Create the Neon database

1. Go to https://neon.tech and sign in. Click **New project** (any name, region closest to you, e.g. Singapore).
2. On the project dashboard click **Connect**. Copy the connection string. It looks like:
   `postgresql://neondb_owner:xxxx@ep-xxxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`

**Check:** you have a string starting with `postgresql://` and ending with `sslmode=require`.

---

## Step 2. Configure the backend

```powershell
cd backend
copy .env.example .env
```

Open `backend/.env` and fill in two values:

```
DATABASE_URL=postgresql://...your Neon string...
JWT_SECRET=<paste a long random string>
```

Make the JWT secret with:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Leave the rest as it is. `ALLOW_SIMULATION=true` lets you use the DEMO simulator during development.

---

## Step 3. Install, create tables, create your admin

```powershell
npm install
npm run db:migrate
npm run create-admin -- "Your Name" you@college.edu "ChooseAStrongPassword"
```

**Check:**
- `db:migrate` prints `applied 001_initial_schema.sql` and `applied 002_trip_direction.sql` (or "already up to date" on later runs). Run it again after every update of the project.
- In Neon, open **Tables**: you see `users, buses, drivers, students, routes, stops, trips, live_locations, location_history, notifications, alerts, trip_stop_events`.
- `create-admin` prints `[admin] ready: you@college.edu`.

Optional, for testing before you enter real data:

```powershell
npm run db:seed:demo
```

This creates **DEMO BUS 01**, **DEMO Route A** with 6 stops, and three logins (all labeled DEMO, password `Demo@12345`):

| Role | Login |
|---|---|
| Admin | demo.admin@busmate.local |
| Driver | DEMO-DRV-01 |
| Student | DEMO-STU-01 |

Remove it later with `npm run db:seed:demo -- --remove`.

---

## Step 4. Start the backend

```powershell
npm run dev
```

**Check:** the terminal shows

```
[db] connected (...)
[api] BusMate backend on http://localhost:4000  (health: /api/health)
```

Open http://localhost:4000/api/health and you should see `"status":"ok","database":"ok"`.

Run the backend's unit tests at any time with `npm test` (ETA, geofence and GPS accuracy logic).

---

## Step 5. Connect the admin dashboard

Open a **second terminal**:

```powershell
cd admin-dashboard
npm install
copy .env.example .env.local
npm run dev
```

`.env.local` already points to `http://localhost:4000`. Add your Google Maps browser key to `.env.local` (Step 8); until then the map areas show a "Map not configured" message and everything else works.

**Check:** open http://localhost:3000, log in with the admin you created in Step 3. The dashboard shows the stat cards. **Settings** shows Backend: Online, Database: ok.

---

## Step 6. See live tracking without a phone (DEMO / SIMULATION)

With the demo seed loaded and backend + dashboard running, open a **third terminal**:

```powershell
cd backend
npm run simulate -- --id DEMO-DRV-01 --password Demo@12345
```

**Check:** the simulator prints a line every 2 s with the next stop and estimated minutes. On the dashboard, **Live Buses** shows DEMO BUS 01 moving with a purple **DEMO / SIMULATION** label, and the stop list ticks off as it passes stops. When it finishes, **Trips** shows a completed trip you can replay.

Extra simulator flags: `--speedup 10` (faster), `--poor-gps` (sometimes bad accuracy, to test warnings), `--drop 70` (goes silent 70 s, to test OFFLINE alerts), `--direction FROM_COLLEGE` (evening run: starts at the college and drives the route in reverse).

---

## Step 7. Let phones reach your laptop

Phones cannot use `localhost`. They need your laptop's Wi-Fi IP.

1. Run `ipconfig` and find **IPv4 Address** under your Wi-Fi adapter, e.g. `192.168.1.10`.
2. Allow port 4000 through Windows Firewall (run PowerShell **as Administrator**, once):

   ```powershell
   New-NetFirewallRule -DisplayName "BusMate API 4000" -Direction Inbound -Protocol TCP -LocalPort 4000 -Action Allow
   ```

3. Put the phone on the **same Wi-Fi** as the laptop.

**Check:** on the phone's browser open `http://192.168.1.10:4000/api/health` (your IP). You should see `"status":"ok"`.

---

## Step 8. Google Maps keys (dashboard + both apps)

Maps use **Google Maps Platform**, which needs a Google Cloud project with billing active.

1. Google Cloud Console > your project > **APIs & Services > Library**: enable **Maps JavaScript API** and **Maps SDK for Android**.
2. **Credentials > Create credentials > API key**. Create two keys and restrict them:
   - Browser key: HTTP referrers `http://localhost:3000/*` (and your deployed domain later), API restriction: Maps JavaScript API.
   - Android key: Android apps `com.busmate.busmate_student` and `com.busmate.busmate_driver` with your SHA-1 (`cd student-app/android; ./gradlew signingReport`), API restriction: Maps SDK for Android.
3. Dashboard: put the browser key in `admin-dashboard/.env.local` as `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...` and restart `npm run dev`. **Settings** then shows "Google Maps key: Configured".
4. Apps: add `MAPS_API_KEY=your-android-key` to **both** `student-app/android/local.properties` and `driver-app/android/local.properties` (these files are git-ignored).

Never put a key in source files or commit it.

---

## Step 9. Driver app (Flutter)

```powershell
cd driver-app
flutter create . --org com.busmate --project-name busmate_driver --platforms android
copy android-setup\AndroidManifest.xml android\app\src\main\AndroidManifest.xml
flutter pub get
```

`flutter create` keeps the files already in `lib/` and `test/`; it only adds the `android/` folder.
The active-trip map preview needs `MAPS_API_KEY` in `android/local.properties` (Step 8). After a fresh `flutter create`, also apply the three small edits in `android-setup/build.gradle.kts.snippet` to `android/app/build.gradle.kts`.
Requires Flutter 3.27 or newer (`flutter --version`).

Connect the driver phone with USB debugging on, then:

```powershell
flutter run --dart-define=API_URL=http://192.168.1.10:4000
```

(Use your IP. For the Android emulator use `http://10.0.2.2:4000`.)

**Check:** log in as the driver (e.g. `DEMO-DRV-01`), you see the bus card and the checklist (GPS ready, Network connected, Location permission) in green. Choose **MORNING · To College** or **EVENING · From College** (pre-selected by the time of day), press **START TRIP**, confirm, allow location. The screen turns to **TRIP ACTIVE** and a notification "BusMate: trip active" appears. Walk around: the admin Live Buses map shows the bus moving.

Real driver accounts: create them in the dashboard (**Drivers > Add driver**) and assign a bus. The bus needs a route with stops.

---

## Step 10. Student app (Flutter)

```powershell
cd student-app
flutter create . --org com.busmate --project-name busmate_student --platforms android
copy android-setup\AndroidManifest.xml android\app\src\main\AndroidManifest.xml
flutter pub get
```

The map needs `MAPS_API_KEY` in `android/local.properties` (Step 8). After a fresh `flutter create`, also apply the three small edits in `android-setup/build.gradle.kts.snippet` to `android/app/build.gradle.kts`.

Run on the second phone:

```powershell
flutter run --dart-define=API_URL=http://192.168.1.10:4000
```

**Check:** log in as a student (e.g. `DEMO-STU-01`). Home shows the bus, status and stop. While the driver phone (or the simulator) is on a trip, **TRACK BUS** shows the bus marker gliding along the route with the estimated arrival at your stop.

---

## Step 11. Enter your real data

In the dashboard:

1. **Routes > Create route**, then click the map to add each stop in **To College** order (the last stop is the college). Set the geofence radius (100 m is a good start).
   - The line between stops is drawn along real roads automatically (calculated by the free OSRM service, then drawn on Google Maps). If it still shows straight lines, press **Regenerate road route**.
   - Evening trips (**From College**) use the same stops and road line in reverse; you do not create a second route.
   - The public OSRM server is for light / demo use only. For daily production use, host OSRM yourself and set `OSRM_URL` in `backend/.env`.
2. **Buses > Add bus**, choose the route.
3. **Drivers > Add driver**, assign the bus. The driver logs in with the Employee ID.
4. **Students > Add student**, choose route and stop. Students log in with their Student ID.

Then remove demo data: `npm run db:seed:demo -- --remove`.

---

## Common problems

| Problem | Fix |
|---|---|
| `[env] Invalid environment configuration` | A value in `backend/.env` is missing; the message names it. |
| `[db] could not connect` | Check `DATABASE_URL`; it must end with `sslmode=require`. |
| Dashboard: "Cannot reach the BusMate server" | Backend not running, or `NEXT_PUBLIC_API_URL` wrong in `.env.local` (restart `npm run dev` after editing). |
| Phone: "Cannot reach BusMate server" | Wrong IP in `--dart-define`, phone not on same Wi-Fi, or firewall rule missing (Step 7). |
| Next.js: "two parallel pages resolve to the same path" | Delete `admin-dashboard/app/page.tsx` (Step 0). |
| App map is blank grey / beige with only the Google logo | `MAPS_API_KEY` is missing from that app's `android/local.properties`, Maps SDK for Android is not enabled, or the key's package / SHA-1 restriction does not match. Rebuild the app after fixing (`flutter run`). |
| Dashboard: "Map not configured" or "This page can't load Google Maps correctly" | Browser key missing in `.env.local`, Maps JavaScript API not enabled, billing inactive, or the referrer restriction does not include your URL. Restart `npm run dev` after editing `.env.local`. |
| Route shows straight lines, not roads | The road routing service (OSRM) was unreachable when the stops were saved. Open the route and press **Regenerate road route**. |
| Driver: "Simulation mode is disabled" | Set `ALLOW_SIMULATION=true` in `backend/.env` (development only). |
| Tracking stops when screen is off | Allow "Location" for the app, and on Xiaomi/Oppo/Vivo/Realme set Battery to "No restrictions" for BusMate Driver. |
