# Testing checklist (spec section 42)

Devices: **Phone 1** driver app, **Phone 2** student app, **Laptop** backend + dashboard. Same Wi-Fi.

| # | Test | How | Pass when | Result |
|---|---|---|---|---|
| 1 | Driver login | Log in with Employee ID | Home shows bus, route, GPS READY | |
| 2 | Start trip | START TRIP → confirm | "TRIP ACTIVE" + persistent notification | |
| 3 | GPS starts | Wait 10 s outdoors | Accuracy shows ±m, speed updates | |
| 4 | Backend receives GPS | Watch backend terminal / Trips page | GPS points count grows | |
| 5 | Student receives location | Student app → TRACK BUS | "Live" green, last updated "just now" | |
| 6 | Admin receives location | Dashboard → Live Buses | Bus marker visible, Online | |
| 7 | Marker moves | Walk/drive 200 m | Marker glides on both screens | |
| 8 | ETA changes | Move toward a stop | Minutes decrease | |
| 9 | Stop geofence | Enter a stop radius | "AT <stop>" on student + admin; arrival time in trip detail | |
| 10 | Notification | Student's stop set; approach it | "approximately 1 km away" / "approaching" / "reached your stop" appear | |
| 11 | Driver ends trip | END TRIP → confirm | Completed screen shows duration + distance | |
| 12 | Bus completed/inactive | Dashboard Buses | Status INACTIVE, trip COMPLETED in Trips | |

Extra checks:
- Screen off for 5 min during a trip: tracking continues (points keep arriving).
- Airplane mode for 1 min, then back: "Network OFFLINE" then queued points are sent; admin gets BUS_OFFLINE alert after 60 s.
- Turn GPS off during a trip: driver sees GPS UNAVAILABLE.
- Wrong password: friendly "Incorrect ID/email or password".

Automated checks (backend): `cd backend && npm test`.

## Real bus test (Phase 17)
Record for each stop: actual arrival time, ETA shown 10 min before, ETA shown 3 min before, and how far the marker was from the real bus.
Use the trip replay page and `location_history` for the GPS side. If ETAs are consistently early/late, tune `ETA_DEFAULT_SPEED_KMH` and `ETA_STOP_DWELL_SECONDS` in `backend/.env`.
