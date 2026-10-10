import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:geolocator/geolocator.dart';

import '../core/api_client.dart';
import '../core/config.dart';
import '../utils/accuracy.dart';
import 'tracking_task.dart';

enum GpsState { connected, weak, unavailable }
enum NetState { connected, unstable, offline }

/// Why tracking could not start, in words a driver understands.
class TrackingStartException implements Exception {
  TrackingStartException(this.message, {this.canOpenSettings = false, this.isAppSettings = false});
  final String message;
  final bool canOpenSettings;
  final bool isAppSettings;
  @override
  String toString() => message;
}

/// One GPS reading as shown on screen. speed / heading are -1 when unknown.
class GpsFix {
  const GpsFix({required this.latitude, required this.longitude, required this.accuracy, this.speed = -1, this.heading = -1, required this.timestamp});
  final double latitude;
  final double longitude;
  final double accuracy;
  final double speed; // m/s
  final double heading; // degrees
  final DateTime timestamp;

  factory GpsFix.fromPosition(Position p) =>
      GpsFix(latitude: p.latitude, longitude: p.longitude, accuracy: p.accuracy, speed: p.speed, heading: p.heading, timestamp: p.timestamp);

  static GpsFix? fromMessage(Map m) {
    final lat = m['lat'], lng = m['lng'];
    if (lat is! num || lng is! num) return null;
    double d(Object? v, double fallback) => v is num ? v.toDouble() : fallback;
    final ts = m['ts'];
    return GpsFix(
      latitude: lat.toDouble(),
      longitude: lng.toDouble(),
      accuracy: d(m['accuracy'], 9999),
      speed: d(m['speed'], -1),
      heading: d(m['heading'], -1),
      timestamp: ts is int ? DateTime.fromMillisecondsSinceEpoch(ts) : DateTime.now(),
    );
  }
}

/// Screen-side view of trip tracking.
///
/// The GPS itself runs in a background service ([TrackingTaskHandler]) with a "Trip active"
/// notification, so tracking continues with the screen off, in other apps, and after the
/// app is swiped away. This class starts/stops that service and shows what it reports.
class LocationTracker extends ChangeNotifier {
  LocationTracker(this.api);

  final ApiClient api;

  /// Called when the server ended tracking (trip finished elsewhere, or logged out).
  VoidCallback? onStoppedByServer;

  GpsFix? lastFix;
  DateTime? lastFixAt;

  /// First GPS fix of this trip: where the driver started (green START pin).
  GpsFix? startFix;

  /// Phone's last known position, shown on the map until the first live fix arrives (never sent).
  GpsFix? lastKnown;

  DateTime? startedAt;
  DateTime? lastAckAt;
  int sentCount = 0;
  int queuedCount = 0;
  bool mockDetected = false;
  bool hasConnectivity = true;
  String? lastServerMessage;

  String? nextStopName;
  bool nextStopKnown = false;
  int? nextStopEtaSeconds;
  int? nextStopMeters;
  int? destinationEtaSeconds;
  int stopsPassed = 0;
  int stopsTotal = 0;

  /// Speed limit for this bus, from the server (admin setting).
  int? speedLimitKmh;

  int? _tripId;
  bool _listening = false;
  StreamSubscription<List<ConnectivityResult>>? _connSub;
  Timer? _ticker;

  bool get isRunning => _tripId != null;

  /// When the server last accepted a point from this phone.
  DateTime? lastSentAt;

  GpsState get gpsState {
    if (lastFixAt == null || DateTime.now().difference(lastFixAt!) > AppConfig.gpsStaleAfter) return GpsState.unavailable;
    final level = accuracyLevel(lastFix?.accuracy);
    return (level == AccuracyLevel.poor || level == AccuracyLevel.fair) ? GpsState.weak : GpsState.connected;
  }

