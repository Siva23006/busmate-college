import 'package:flutter/foundation.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../core/api_client.dart';
import '../models/models.dart';
import '../services/location_tracker.dart';

/// Driver's home data, the active trip, and the GPS tracker.
class TripProvider extends ChangeNotifier {
  TripProvider(this.api) : tracker = LocationTracker(api) {
    tracker.addListener(notifyListeners);
  }

  final ApiClient api;
  final LocationTracker tracker;

  DriverHome? home;
  bool loading = false;
  String? error;
  Trip? activeTrip;
  BusInfo? activeBus;
  Trip? lastCompleted;
  bool _starting = false;

  BusInfo? busById(int id) {
    for (final b in home?.buses ?? <BusInfo>[]) {
      if (b.id == id) return b;
    }
    return null;
  }

  Future<void> loadHome() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final res = await api.get('/driver/home');
      home = DriverHome.fromJson(res);
      // Resume a trip that was active when the app was closed.
      final t = home!.activeTrip;
      if (t != null && !tracker.isRunning) {
        activeTrip = t;
        activeBus = busById(t.busId);
      } else if (t == null && !tracker.isRunning) {
        activeTrip = null;
      }
    } on ApiException catch (e) {
      error = e.message;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  /// Verifies GPS/permission first, then creates the trip on the server, then starts tracking.
  /// direction: toCollege (morning) or fromCollege (evening).
  Future<void> startTrip(BusInfo bus, String direction) async {
    await LocationTracker.ensureReady();
    _starting = true;
    try {
      final res = await api.post('/trips/start', {'busId': bus.id, 'direction': direction});
      final trip = Trip.fromJson(res['trip'] as Map<String, dynamic>);
      activeTrip = trip;
      activeBus = bus;
      notifyListeners();
      await tracker.start(busId: bus.id, tripId: trip.id, token: api.token!);
      WakelockPlus.enable().catchError((_) {});
    } finally {
      _starting = false;
    }
  }

  /// Restart GPS for a trip that is already active on the server (after app restart).
  Future<void> resumeTracking() async {
    final trip = activeTrip;
    if (trip == null || tracker.isRunning || _starting) return;
    await tracker.start(busId: trip.busId, tripId: trip.id, token: api.token!);
    WakelockPlus.enable().catchError((_) {});
  }

  Future<Trip> endTrip() async {
    final trip = activeTrip;
    if (trip == null) throw ApiException('No active trip.');
    final res = await api.post('/trips/end', {'tripId': trip.id});
    await tracker.stop();
    WakelockPlus.disable().catchError((_) {});
    final done = Trip.fromJson(res['trip'] as Map<String, dynamic>);
    lastCompleted = done;
    activeTrip = null;
    notifyListeners();
    loadHome();
    return done;
  }

  void dismissCompleted() {
    lastCompleted = null;
    notifyListeners();
    loadHome();
  }

  Future<void> reset() async {
    await tracker.stop();
    home = null;
    activeTrip = null;
    activeBus = null;
    lastCompleted = null;
    notifyListeners();
  }

  @override
  void dispose() {
    tracker.removeListener(notifyListeners);
    tracker.dispose();
    super.dispose();
  }
}
