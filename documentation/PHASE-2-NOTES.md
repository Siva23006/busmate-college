# Phase 2: Database and Authentication

## Added
- database/schema.sql: all 10 tables (users, routes, stops, drivers, buses, students, trips, live_locations, location_history, notifications)
- backend scripts: `npm run db:migrate` (creates tables), `npm run db:seed` (creates first admin from .env)
- Auth API: POST /api/auth/login, POST /api/auth/register, GET /api/auth/me

## Rules
- Login accepts email, phone, driver employee ID or student ID
- Public register creates STUDENT accounts only; only an admin token can create DRIVER/ADMIN
- Passwords hashed with bcrypt; JWT expires in 12h; login limited to 20 tries per 15 min

## Run it
1. Create a Neon project, copy the connection string into backend/.env as DATABASE_URL
2. Set JWT_SECRET, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD in backend/.env
3. cd backend ; npm install ; npm run db:migrate ; npm run db:seed ; npm run dev
4. Test in Postman (see chat for requests)