  NetState get netState {
    if (!hasConnectivity) return NetState.offline;
    // A standing bus sends a heartbeat every 20 s, so allow a little longer than that.
    final ackFresh = lastAckAt != null && DateTime.now().difference(lastAckAt!) < const Duration(seconds: 45);
    if (queuedCount > 0) return NetState.unstable;
    if (isRunning && sentCount > 0 && !ackFresh) return NetState.unstable;
    return NetState.connected;
  }

  int get secondsWithoutFix => lastFix != null || startedAt == null ? 0 : DateTime.now().difference(startedAt!).inSeconds;

  /// Permission, GPS on, notification permission and the "don't kill me" battery setting.
  static Future<void> ensureReady() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw TrackingStartException('GPS is turned off. Turn on Location to start the trip.', canOpenSettings: true);
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied) {
      throw TrackingStartException('Location permission is needed to share the bus position with students.');
    }
    if (permission == LocationPermission.deniedForever) {
      throw TrackingStartException('Location permission is blocked. Allow it in App settings > Permissions > Location.',
          canOpenSettings: true, isAppSettings: true);
    }
    if (defaultTargetPlatform == TargetPlatform.android) {
      try {
        // The "Trip active" notification is what keeps tracking alive in the background.
        if (await FlutterForegroundTask.checkNotificationPermission() != NotificationPermission.granted) {
          await FlutterForegroundTask.requestNotificationPermission();
        }
        // Stops the phone's battery saver from killing tracking during a long trip.
        if (!await FlutterForegroundTask.isIgnoringBatteryOptimizations) {
          await FlutterForegroundTask.requestIgnoreBatteryOptimization();
        }
      } catch (_) {/* not fatal: tracking still works while the app is open */}
    }
  }

  static void _initService() {
    FlutterForegroundTask.init(
      androidNotificationOptions: AndroidNotificationOptions(
        channelId: 'busmate_trip',
        channelName: 'Trip tracking',
        channelDescription: 'Shown while a trip is active and the bus location is being shared.',
        onlyAlertOnce: true,
      ),
      iosNotificationOptions: const IOSNotificationOptions(showNotification: true, playSound: false),
      foregroundTaskOptions: ForegroundTaskOptions(
        eventAction: ForegroundTaskEventAction.repeat(10000), // heartbeat / retry every 10 s
        autoRunOnBoot: false,
        allowWakeLock: true, // keeps the CPU (not the screen) awake while the trip runs
        allowWifiLock: false,
        stopWithTask: false, // keep tracking when the app is swiped away from recent apps
      ),
    );
  }

  Future<void> start({required int busId, required int tripId, required String token}) async {
    await ensureReady();
    _tripId = tripId;
    startedAt ??= DateTime.now();
    _reset();

    _initService();
    _listen();

    final running = await FlutterForegroundTask.isRunningService;
    final savedTrip = await FlutterForegroundTask.getData<int>(key: TrackingKeys.tripId);
    if (!(running && savedTrip == tripId)) {
      // Not yet tracking this trip in the background: (re)start the service for it.
      await FlutterForegroundTask.saveData(key: TrackingKeys.apiUrl, value: AppConfig.apiUrl);
      await FlutterForegroundTask.saveData(key: TrackingKeys.token, value: token);
      await FlutterForegroundTask.saveData(key: TrackingKeys.busId, value: busId);
      await FlutterForegroundTask.saveData(key: TrackingKeys.tripId, value: tripId);
      final ServiceRequestResult result = running
          ? await FlutterForegroundTask.restartService()
          : await FlutterForegroundTask.startService(
              serviceId: 4242,
              serviceTypes: [ForegroundServiceTypes.location],
              notificationTitle: 'BusMate: trip active',
              notificationText: 'Sharing bus location with students. End the trip to stop.',
              callback: startTrackingCallback,
            );
      if (result is ServiceRequestFailure) {
        _tripId = null;
        throw TrackingStartException('Could not start background tracking: ${result.error}');
      }
    }

    final initial = await Connectivity().checkConnectivity();
    hasConnectivity = !initial.contains(ConnectivityResult.none);
    await _connSub?.cancel();
    _connSub = Connectivity().onConnectivityChanged.listen((results) {
      hasConnectivity = !results.contains(ConnectivityResult.none);
      notifyListeners();
    });

    // Refresh "GPS stale / network unstable" labels while the screen is visible.
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(seconds: 5), (_) => notifyListeners());
    notifyListeners();

    // Show the phone's last known spot right away (display only, never sent).
    try {
      final known = await Geolocator.getLastKnownPosition();
      if (known != null && lastFix == null) {
        lastKnown = GpsFix.fromPosition(known);
        notifyListeners();
      }
    } catch (_) {}
  }

  void _reset() {
    sentCount = 0;
    queuedCount = 0;
    mockDetected = false;
    lastServerMessage = null;
    nextStopName = null;
    nextStopKnown = false;
    nextStopEtaSeconds = null;
    nextStopMeters = null;
    destinationEtaSeconds = null;
    stopsPassed = 0;
    stopsTotal = 0;
  }

  void _listen() {
    if (_listening) return;
    FlutterForegroundTask.addTaskDataCallback(_onTaskData);
    _listening = true;
  }

  void _onTaskData(Object data) {
    if (data is! Map || !isRunning) return;
    switch (data['type']) {
      case 'fix':
        final f = GpsFix.fromMessage(data);
        if (f == null) return;
        mockDetected = false;
        lastFix = f;
        lastFixAt = DateTime.now();
        startFix ??= f;
      case 'mock':
        mockDetected = true;
      case 'gpsError':
        lastServerMessage = data['message'] as String?;
      case 'queue':
        queuedCount = (data['queued'] as num?)?.toInt() ?? 0;
      case 'ack':
        _handleAck(data);
      case 'stopped':
        lastServerMessage = data['message'] as String?;
        _tripId = null;
        onStoppedByServer?.call();
    }
    notifyListeners();
  }

  void _handleAck(Map r) {
    lastAckAt = DateTime.now();
    if (r['ok'] == false) {
      lastServerMessage = r['message'] as String? ?? 'Location rejected by server.';
      return;
    }
    sentCount++;
    lastSentAt = DateTime.now();
    if (r['speedLimitKmh'] is num) speedLimitKmh = (r['speedLimitKmh'] as num).toInt();
    lastServerMessage = null;
    final eta = r['eta'];
    if (eta is Map) {
      final next = eta['nextStop'];
      nextStopName = next is Map ? next['stopName'] as String? : null;
      nextStopEtaSeconds = next is Map && next['etaSeconds'] is num ? (next['etaSeconds'] as num).toInt() : null;
      nextStopMeters = next is Map && next['remainingMeters'] is num ? (next['remainingMeters'] as num).toInt() : null;
      final dest = eta['destination'];
      destinationEtaSeconds = dest is Map && dest['etaSeconds'] is num ? (dest['etaSeconds'] as num).toInt() : null;
      if (eta['stopsPassed'] is num) stopsPassed = (eta['stopsPassed'] as num).toInt();
      if (eta['stopsTotal'] is num) stopsTotal = (eta['stopsTotal'] as num).toInt();
      nextStopKnown = true;
    }
  }

  Future<void> stop() async {
    _tripId = null;
    _ticker?.cancel();
    _ticker = null;
    await _connSub?.cancel();
    _connSub = null;
    try {
      await FlutterForegroundTask.removeData(key: TrackingKeys.tripId);
      if (await FlutterForegroundTask.isRunningService) await FlutterForegroundTask.stopService();
    } catch (_) {}
    lastFix = null;
    lastFixAt = null;
    startFix = null;
    lastKnown = null;
    startedAt = null;
    lastAckAt = null;
    lastSentAt = null;
    _reset();
    notifyListeners();
  }

  @override
  void dispose() {
    if (_listening) FlutterForegroundTask.removeTaskDataCallback(_onTaskData);
    _ticker?.cancel();
    _connSub?.cancel();
    super.dispose();
  }
}
