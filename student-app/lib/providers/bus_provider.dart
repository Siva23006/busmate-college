import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../core/api_client.dart';
import '../core/config.dart';
import '../models/models.dart';

enum LiveState { live, updating, offline }

/// What the student sees in 2 seconds: one of these.
enum BusPhase { notStarted, onRoute, stopped, atStop, gpsWeak, offline, completed }

/// The student's bus: home data, live location over Socket.IO, ETA, status, notifications.
class BusProvider extends ChangeNotifier {
  BusProvider(this.api);
  final ApiClient api;

  // Home data
  String studentName = '';
  int? myStopId;
  String? myStopName;
  bool notificationsEnabled = true;

  /// Alert me this many minutes before the bus reaches my stop.
  int alertMinutes = 10;

  /// Ring the "bus arriving" alert like an alarm clock (full screen, loud) instead of a normal notification.
  bool alarmStyle = true;

  /// Latest message from the driver on this trip (traffic, breakdown, late...). Null when none.
  DriverMessage? driverMessage;
  BusInfo? bus;
  RouteInfo? route;
  bool loading = false;
  String? error;

  // Live data
  LiveLocation? location;
  Eta? eta;
  String? lastStatus; // AT_STOP, DEPARTED, GPS_POOR, OFFLINE, ACTIVE, INACTIVE
  String? lastStatusStop;
  DateTime? lastEventAt;
  bool socketConnected = false;
  bool hasInternet = true;
  bool tripCompleted = false;
  String? _direction; // direction of the current (or just finished) trip

  /// Where the driver started this trip, [lat, lng] (green START pin on the map).
  List<double>? tripStart;

  static List<double>? _readStart(Object? v) {
    if (v is Map && v['latitude'] is num && v['longitude'] is num) {
      return [(v['latitude'] as num).toDouble(), (v['longitude'] as num).toDouble()];
    }
    return null;
  }

  // Notifications
  final List<AppNotification> notifications = [];
  final StreamController<AppNotification> _incoming = StreamController.broadcast();
  Stream<AppNotification> get incoming => _incoming.stream;
  int get unread => notifications.where((n) => !n.read).length;

  io.Socket? _socket;
  int? _subscribedBusId;
  Timer? _ticker;
  StreamSubscription<List<ConnectivityResult>>? _connSub;

  bool get hasActiveTrip => bus?.activeTripId != null && !tripCompleted;

  LiveState get liveState {
    if (!hasInternet || !socketConnected) return LiveState.offline;
    if (!hasActiveTrip) return LiveState.live;
    final ts = location?.timestamp;
    if (ts == null) return LiveState.updating;
    final age = DateTime.now().difference(ts);
    if (age > AppConfig.offlineAfter) return LiveState.offline;
    if (age > AppConfig.updatingAfter) return LiveState.updating;
    return LiveState.live;
  }

  BusPhase get phase {
    if (tripCompleted) return BusPhase.completed;
    if (!hasActiveTrip) return BusPhase.notStarted;
    final ts = location?.timestamp;
    if (lastStatus == 'OFFLINE' || bus?.status == 'OFFLINE' || (ts != null && DateTime.now().difference(ts) > AppConfig.offlineAfter)) {
      return BusPhase.offline;
    }
    if (lastStatus == 'GPS_POOR') return BusPhase.gpsWeak;
    if (location?.atStopId != null) return BusPhase.atStop;
    final kmh = location?.speedKmh;
    if (kmh != null && kmh < 5) return BusPhase.stopped;
    return BusPhase.onRoute;
  }

  String? get atStopName {
    final id = location?.atStopId;
    if (id == null) return lastStatusStop;
    for (final s in route?.stops ?? <StopInfo>[]) {
      if (s.id == id) return s.name;
    }
    return lastStatusStop;
  }

  bool get isSimulation => location?.isSimulation == true;

  /// Direction of the running trip, or of the one that just finished; null when there is none.
  String? get direction => (hasActiveTrip || tripCompleted) ? (_direction ?? toCollege) : null;

