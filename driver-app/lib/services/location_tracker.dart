import 'dart:async';
import 'dart:collection';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../core/api_client.dart';
import '../core/config.dart';
import '../utils/accuracy.dart';

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

/// Collects real GPS fixes during a trip and sends them to the backend.
///
/// - Uses an Android foreground service (persistent notification) so tracking
///   continues when the screen is off or the app is in the background.
/// - Sends over Socket.IO; falls back to REST; queues points while offline and
///   sends them when the connection returns.
/// - Never sends mock (fake) locations.
class LocationTracker extends ChangeNotifier {
  LocationTracker(this.api);

  final ApiClient api;

  Position? lastFix;
  DateTime? lastFixAt;

  /// First GPS fix of this trip: where the driver started (green START pin).
  Position? startFix;

  /// Phone's last known position, shown on the map until the first live fix arrives (never sent).
  Position? lastKnown;

  /// When tracking started, to show helpful hints if GPS takes long.
  DateTime? startedAt;
  DateTime? lastSentAt;
  DateTime? lastAckAt;
  int sentCount = 0;
  bool mockDetected = false;
  bool hasConnectivity = true;
  bool socketConnected = false;
  String? lastServerMessage;

  /// Next stop according to the server's ETA (from the last acknowledged point).
  /// nextStopKnown is false until the first such answer arrives.
  String? nextStopName;
  bool nextStopKnown = false;
  int? nextStopEtaSeconds;
  int? nextStopMeters;
  int? destinationEtaSeconds;
  int stopsPassed = 0;
  int stopsTotal = 0;

  int? _busId;
  int? _tripId;
  io.Socket? _socket;
  StreamSubscription<Position>? _positionSub;
  StreamSubscription<List<ConnectivityResult>>? _connSub;
  Timer? _ticker;
  final Queue<Map<String, dynamic>> _pending = Queue();
  bool _flushing = false;

  bool get isRunning => _tripId != null;
  int get queuedCount => _pending.length;

  GpsState get gpsState {
    if (lastFixAt == null || DateTime.now().difference(lastFixAt!) > AppConfig.gpsStaleAfter) return GpsState.unavailable;
    final level = accuracyLevel(lastFix?.accuracy);
    return (level == AccuracyLevel.poor || level == AccuracyLevel.fair) ? GpsState.weak : GpsState.connected;
  }

  NetState get netState {
    if (!hasConnectivity) return NetState.offline;
    final ackFresh = lastAckAt != null && DateTime.now().difference(lastAckAt!) < AppConfig.ackStaleAfter;
    if (_pending.isNotEmpty || (!socketConnected && !ackFresh)) return NetState.unstable;
    if (isRunning && sentCount > 0 && !ackFresh) return NetState.unstable;
    return NetState.connected;
  }

