# BusMate College: Project Notes (resume guide)

Last updated: 7 Oct 2026

## 1. Architecture in one line
Driver phone GPS -> Node.js backend -> Socket.IO -> Student app + Admin dashboard. PostgreSQL stores everything.

## 2. Tech choices
| Part | Technology | Why |
|---|---|---|
| Backend | Node.js + Express (plain JavaScript, CommonJS) | REST API, simple to extend |
| Real-time | Socket.IO on the same server | Pushes bus location to apps instantly |
| Database | PostgreSQL (Neon in development) via `pg` | Relational data: buses, routes, stops, trips |
| Auth | JWT + bcryptjs, role-based (ADMIN / DRIVER / STUDENT) | Phase 4 |
| Validation | zod | Phase 2+ |
| Security | helmet, cors, express-rate-limit | Already in place |
| Driver app | Flutter (Android) | Phase 6-7 |
| Student app | Flutter (Android), google_maps_flutter (Google Maps Platform) | Phase 9-11 |
| Admin | Next.js + TypeScript + Tailwind | Phase 12 |
| Notifications | Firebase Cloud Messaging | Phase 13 |

## 3. Current status

### Code written (7 Oct 2026)
- **Backend (Phases 2-5, 7-8, 11, 14 server side):** schema + migration runner, labeled demo seed, auth (JWT, bcrypt, roles), CRUD for buses/drivers/routes/stops/students, trips, REST + Socket.IO tracking, ETA engine, geofencing, notifications (in-app + FCM-ready), alerts (poor GPS, offline, overspeed, route deviation), DEMO simulator.
  - Verified in Claude's workspace: schema applied on PostgreSQL 16; ETA/geofence/accuracy unit tests pass; a full trip (start → 61 GPS points → 4 stop arrivals → notifications → offline detection → end with distance) ran against a real database.
  - Not yet run on your PC with `npm install` (Claude's workspace could not download packages).
- **Admin dashboard (Phase 12):** login, dashboard cards, live multi-bus map, buses, drivers, routes with map stop editor, stops, students, trips with replay + CSV export, alerts, analytics, settings. Type-checked, not yet built on your PC.
- **Driver app (Phases 6-7):** splash, login, home, start-trip confirm, active trip, trip completed; background GPS via foreground service; offline queue; mock-GPS blocking. Written, not yet compiled (no Flutter SDK in Claude's workspace).
- **Student app (Phases 9-11):** login, home with status + ETA, live map with smooth marker, route timeline with my-stop selection, change bus, notifications inbox, settings. Written, not yet compiled.

### Next
1. Follow `documentation/CONNECT-BACKEND.md` Steps 0-6 (backend + dashboard + simulator).
2. Steps 7-10 (phones).
3. Run the 12-check test in `documentation/TESTING.md`.
4. Phase 13 push: `documentation/PUSH-NOTIFICATIONS.md`. Phase 16 deployment and Phase 17 real bus test after that.

### Added after the first build
- **Trip direction:** every trip is `TO_COLLEGE` (morning) or `FROM_COLLEGE` (evening). Stops are stored in To College order; evening trips use them reversed. Migration `002_trip_direction.sql`.
- **Maps:** Google Maps Platform in the dashboard and both apps (an OpenStreetMap version was used for a while and then replaced).
- **Road routes:** routes follow real roads automatically (OSRM, free public server: light / demo use only). Straight lines are the fallback.
- **Driver app redesign:** dark by default, large touch targets, direction selector, readiness checklist, live speed + Google map preview, hold-to-end.

## 4. Run commands (every session)
Backend (terminal 1):
    cd backend
    npm run dev

Admin (terminal 2):
    cd admin-dashboard
    npm run dev

First time only: `npm install` inside each folder, copy `.env.example` to `.env` (backend) and `.env.local` (admin). Never run `npm install` in the project root.

## 5. Flutter setup (Phase 1 leftover)
    cd driver-app
    flutter create . --org com.busmate --project-name busmate_driver --platforms android
    cd ../student-app
    flutter create . --org com.busmate --project-name busmate_student --platforms android
Test each: connect phone with USB debugging, run `flutter run`, see the counter app.

## 6. All phases

| # | Phase | What gets built | Done when |
|---|---|---|---|
| 1 | Project setup | Folders, backend skeleton, Next.js, Flutter projects | Health check ok, Next page loads, Flutter starter runs. **Status: backend + admin done, Flutter pending** |
| 2 | PostgreSQL database | SQL schema for 10 tables (users, buses, drivers, students, routes, stops, trips, live_locations, location_history, notifications), migration runner, demo seed (labeled) | Tables exist in Neon, seed runs |
| 3 | Backend structure | DB connection, error handling, validators, route files wired | API starts with DB connected |
| 4 | Authentication | Register/login, bcrypt, JWT, role middleware | Login returns token; protected route rejects no-token |
| 5 | Management APIs | CRUD for buses, drivers, routes, stops, students | Tested in Postman |
| 6 | Driver app | Splash, login, home, start-trip confirm, active trip, trip complete screens | Driver can log in and see assigned bus |
| 7 | Real GPS tracking | Permissions, location stream, background tracking, accuracy levels, network state | Backend receives real coordinates |
| 8 | Socket.IO realtime | driver:locationUpdate, bus:location, trip events; validate, store latest + history, broadcast | Second client sees live updates |
| 9 | Student app | Login, home, bus selection, route and stops screens | Student sees assigned bus and route |
| 10 | Live map | Google Maps Platform, smooth bus marker, route polyline, stop markers | Marker moves as driver moves |
| 11 | ETA engine | Position on route, next stop, remaining distance, "estimated arrival" | ETA changes with location |
| 12 | Admin dashboard | Login, sidebar, stats cards, live map, bus/driver/route management | Admin sees bus moving |
| 13 | Notifications | FCM, started/approaching/arrived messages, on/off setting | Phone receives push |
| 14 | Geofencing | Stop radius detection: BUS AT STOP, BUS DEPARTED | Status changes at stops |
| 15 | Testing | Two phones + laptop test plan (12 checks from spec) | All checks pass |
| 16 | Deployment | Host backend, production DB, build APKs, deploy admin | Works outside your home network |
| 17 | Real bus test | Drive the real route, compare actual vs app location and ETA, tune ETA | Results recorded |

## 7. Build rules I follow
- One phase at a time: build, run, test, fix, then move on
- No feature is called finished unless the code exists and was run
- No secrets in code; everything in `.env`
- Demo or simulated data is always labeled DEMO / SIMULATION and never mixed with real tracking
- ETA is shown as "Estimated arrival", never guaranteed

## 8. Things you must provide
- Neon `DATABASE_URL` (Phase 2)
- Google Maps Platform keys with billing active: one browser key (dashboard), one Android key (student + driver apps)
- Firebase project and `google-services.json` (Phase 13)
- One Android phone for driver, one for student testing

## 9. Common problems
- `npm error ENOENT package.json`: you are in the wrong folder; `cd backend` or `cd admin-dashboard` first
- Next.js lockfile warning: harmless; delete stray `package-lock.json` in the project root
- Android emulator reaches your PC at `10.0.2.2`; a real phone needs your laptop's LAN IP (same Wi-Fi)
