// Plain data classes parsed from the BusMate API / Socket.IO events.

int? _int(dynamic v) => v == null ? null : (v is num ? v.toInt() : int.tryParse(v.toString()));
double? _double(dynamic v) => v == null ? null : (v is num ? v.toDouble() : double.tryParse(v.toString()));
DateTime? _date(dynamic v) => v == null ? null : DateTime.tryParse(v.toString())?.toLocal();

/// Trip direction. A route's stops are stored in TO_COLLEGE order (last stop = college);
/// a FROM_COLLEGE (evening) trip visits them in reverse.
const String toCollege = 'TO_COLLEGE';
const String fromCollege = 'FROM_COLLEGE';

String directionLabel(String? direction) => direction == fromCollege ? 'From College' : 'To College';

class AppUser {
  AppUser({required this.id, required this.name, required this.role, this.notificationsEnabled = true});
  final int id;
  final String name;
  final String role;
  final bool notificationsEnabled;

  factory AppUser.fromJson(Map<String, dynamic> j) => AppUser(
        id: _int(j['id'])!,
        name: j['name'] as String? ?? '',
        role: j['role'] as String? ?? '',
        notificationsEnabled: j['notificationsEnabled'] != false,
      );
}

class StopInfo {
  StopInfo({required this.id, required this.name, required this.order, required this.latitude, required this.longitude, this.radius = 100, this.scheduledTime});
  final int id;
  final String name;
  final int order;
  final double latitude;
  final double longitude;
  final int radius;
  final String? scheduledTime;

  factory StopInfo.fromJson(Map<String, dynamic> j) => StopInfo(
        id: _int(j['id'])!,
        name: j['stop_name'] as String? ?? '',
        order: _int(j['stop_order']) ?? 0,
        latitude: _double(j['latitude']) ?? 0,
        longitude: _double(j['longitude']) ?? 0,
        radius: _int(j['geofence_radius']) ?? 100,
        scheduledTime: j['estimated_time'] as String?,
      );

  StopInfo withOrder(int order) =>
      StopInfo(id: id, name: name, order: order, latitude: latitude, longitude: longitude, radius: radius, scheduledTime: scheduledTime);
}

class RouteInfo {
  RouteInfo({required this.id, required this.name, this.start, this.destination, this.stops = const [], this.path});
  final int id;
  final String name;
  final String? start;
  final String? destination;
  final List<StopInfo> stops;
  final List<List<double>>? path; // [[lat,lng], ...] optional detailed road path

  /// Stops in the order the bus visits them, numbered from 1 along that direction.
  List<StopInfo> stopsFor(String? direction) {
    if (direction != fromCollege) return stops;
    final reversed = stops.reversed.toList();
    return [for (var i = 0; i < reversed.length; i++) reversed[i].withOrder(i + 1)];
  }

  factory RouteInfo.fromJson(Map<String, dynamic> j) {
    final stops = ((j['stops'] as List?) ?? []).map((s) => StopInfo.fromJson(s as Map<String, dynamic>)).toList()
      ..sort((a, b) => a.order.compareTo(b.order));
    final rawPath = j['path'];
    return RouteInfo(
      id: _int(j['id'])!,
      name: j['route_name'] as String? ?? '',
      start: j['start_location'] as String?,
      destination: j['destination'] as String?,
      stops: stops,
      path: rawPath is List
          ? rawPath.whereType<List>().map((p) => [(_double(p[0]) ?? 0), (_double(p[1]) ?? 0)]).toList()
          : null,
    );
  }
}

class BusInfo {
  BusInfo({required this.id, required this.number, required this.status, this.routeId, this.routeName, this.driverName,
      this.activeTripId, this.activeTripDirection, this.isDemo = false, this.isMyRoute = false, this.lastLocation});
  final int id;
  final String number;
  final String status;
  final int? routeId;
  final String? routeName;
  final String? driverName;
  final int? activeTripId;
  final String? activeTripDirection;
  final bool isDemo;
  final bool isMyRoute;
  final LiveLocation? lastLocation;

  factory BusInfo.fromJson(Map<String, dynamic> j) => BusInfo(
        id: _int(j['id'])!,
        number: j['bus_number'] as String? ?? '',
        status: j['status'] as String? ?? 'INACTIVE',
        routeId: _int(j['route_id']),
        routeName: j['route_name'] as String?,
        driverName: j['driver_name'] as String?,
        activeTripId: _int(j['active_trip_id']),
        activeTripDirection: j['active_trip_direction'] as String?,
        isDemo: j['is_demo'] == true,
        isMyRoute: j['isMyRoute'] == true,
        lastLocation: j['latitude'] == null
            ? null
            : LiveLocation(
                busId: _int(j['id'])!,
                tripId: _int(j['active_trip_id']),
                latitude: _double(j['latitude'])!,
                longitude: _double(j['longitude'])!,
                accuracy: _double(j['accuracy']),
                speed: _double(j['speed']),
                heading: _double(j['heading']),
                timestamp: _date(j['location_time']) ?? DateTime.now(),
                isSimulation: j['location_is_simulation'] == true,
              ),
      );
}

