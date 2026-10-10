import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../core/api_client.dart';
import '../models/models.dart';
import '../services/location_tracker.dart';

/// Driver's home data, the active trip, and the GPS tracker.
class TripProvider extends ChangeNotifier {
  TripProvider(this.api) : tracker = LocationTracker(api) {
    tracker.addListener(notifyListeners);
    // Trip ended on the server (e.g. by the admin): leave the trip screen.
    tracker.onStoppedByServer = () {
      activeTrip = null;
      notifyListeners();
      loadHome();
    };
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

  /// The driver's recent trips (Trips tab). null = not loaded yet.
  List<Trip>? history;
  bool historyLoading = false;
  String? historyError;

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

  Future<void> loadHistory() async {
    if (historyLoading) return;
    historyLoading = true;
    historyError = null;
    notifyListeners();
    try {
      final res = await api.get('/driver/trips');
      history = ((res['trips'] as List?) ?? const []).whereType<Map<String, dynamic>>().map(Trip.fromJson).toList();
    } on ApiException catch (e) {
      if (e.status == 404) {
        history = const <Trip>[]; // older server without trip history
      } else {
        historyError = e.message;
      }
    } finally {
      historyLoading = false;
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
      // The screen may turn off: tracking runs in a background service (saves battery).
      await tracker.start(busId: bus.id, tripId: trip.id, token: api.token!);
    } finally {
      _starting = false;
    }
  }

  /// Restart GPS for a trip that is already active on the server (after app restart).
  Future<void> resumeTracking() async {
    final trip = activeTrip;
    if (trip == null || tracker.isRunning || _starting) return;
    await tracker.start(busId: trip.busId, tripId: trip.id, token: api.token!);
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
    history = null; // reload the Trips tab next time
    notifyListeners();
    loadHome();
    return done;
  }

  /// Emergency alert to the transport office. Works with or without a running trip.
  /// [busId] is used when no trip is running (e.g. the bus selected on the home screen).
  Future<String> sendSos({String? note, int? busId}) async {
    final id = activeTrip?.busId ?? busId ?? activeBus?.id;
    double? lat;
    double? lng;
    final fix = tracker.lastFix ?? tracker.lastKnown;
    if (fix != null) {
      lat = fix.latitude;
      lng = fix.longitude;
    } else {
      // No trip running: the phone's last known spot is better than nothing (never blocks the SOS).
      try {
        final p = await Geolocator.getLastKnownPosition().timeout(const Duration(seconds: 3));
        if (p != null) {
          lat = p.latitude;
          lng = p.longitude;
        }
      } catch (_) {/* no permission / no fix: send without a location */}
    }
    final text = note?.trim() ?? '';
    final res = await api.post('/driver/sos', {
      if (id != null) 'busId': id,
      if (lat != null && lng != null) 'latitude': lat,
      if (lat != null && lng != null) 'longitude': lng,
      if (text.isNotEmpty) 'note': text,
    });
    return (res['message'] as String?) ?? 'SOS sent. The transport office has been alerted.';
  }

  /// Tell the students on this bus about a delay. kind: TRAFFIC | BREAKDOWN | LATE | OTHER.
  Future<String> sendDelay({required String kind, int? minutes, String? note}) async {
    final id = activeTrip?.busId ?? activeBus?.id;
    final text = note?.trim() ?? '';
    final res = await api.post('/driver/delay', {
      if (id != null) 'busId': id,
      'kind': kind,
      if (minutes != null) 'minutes': minutes.clamp(1, 180),
      if (text.isNotEmpty) 'note': text,
    });
    return (res['message'] as String?) ?? 'Sent to students.';
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
    history = null;
    historyError = null;
    notifyListeners();
  }

  @override
  void dispose() {
    tracker.removeListener(notifyListeners);
    tracker.dispose();
    super.dispose();
  }
}