  /// Route stops in the order the bus visits them on this trip (reversed for From College).
  List<StopInfo> get travelStops => route?.stopsFor(direction) ?? const <StopInfo>[];

  /// Called once after login.
  Future<void> start(String token) async {
    await load();
    _connectSocket(token);
    loadNotifications();
    final initial = await Connectivity().checkConnectivity();
    hasInternet = !initial.contains(ConnectivityResult.none);
    _connSub = Connectivity().onConnectivityChanged.listen((r) {
      final online = !r.contains(ConnectivityResult.none);
      if (online && !hasInternet) load();
      hasInternet = online;
      notifyListeners();
    });
    _ticker = Timer.periodic(const Duration(seconds: 5), (_) {
      _pollIfNeeded();
      notifyListeners(); // refresh "x s ago" and states
    });
  }

  Future<void> load() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final res = await api.get('/student/home');
      final s = res['student'] as Map<String, dynamic>? ?? {};
      studentName = s['name'] as String? ?? '';
      myStopId = s['stopId'] is num ? (s['stopId'] as num).toInt() : null;
      myStopName = s['stopName'] as String?;
      notificationsEnabled = s['notificationsEnabled'] != false;
      if (s['alertMinutes'] is num) alertMinutes = (s['alertMinutes'] as num).toInt();
      alarmStyle = (res['alarmStyle'] ?? s['alarmStyle']) != false;
      bus = res['bus'] is Map<String, dynamic> ? BusInfo.fromJson(res['bus'] as Map<String, dynamic>) : null;
      route = res['route'] is Map<String, dynamic> ? RouteInfo.fromJson(res['route'] as Map<String, dynamic>) : null;
      eta = Eta.fromJson(res['eta']) ?? eta;
      if (bus?.activeTripId != null) {
        tripCompleted = false;
        _direction = (res['direction'] as String?) ?? bus!.activeTripDirection ?? _direction;
        final last = bus!.lastLocation;
        if (last != null && (location == null || last.timestamp.isAfter(location!.timestamp))) location = last;
      }
      _subscribe();
      if (bus?.activeTripId != null) {
        _loadDriverMessage();
      } else {
        driverMessage = null;
      }
    } on ApiException catch (e) {
      error = e.message;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

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
      _subscribedBusId = null;
      _subscribe();
      notifyListeners();
    });
    socket.onDisconnect((_) {
      socketConnected = false;
      notifyListeners();
    });
    socket.onConnectError((_) {
      socketConnected = false;
      notifyListeners();
    });

    socket.on('bus:location', (data) {
      if (data is! Map) return;
      final loc = LiveLocation.fromEvent(Map<String, dynamic>.from(data));
      if (loc.busId != bus?.id) return;
      location = loc;
      _direction = loc.direction ?? _direction;
      tripStart = _readStart(data['start']) ?? tripStart;
      final e = Eta.fromJson(data['eta']);
      if (e != null) eta = e;
      if (lastStatus == 'GPS_POOR' || lastStatus == 'OFFLINE') lastStatus = 'ACTIVE';
      lastEventAt = DateTime.now();
      notifyListeners();
    });
    socket.on('bus:status', (data) {
      if (data is! Map || data['busId'] != bus?.id) return;
      lastStatus = data['status'] as String?;
      lastStatusStop = data['stopName'] as String?;
      lastEventAt = DateTime.now();
      notifyListeners();
    });
    socket.on('bus:message', (data) {
      if (data is! Map || data['busId'] != bus?.id) return;
      driverMessage = DriverMessage.fromJson(Map<String, dynamic>.from(data));
      notifyListeners();
    });
    socket.on('trip:started', (data) {
      if (data is Map && data['busId'] == bus?.id) {
        tripCompleted = false;
        driverMessage = null;
        location = null;
        eta = null;
        tripStart = null;
        _direction = data['direction'] as String? ?? toCollege;
        load();
      }
    });
    socket.on('trip:completed', (data) {
      if (data is Map && data['busId'] == bus?.id) {
        tripCompleted = true;
        driverMessage = null;
        _direction = data['direction'] as String? ?? _direction;
        eta = null;
        load();
      }
    });
    socket.on('notification:new', (data) {
      if (data is! Map) return;
      final n = AppNotification.fromJson(Map<String, dynamic>.from(data));
      notifications.insert(0, n);
      _incoming.add(n);
      notifyListeners();
    });
    socket.connect();
    _socket = socket;
  }

  /// Join the bus room so we receive its live events; the ack carries the latest point + ETA.
  void _subscribe() {
    final socket = _socket;
    final busId = bus?.id;
    if (socket == null || !socket.connected || busId == null || _subscribedBusId == busId) return;
    if (_subscribedBusId != null) socket.emit('bus:unsubscribe', {'busId': _subscribedBusId});
    _subscribedBusId = busId;
    socket.emitWithAck('bus:subscribe', {'busId': busId}, ack: (dynamic resp) {
      final r = resp is Map ? resp : (resp is List && resp.isNotEmpty && resp.first is Map ? resp.first as Map : null);
      if (r == null || r['ok'] != true) return;
      final loc = r['location'];
      if (loc is Map && bus?.activeTripId != null && loc['trip_id'] == bus?.activeTripId) {
        final l = LiveLocation.fromRow(Map<String, dynamic>.from(loc));
        if (location == null || l.timestamp.isAfter(location!.timestamp)) location = l;
        tripStart = _readStart({'latitude': loc['start_latitude'], 'longitude': loc['start_longitude']}) ?? tripStart;
        _direction = loc['direction'] as String? ?? _direction;
      }
      final e = Eta.fromJson(r['eta']);
      if (e != null) eta = e;
      notifyListeners();
    });
  }

  DateTime? _lastPoll;
  bool _polling = false;

  /// Safety net: if the live socket is down, or no ETA has arrived yet during a trip,
  /// fetch the latest position and ETA over HTTP every 10 seconds.
  Future<void> _pollIfNeeded() async {
    final b = bus;
    if (b == null || !hasActiveTrip || _polling) return;
    final fresh = location != null && DateTime.now().difference(location!.timestamp) < const Duration(seconds: 20);
    if (socketConnected && eta != null && fresh) return;
    if (_lastPoll != null && DateTime.now().difference(_lastPoll!) < const Duration(seconds: 10)) return;
    _lastPoll = DateTime.now();
    _polling = true;
    try {
      final res = await api.get('/buses/${b.id}/location');
      tripStart = _readStart(res['start']) ?? tripStart;
      final l = res['location'];
      if (l is Map && l['latitude'] != null) {
        final ts = DateTime.tryParse('${l['timestamp']}')?.toLocal() ?? DateTime.now();
        if (location == null || ts.isAfter(location!.timestamp)) {
          location = LiveLocation(
            busId: b.id,
            tripId: b.activeTripId,
            latitude: (l['latitude'] as num).toDouble(),
            longitude: (l['longitude'] as num).toDouble(),
            accuracy: l['accuracy'] is num ? (l['accuracy'] as num).toDouble() : null,
            speed: l['speed'] is num ? (l['speed'] as num).toDouble() : null,
            heading: l['heading'] is num ? (l['heading'] as num).toDouble() : null,
            timestamp: ts,
            isSimulation: l['isSimulation'] == true,
            direction: _direction,
          );
        }
      }
      final e = await api.get('/buses/${b.id}/eta');
      final parsed = Eta.fromJson(e['eta']);
      if (parsed != null) eta = parsed;
      notifyListeners();
    } on ApiException {
      // keep the last known values
    } finally {
      _polling = false;
    }
  }

  Future<void> loadNotifications() async {
    try {
      final res = await api.get('/notifications');
      notifications
        ..clear()
        ..addAll(((res['notifications'] as List?) ?? []).map((n) => AppNotification.fromJson(n as Map<String, dynamic>)));
      notifyListeners();
    } on ApiException {
      /* inbox is optional; ignore */
    }
  }

  Future<void> markAllRead() async {
    if (!notifications.any((n) => !n.read)) return;
    for (final n in notifications) {
      n.read = true;
    }
    notifyListeners();
    api.patch('/notifications/read-all').catchError((_) => <String, dynamic>{});
  }

  /// Removes one message from the list (swipe away).
  Future<void> removeNotification(int id) async {
    notifications.removeWhere((n) => n.id == id);
    notifyListeners();
    api.delete('/notifications/$id').catchError((_) => <String, dynamic>{});
  }

  /// Empties the whole list.
  Future<void> clearNotifications() async {
    notifications.clear();
    notifyListeners();
    await api.delete('/notifications');
  }

  Future<void> setNotificationsEnabled(bool enabled) async {
    notificationsEnabled = enabled;
    notifyListeners();
    try {
      await api.put('/me/notifications', {'enabled': enabled});
    } on ApiException {
      notificationsEnabled = !enabled;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> setAlertMinutes(int minutes) async {
    final old = alertMinutes;
    alertMinutes = minutes;
    notifyListeners();
    try {
      await api.put('/me/notifications', {'alertMinutes': minutes});
    } on ApiException {
      alertMinutes = old;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> setAlarmStyle(bool on) async {
    final old = alarmStyle;
    alarmStyle = on;
    notifyListeners();
    try {
      await api.put('/me/notifications', {'alarmStyle': on});
    } on ApiException {
      alarmStyle = old;
      notifyListeners();
      rethrow;
    }
  }

  /// Hides the driver's message banner (until the driver sends a new one).
  void dismissDriverMessage() {
    driverMessage = null;
    notifyListeners();
  }

  Future<void> _loadDriverMessage() async {
    final id = bus?.id;
    if (id == null) return;
    try {
      final res = await api.get('/buses/$id/messages');
      final list = (res['messages'] as List?) ?? const [];
      if (list.isNotEmpty && list.first is Map) {
        final m = DriverMessage.fromJson(Map<String, dynamic>.from(list.first as Map));
        // Older than 2 hours is no longer useful.
        if (DateTime.now().difference(m.at) < const Duration(hours: 2)) {
          driverMessage = m;
          notifyListeners();
        }
      }
    } on ApiException {
      // optional
    }
  }

  Future<List<BusInfo>> listBuses() async {
    final res = await api.get('/student/buses');
    return ((res['buses'] as List?) ?? []).map((b) => BusInfo.fromJson(b as Map<String, dynamic>)).toList();
  }

  Future<void> chooseBus(int busId) async {
    await api.put('/student/bus', {'busId': busId});
    tripCompleted = false;
    _direction = null;
    location = null;
    eta = null;
    tripStart = null;
    lastStatus = null;
    await load();
  }

  Future<void> chooseStop(int stopId) async {
    await api.put('/student/stop', {'stopId': stopId});
    await load();
  }

  Future<void> reset() async {
    _ticker?.cancel();
    await _connSub?.cancel();
    _socket?.dispose();
    _socket = null;
    _subscribedBusId = null;
    socketConnected = false;
    bus = null;
    route = null;
    location = null;
    eta = null;
    driverMessage = null;
    notifications.clear();
    notifyListeners();
  }

  @override
  void dispose() {
    reset();
    _incoming.close();
    super.dispose();
  }
}

/// A message the driver sent to everyone on the bus.
class DriverMessage {
  DriverMessage({required this.kind, required this.text, this.minutes, required this.at});
  final String kind; // TRAFFIC, BREAKDOWN, LATE, OTHER
  final String text;
  final int? minutes;
  final DateTime at;

  factory DriverMessage.fromJson(Map<String, dynamic> j) => DriverMessage(
        kind: (j['kind'] as String?) ?? 'OTHER',
        text: (j['text'] ?? j['message'] ?? '') as String,
        minutes: j['minutes'] is num ? (j['minutes'] as num).toInt() : null,
        at: DateTime.tryParse('${j['at'] ?? j['created_at']}')?.toLocal() ?? DateTime.now(),
      );
}