class EtaStop {
  EtaStop({required this.stopId, required this.name, required this.order, required this.passed, this.remainingMeters, this.etaSeconds, this.expectedAt});
  final int stopId;
  final String name;
  final int order;
  final bool passed;
  final int? remainingMeters;
  final int? etaSeconds;
  final DateTime? expectedAt;

  factory EtaStop.fromJson(Map<String, dynamic> j) => EtaStop(
        stopId: _int(j['stopId'])!,
        name: j['stopName'] as String? ?? '',
        order: _int(j['stopOrder']) ?? 0,
        passed: j['passed'] == true,
        remainingMeters: _int(j['remainingMeters']),
        etaSeconds: _int(j['etaSeconds']),
        expectedAt: _date(j['expectedAt']),
      );
}

class Eta {
  Eta({required this.stops, this.nextStop, this.destination, this.computedAt, this.direction});
  final List<EtaStop> stops; // in the order the bus visits them
  final String? direction;
  final EtaStop? nextStop;
  final EtaStop? destination;
  final DateTime? computedAt;

  EtaStop? forStop(int? stopId) {
    if (stopId == null) return null;
    for (final s in stops) {
      if (s.stopId == stopId) return s;
    }
    return null;
  }

  static Eta? fromJson(dynamic j) {
    if (j is! Map<String, dynamic>) return null;
    return Eta(
      stops: ((j['stops'] as List?) ?? []).map((s) => EtaStop.fromJson(s as Map<String, dynamic>)).toList(),
      nextStop: j['nextStop'] is Map<String, dynamic> ? EtaStop.fromJson(j['nextStop'] as Map<String, dynamic>) : null,
      destination: j['destination'] is Map<String, dynamic> ? EtaStop.fromJson(j['destination'] as Map<String, dynamic>) : null,
      computedAt: _date(j['computedAt']),
      direction: j['direction'] as String?,
    );
  }
}

class LiveLocation {
  LiveLocation({required this.busId, required this.latitude, required this.longitude, required this.timestamp,
      this.tripId, this.accuracy, this.accuracyLevel, this.speed, this.heading, this.isSimulation = false, this.atStopId, this.direction});
  final int busId;
  final int? tripId;
  final double latitude;
  final double longitude;
  final double? accuracy;
  final String? accuracyLevel;
  final double? speed; // m/s
  final double? heading;
  final DateTime timestamp;
  final bool isSimulation;
  final int? atStopId;
  final String? direction;

  double? get speedKmh => speed == null ? null : speed! * 3.6;

  /// From the "bus:location" socket event.
  factory LiveLocation.fromEvent(Map<String, dynamic> j) => LiveLocation(
        busId: _int(j['busId'])!,
        tripId: _int(j['tripId']),
        latitude: _double(j['latitude'])!,
        longitude: _double(j['longitude'])!,
        accuracy: _double(j['accuracy']),
        accuracyLevel: j['accuracyLevel'] as String?,
        speed: _double(j['speed']),
        heading: _double(j['heading']),
        timestamp: _date(j['timestamp']) ?? DateTime.now(),
        isSimulation: j['isSimulation'] == true,
        atStopId: _int(j['atStopId']),
        direction: j['direction'] as String?,
      );

  /// From a live_locations DB row (bus:subscribe ack).
  factory LiveLocation.fromRow(Map<String, dynamic> j) => LiveLocation(
        busId: _int(j['bus_id'])!,
        tripId: _int(j['trip_id']),
        latitude: _double(j['latitude'])!,
        longitude: _double(j['longitude'])!,
        accuracy: _double(j['accuracy']),
        speed: _double(j['speed']),
        heading: _double(j['heading']),
        timestamp: _date(j['timestamp']) ?? DateTime.now(),
        isSimulation: j['is_simulation'] == true,
      );
}

class AppNotification {
  AppNotification({required this.id, required this.title, required this.message, required this.type, required this.read, required this.createdAt});
  final int id;
  final String title;
  final String message;
  final String type;
  bool read;
  final DateTime createdAt;

  factory AppNotification.fromJson(Map<String, dynamic> j) => AppNotification(
        id: _int(j['id'])!,
        title: j['title'] as String? ?? '',
        message: j['message'] as String? ?? '',
        type: j['type'] as String? ?? '',
        read: j['read'] == true,
        createdAt: _date(j['created_at']) ?? DateTime.now(),
      );
}
