// Background GPS for an active trip.
//
// Runs inside an Android foreground service (flutter_foreground_task) in its own Dart isolate,
// so the bus keeps sending its location when the screen is off, when the driver opens another
// app, and even when the driver swipes BusMate away from the recent-apps list.
//
// Battery: GPS is read every 5 s, but a point is sent to the server only when the bus moved
// ~25 m or 15 s have passed. When the bus is standing still a small heartbeat is sent every 20 s
// so students and admin still see it as online.
import 'dart:async';
import 'dart:collection';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;

/// Keys shared between the app and the background task (FlutterForegroundTask.saveData).
class TrackingKeys {
  static const apiUrl = 'bm_api_url';
  static const token = 'bm_token';
  static const busId = 'bm_bus_id';
  static const tripId = 'bm_trip_id';
}

/// Entry point of the background isolate. Must be a top-level function.
@pragma('vm:entry-point')
void startTrackingCallback() {
  FlutterForegroundTask.setTaskHandler(TrackingTaskHandler());
}

class TrackingTaskHandler extends TaskHandler {
  static const _sendEveryMeters = 25.0;
  static const _sendEvery = Duration(seconds: 15);
  static const _heartbeatAfter = Duration(seconds: 20);
  static const _maxQueue = 300;

  String? _apiUrl;
  String? _token;
  int? _busId;
  int? _tripId;

  StreamSubscription<Position>? _sub;
  final Queue<Map<String, dynamic>> _queue = Queue();
  bool _sending = false;
  bool _stopped = false;

  Position? _lastFix;
  DateTime? _lastFixAt;
  Position? _lastSentFix;
  DateTime? _lastSentAt;
  DateTime? _lastNotifUpdate;

  @override
  Future<void> onStart(DateTime timestamp, TaskStarter starter) async {
    _apiUrl = await FlutterForegroundTask.getData<String>(key: TrackingKeys.apiUrl);
    _token = await FlutterForegroundTask.getData<String>(key: TrackingKeys.token);
    _busId = await FlutterForegroundTask.getData<int>(key: TrackingKeys.busId);
    _tripId = await FlutterForegroundTask.getData<int>(key: TrackingKeys.tripId);
    if (_apiUrl == null || _token == null || _busId == null || _tripId == null) {
      // Nothing to track (e.g. restarted after the trip data was cleared).
      await FlutterForegroundTask.stopService();
      return;
    }

    final LocationSettings settings = defaultTargetPlatform == TargetPlatform.android
        ? AndroidSettings(accuracy: LocationAccuracy.high, distanceFilter: 5, intervalDuration: const Duration(seconds: 5))
        : const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 5);

