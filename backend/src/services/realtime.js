// Thin wrapper so services can broadcast without importing Socket.IO directly.
// Rooms: "admins", "bus:<id>", "user:<id>".
let io = null;

module.exports = {
  setIo(instance) { io = instance; },
  toBus(busId, event, payload) { if (io) io.to(`bus:${busId}`).emit(event, payload); },
  toAdmins(event, payload) { if (io) io.to('admins').emit(event, payload); },
  toUser(userId, event, payload) { if (io) io.to(`user:${userId}`).emit(event, payload); },
  /** Bus watchers + admins (an admin may also be subscribed to the bus; Socket.IO de-duplicates). */
  toBusAndAdmins(busId, event, payload) { if (io) io.to(`bus:${busId}`).to('admins').emit(event, payload); },
};
