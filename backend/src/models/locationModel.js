const db = require('../config/db');

async function upsertLive(loc) {
  await db.query(
    `INSERT INTO live_locations (bus_id, trip_id, latitude, longitude, accuracy, speed, heading, timestamp, is_simulation, received_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
     ON CONFLICT (bus_id) DO UPDATE SET
       trip_id = EXCLUDED.trip_id, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
       accuracy = EXCLUDED.accuracy, speed = EXCLUDED.speed, heading = EXCLUDED.heading,
       timestamp = EXCLUDED.timestamp, is_simulation = EXCLUDED.is_simulation, received_at = now()`,
    [loc.busId, loc.tripId, loc.latitude, loc.longitude, loc.accuracy, loc.speed, loc.heading, loc.timestamp, loc.isSimulation],
  );
}

async function insertHistory(loc, isReliable) {
  await db.query(
    `INSERT INTO location_history (bus_id, trip_id, latitude, longitude, accuracy, speed, heading, timestamp, is_reliable, is_simulation)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [loc.busId, loc.tripId, loc.latitude, loc.longitude, loc.accuracy, loc.speed, loc.heading, loc.timestamp, isReliable, loc.isSimulation],
  );
}

async function getLive(busId) {
  const { rows } = await db.query(
    `SELECT ll.*, t.direction, t.start_latitude, t.start_longitude
       FROM live_locations ll LEFT JOIN trips t ON t.id = ll.trip_id
      WHERE ll.bus_id = $1`, [busId]);
  return rows[0] || null;
}

/** Average speed (m/s) of the last few reliable moving points: smooths the ETA. */
async function recentAverageSpeed(tripId, samples = 6) {
  const { rows } = await db.query(
    `SELECT avg(speed) AS avg FROM (
       SELECT speed FROM location_history
        WHERE trip_id = $1 AND is_reliable AND speed IS NOT NULL
        ORDER BY timestamp DESC LIMIT $2) x`,
    [tripId, samples],
  );
  return rows[0].avg == null ? null : Number(rows[0].avg);
}

module.exports = { upsertLive, insertHistory, getLive, recentAverageSpeed };