    _sub = Geolocator.getPositionStream(locationSettings: settings).listen(
      _onPosition,
      onError: (Object e) => _toMain({'type': 'gpsError', 'message': 'GPS error: please check that Location is on.'}),
    );
  }

  void _onPosition(Position p) {
    if (_stopped) return;
    if (p.isMocked) {
      _toMain({'type': 'mock'}); // never send fake GPS
      return;
    }
    _lastFix = p;
    _lastFixAt = DateTime.now();
    _toMain({'type': 'fix', ..._fixMap(p)});

    final last = _lastSentFix;
    final since = _lastSentAt == null ? null : DateTime.now().difference(_lastSentAt!);
    final moved = last == null ? double.infinity : Geolocator.distanceBetween(last.latitude, last.longitude, p.latitude, p.longitude);
    if (last == null || moved >= _sendEveryMeters || since == null || since >= _sendEvery) {
      _enqueue(p, p.timestamp);
    }
  }

  /// Every 10 s: retry queued points and send a heartbeat while the bus is standing still.
  @override
  void onRepeatEvent(DateTime timestamp) {
    if (_stopped) return;
    final fix = _lastFix;
    final fixAge = _lastFixAt == null ? null : DateTime.now().difference(_lastFixAt!);
    final since = _lastSentAt == null ? null : DateTime.now().difference(_lastSentAt!);
    if (fix != null && fixAge != null && fixAge < const Duration(minutes: 2) && (since == null || since >= _heartbeatAfter)) {
      // Same place, fresh time: tells the server the bus is still online (stopped, not lost).
      _enqueue(fix, DateTime.now(), stationary: true);
    } else {
      _flush();
    }
  }

  void _enqueue(Position p, DateTime ts, {bool stationary = false}) {
    _lastSentFix = p;
    _lastSentAt = DateTime.now();
    _queue.add({
      'busId': _busId,
      'tripId': _tripId,
      'latitude': p.latitude,
      'longitude': p.longitude,
      'accuracy': p.accuracy,
      'speed': stationary ? 0 : (p.speed >= 0 ? p.speed : null),
      'heading': (p.heading >= 0 && p.heading <= 360) ? p.heading : null,
      'timestamp': ts.millisecondsSinceEpoch,
    });
    while (_queue.length > _maxQueue) {
      _queue.removeFirst(); // bounded memory on very long outages
    }
    _flush();
  }

  /// Sends queued points in order, one at a time.
  Future<void> _flush() async {
    if (_sending || _queue.isEmpty || _stopped) return;
    _sending = true;
    try {
      while (_queue.isNotEmpty && !_stopped) {
        final result = await _post(_queue.first);
        if (result == _Send.retryLater) break;
        _queue.removeFirst();
      }
    } finally {
      _sending = false;
      _toMain({'type': 'queue', 'queued': _queue.length});
    }
  }

  Future<_Send> _post(Map<String, dynamic> payload) async {
    try {
      final res = await http
          .post(
            Uri.parse('$_apiUrl/api/tracking/location'),
            headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $_token'},
            body: jsonEncode(payload),
          )
          .timeout(const Duration(seconds: 30));
      Map<String, dynamic> body = {};
      try {
        final d = jsonDecode(res.body);
        if (d is Map<String, dynamic>) body = d;
      } catch (_) {}

      if (res.statusCode >= 200 && res.statusCode < 300) {
        _toMain({'type': 'ack', 'ok': true, ...body});
        _updateNotification(body['eta']);
        return _Send.done;
      }
      if (res.statusCode >= 500 || res.statusCode == 429) return _Send.retryLater;

      final err = body['error'];
      final message = err is Map ? (err['message'] as String? ?? 'Location rejected by server.') : 'Location rejected by server.';
      _toMain({'type': 'ack', 'ok': false, 'message': message});
      if (res.statusCode == 401 || message.contains('No active trip')) {
        // Trip ended (or logged out) elsewhere: stop tracking and the notification.
        _stopped = true;
        _toMain({'type': 'stopped', 'message': message});
        await FlutterForegroundTask.stopService();
      }
      return _Send.done; // a rejected point must not block the queue
    } catch (_) {
      return _Send.retryLater; // offline / timeout: keep it and try again
    }
  }

  /// Shows "Next: Redhills · 4 min" in the trip notification (at most every 30 s).
  void _updateNotification(Object? eta) {
    if (eta is! Map) return;
    final now = DateTime.now();
    if (_lastNotifUpdate != null && now.difference(_lastNotifUpdate!) < const Duration(seconds: 30)) return;
    _lastNotifUpdate = now;
    final next = eta['nextStop'];
    if (next is! Map) return;
    final secs = next['etaSeconds'];
    final mins = secs is num ? math.max(1, (secs / 60).round()) : null;
    FlutterForegroundTask.updateService(
      notificationTitle: 'BusMate: trip active',
      notificationText: 'Next: ${next['stopName'] ?? '-'}${mins != null ? ' · $mins min' : ''}',
    );
  }

  Map<String, dynamic> _fixMap(Position p) => {
        'lat': p.latitude,
        'lng': p.longitude,
        'accuracy': p.accuracy,
        'speed': p.speed,
        'heading': p.heading,
        'ts': p.timestamp.millisecondsSinceEpoch,
      };

  void _toMain(Map<String, dynamic> msg) => FlutterForegroundTask.sendDataToMain(msg);

  @override
  Future<void> onDestroy(DateTime timestamp, bool isTimeout) async {
    _stopped = true;
    await _sub?.cancel();
    _sub = null;
  }
}

enum _Send { done, retryLater }