  /// Steps 1-3 of the spec: permission, GPS on, start the location service.
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
  }

  Future<void> start({required int busId, required int tripId, required String token}) async {
    await ensureReady();
    await stop();
    _busId = busId;
    _tripId = tripId;
    startedAt = DateTime.now();
    startFix = null;
    lastKnown = null;
    sentCount = 0;
    mockDetected = false;
    nextStopName = null;
    nextStopKnown = false;
    nextStopEtaSeconds = null;
    nextStopMeters = null;
    destinationEtaSeconds = null;
    stopsPassed = 0;
    stopsTotal = 0;

    _connectSocket(token);

    final initial = await Connectivity().checkConnectivity();
    hasConnectivity = !initial.contains(ConnectivityResult.none);
    _connSub = Connectivity().onConnectivityChanged.listen((results) {
      final online = !results.contains(ConnectivityResult.none);
      if (online && !hasConnectivity) _flush();
      hasConnectivity = online;
      notifyListeners();
    });

    final settings = defaultTargetPlatform == TargetPlatform.android
        ? AndroidSettings(
            accuracy: LocationAccuracy.high,
            distanceFilter: 0,
            intervalDuration: AppConfig.locationInterval,
            foregroundNotificationConfig: const ForegroundNotificationConfig(
              notificationTitle: 'BusMate: trip active',
              notificationText: 'Sharing bus location with students. End the trip to stop.',
              enableWakeLock: true,
              setOngoing: true,
            ),
          )
        : const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 0);

    _positionSub = Geolocator.getPositionStream(locationSettings: settings).listen(
      _onPosition,
      onError: (Object e) {
        lastServerMessage = 'GPS error: please check that Location is on.';
        notifyListeners();
      },
    );

    // Refresh status labels (GPS stale, network unstable) even with no new events.
    _ticker = Timer.periodic(const Duration(seconds: 3), (_) => notifyListeners());
    notifyListeners();
    _warmUpGps();
  }

  /// Gets a position quickly: the last known one for the map (display only), then one fresh fix,
  /// so the bus appears in seconds instead of waiting for the first stream event.
  Future<void> _warmUpGps() async {
    try {
      final known = await Geolocator.getLastKnownPosition();
      if (known != null && lastFix == null && isRunning) {
        lastKnown = known;
        notifyListeners();
      }
    } catch (_) {}
    try {
      final fresh = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 25)),
      );
      if (lastFix == null && isRunning) _onPosition(fresh);
    } catch (_) {
      // No fix yet (indoors / weak signal). The position stream keeps trying.
    }
  }

  /// Seconds since tracking started without any GPS fix (0 once a fix arrived).
  int get secondsWithoutFix => lastFix != null || startedAt == null ? 0 : DateTime.now().difference(startedAt!).inSeconds;

  void _connectSocket(String token) {
    final socket = io.io(
      AppConfig.apiUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .disableAutoConnect()
          .enableReconnection()
          .setReconnectionDelay(1000)
          .setReconnectionDelayMax(5000)
          .build(),
    );
    socket.onConnect((_) {
      socketConnected = true;
      notifyListeners();
      _flush();
    });
    socket.onDisconnect((_) {
      socketConnected = false;
      notifyListeners();
    });
    socket.onConnectError((_) {
      socketConnected = false;
      notifyListeners();
    });
    socket.connect();
    _socket = socket;
  }

  void _onPosition(Position p) {
    if (p.isMocked) {
      // Spec: never send fake GPS. Show a warning instead.
      mockDetected = true;
      notifyListeners();
      return;
    }
    mockDetected = false;
    lastFix = p;
    lastFixAt = DateTime.now();
    startFix ??= p;
    final payload = <String, dynamic>{
      'busId': _busId,
      'tripId': _tripId,
      'latitude': p.latitude,
      'longitude': p.longitude,
      'accuracy': p.accuracy,
      'speed': p.speed >= 0 ? p.speed : null,
      'heading': (p.heading >= 0 && p.heading <= 360) ? p.heading : null,
      'timestamp': p.timestamp.millisecondsSinceEpoch,
    };
    _pending.add(payload);
    while (_pending.length > 500) {
      _pending.removeFirst(); // keep memory bounded on very long outages
    }
    notifyListeners();
    _flush();
  }

  /// Sends queued points in order. One at a time so the server sees them in sequence.
  Future<void> _flush() async {
    if (_flushing || _pending.isEmpty || !isRunning) return;
    _flushing = true;
    try {
      while (_pending.isNotEmpty && isRunning) {
        final ok = await _send(_pending.first);
        if (!ok) break;
        _pending.removeFirst();
        sentCount++;
        lastSentAt = DateTime.now();
        notifyListeners();
      }
    } finally {
      _flushing = false;
    }
  }

  Future<bool> _send(Map<String, dynamic> payload) async {
    final socket = _socket;
    if (socket != null && socket.connected) {
      final completer = Completer<bool>();
      socket.emitWithAck('driver:locationUpdate', payload, ack: (dynamic resp) {
        final r = resp is Map ? resp : (resp is List && resp.isNotEmpty && resp.first is Map ? resp.first as Map : null);
        _handleAck(r);
        // throttled = server dropped it as too frequent; treat as delivered.
        if (!completer.isCompleted) completer.complete(r != null);
      });
      return completer.future.timeout(const Duration(seconds: 10), onTimeout: () => false);
    }
    // REST fallback (e.g. networks that block WebSockets)
    try {
      final r = await api.post('/tracking/location', payload);
      _handleAck({'ok': true, ...r});
      return true;
    } on ApiException catch (e) {
      if (e.code == 'NETWORK' || e.code == 'TIMEOUT' || e.status >= 500 || e.status == 429) return false;
      _handleAck({'ok': false, 'error': {'message': e.message}});
      return true; // a rejected point (e.g. trip ended) must not block the queue
    }
  }

  void _handleAck(Map? r) {
    if (r == null) return;
    lastAckAt = DateTime.now();
    if (r['ok'] == false) {
      final err = r['error'];
      lastServerMessage = err is Map ? err['message'] as String? : 'Location rejected by server.';
    } else {
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
  }

  Future<void> stop() async {
    await _positionSub?.cancel();
    await _connSub?.cancel();
    _ticker?.cancel();
    _socket?.dispose();
    _positionSub = null;
    _connSub = null;
    _ticker = null;
    _socket = null;
    socketConnected = false;
    _tripId = null;
    _busId = null;
    _pending.clear();
    notifyListeners();
  }

  @override
  void dispose() {
    stop();
    super.dispose();
  }
}
