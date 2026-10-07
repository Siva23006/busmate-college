# BusMate API reference

Base URL: `http://<host>:4000/api`. All bodies are JSON. Send `Authorization: Bearer <token>` except for login and health.
Errors always look like `{ "error": { "code": "...", "message": "user-friendly text", "details": [...] } }`.

## Auth
| Method | Path | Who | Body / notes |
|---|---|---|---|
| POST | /auth/login | anyone | `{ identifier, password }`: identifier = email, driver Employee ID, or Student ID. Returns `{ token, user }`. 20 tries / 15 min. |
| POST | /auth/register | ADMIN | `{ name, email, password, role:"ADMIN" }` creates another admin. Drivers/students use their own endpoints. |
| GET | /auth/me | any | Current user profile (with driver or student details). |
| PUT | /me/fcm-token | any | `{ token }` Firebase token for push (Phase 13). |
| PUT | /me/notifications | any | `{ enabled: true/false }` |

## Management (ADMIN unless noted)
| Method | Path | Notes |
|---|---|---|
| GET | /buses | any role. Includes driver, route, active trip, latest location. |
| POST / PUT / DELETE | /buses, /buses/:id | `{ bus_number, registration_number, capacity, status, driver_id, route_id }` |
| GET | /buses/:id | any role. Bus + route with stops. |
| GET | /buses/:id/location | any role. Latest location. |
| GET | /buses/:id/eta | any role. Latest ETA (`label: "Estimated arrival"`). |
| GET | /routes, /routes/:id | any role. `/routes/:id` includes ordered stops. |
| POST / PUT / DELETE | /routes, /routes/:id | `{ route_name, description, start_location, destination, path?, active }` (`path` = `[[lat,lng],...]` road line; normally generated for you, see below) |
| POST | /routes/:id/generate-path | Rebuilds the road line from the stops (OSRM). Returns `{ route, roadRoute: { ok, points, message } }`. |
| PUT | /routes/:id/stops/order | `{ stopIds: [..] }` new order (must list every stop once). Also returns `roadRoute`. |
| GET | /stops?routeId= | any role |
| POST / PUT / DELETE | /stops, /stops/:id | `{ route_id, stop_name, latitude, longitude, stop_order?, geofence_radius?, estimated_time? "HH:MM" }`. Stops are stored in **To College** order (last stop = the college). Create / move / delete also return `roadRoute`. |
| GET / POST | /drivers | create: `{ name, employee_id, password, email?, phone?, license_number?, bus_id? }` |
| GET / PUT | /drivers/:id | `status: "INACTIVE"` disables login. `bus_id` assigns the bus. |
| GET / POST | /students?search=&department=&year=&routeId= | create: `{ name, student_id, password, email?, department?, year?, assigned_route_id?, assigned_stop_id?, assigned_bus_id? }` |
| GET / PUT / DELETE | /students/:id | |
| GET | /dashboard/stats | counts for the dashboard cards |
| GET | /alerts?resolved=false | |
| PATCH | /alerts/:id/resolve | |

## Trips and tracking
| Method | Path | Who | Notes |
|---|---|---|---|
| POST | /trips/start | DRIVER | `{ busId, direction? }`. `direction` = `TO_COLLEGE` (default, morning) or `FROM_COLLEGE` (evening: stops and road line are used in reverse). Bus must be assigned to the driver and have a route. Resumes if the same driver already has it active. |
| POST | /trips/end | DRIVER, ADMIN | `{ tripId }`. Returns distance and duration. |
| GET | /trips?status=&busId=&date=YYYY-MM-DD | ADMIN | history. Each trip has `direction`, `stops_reached`, `stops_total`. |
| GET | /trips/active | any | |
| GET | /trips/:id | ADMIN | trip + stop arrival/departure times (in the order the bus visited them) |
| GET | /trips/:id/path | ADMIN | GPS points for route replay |
| POST | /tracking/location | DRIVER | REST fallback for a GPS point (the app normally uses Socket.IO). Body below. |
| GET | /driver/home | DRIVER | driver, assigned buses with routes (incl. `path`), active trip (incl. `direction`) |
| GET | /student/home | STUDENT | student, bus, route with stops, `direction` of the running trip (or null), latest ETA |
| GET | /student/buses | STUDENT | all buses, their route first |
| PUT | /student/bus | STUDENT | `{ busId }` change bus |
| PUT | /student/stop | STUDENT | `{ stopId }` choose my stop |
| GET | /notifications | any | inbox (latest 100) |
| PATCH | /notifications/:id/read | any | |

### Road routes (OSRM)
When a stop is created, moved, deleted or re-ordered, the backend asks OSRM for the road line through the stops in order and saves it in `routes.path`. If OSRM does not answer within 10 s (or finds no road), the stop is still saved and the route falls back to straight lines between stops; a warning is logged and `roadRoute.ok` is `false`.
The default server `https://router.project-osrm.org` is the **public demo server: light / demo use only**, no uptime guarantee. For production, host OSRM yourself and set `OSRM_URL` in `backend/.env`.

Location body: `{ busId, tripId, latitude, longitude, accuracy, speed (m/s), heading (deg), timestamp (ms epoch or ISO) }`

## Socket.IO
Connect to the same host with `auth: { token }`.

Client to server (always with an ack callback that receives `{ ok: true, ... }` or `{ ok: false, error }`):

| Event | Who | Payload |
|---|---|---|
| `bus:subscribe` | any | `{ busId }`, ack has `location` + `eta` |
| `bus:unsubscribe` | any | `{ busId }` |
| `driver:startTrip` | DRIVER | `{ busId, direction? }` (default `TO_COLLEGE`) |
| `driver:locationUpdate` | DRIVER | location body above |
| `driver:endTrip` | DRIVER | `{ tripId }` |

Server to client:

| Event | Sent to | Payload |
|---|---|---|
| `bus:location` | bus room + admins | `busId, busNumber, tripId, direction, latitude, longitude, accuracy, accuracyLevel, speed, speedKmh, heading, timestamp, isSimulation, atStopId, eta{ direction, nextStop, destination, stops[] }` (`eta.stops` are in travel order; `stopOrder` counts along the trip's direction) |
| `bus:status` | bus room + admins | `{ busId, status: ACTIVE / INACTIVE / OFFLINE / GPS_POOR / AT_STOP / DEPARTED, stopId?, stopName?, at }` |
| `trip:started`, `trip:completed` | bus room + admins | trip summary, incl. `direction` |
| `notification:new` | that user | notification row |
| `admin:alert` | admins | alert row (`GPS_POOR`, `BUS_OFFLINE`, `OVERSPEED`, `ROUTE_DEVIATION`) |
| `bus:updated` | admins | bus row after an edit |
