# BUSMATE College

**Smart College Transport · Know Your Bus. Know Your Time.**

A college bus live-tracking system: the driver's phone GPS goes to a Node.js backend, which pushes the bus position, status and estimated arrival to a student app and a college admin dashboard in real time.

College transportation technology prototype. Arrival times are estimates, not guarantees.

| Part | Folder | Tech |
|---|---|---|
| Backend API + realtime | `backend/` | Node.js, Express, Socket.IO, PostgreSQL (Neon), JWT, zod |
| Database schema | `database/migrations/` | PostgreSQL |
| Admin dashboard | `admin-dashboard/` | Next.js, TypeScript, Tailwind, Google Maps Platform |
| Driver app | `driver-app/` | Flutter (Android), geolocator, background foreground-service tracking, Google Maps preview |
| Student app | `student-app/` | Flutter (Android), google_maps_flutter (Google Maps Platform) |
| Docs | `documentation/` | setup, API, architecture, testing |

## Start here
**[documentation/CONNECT-BACKEND.md](documentation/CONNECT-BACKEND.md)**: step-by-step from Neon database to both phones.

Quick version:

```powershell
# terminal 1
cd backend; copy .env.example .env   # fill DATABASE_URL and JWT_SECRET
npm install; npm run db:migrate
npm run create-admin -- "Your Name" you@college.edu "StrongPassword"
npm run db:seed:demo                 # optional DEMO data
npm run dev

# terminal 2
cd admin-dashboard; copy .env.example .env.local
npm install; npm run dev             # http://localhost:3000

# terminal 3 (optional, DEMO / SIMULATION driver)
cd backend; npm run simulate -- --id DEMO-DRV-01 --password Demo@12345
# evening run (From College): add  --direction FROM_COLLEGE
```

## Rules this project follows
- No secrets in code: `.env`, `.env.local`, `local.properties` only.
- Maps use **Google Maps Platform** (billing account required): a browser key for the dashboard, an Android key for the two apps. See Step 8 of the setup guide.
- Simulated data is always labeled **DEMO / SIMULATION** and never mixed with real tracking.
- ETA is always shown as **Estimated arrival**.
- Poor GPS (> 100 m) never moves the bus marker; the last reliable position is kept.
- Stops are entered once, in **To College** order (last stop = college). Evening trips (**From College**) use them in reverse.
- Route lines follow real roads; the road line itself comes from the free public OSRM server, which is for **light / demo use only**; set `OSRM_URL` in `backend/.env` to your own server for production.

More: [API](documentation/API.md) · [Architecture](documentation/ARCHITECTURE.md) · [Testing](documentation/TESTING.md) · [Push notifications](documentation/PUSH-NOTIFICATIONS.md)
