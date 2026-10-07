// Plain data classes parsed from the BusMate API.

int? _int(dynamic v) => v == null ? null : (v is num ? v.toInt() : int.tryParse(v.toString()));
double? _double(dynamic v) => v == null ? null : (v is num ? v.toDouble() : double.tryParse(v.toString()));
DateTime? _date(dynamic v) => v == null ? null : DateTime.tryParse(v.toString())?.toLocal();

/// Trip direction. A route's stops are stored in TO_COLLEGE order (last stop = college);
/// a FROM_COLLEGE (evening) trip visits them in reverse.
const String toCollege = 'TO_COLLEGE';
const String fromCollege = 'FROM_COLLEGE';

String directionLabel(String? direction) => direction == fromCollege ? 'From College' : 'To College';
String directionShift(String? direction) => direction == fromCollege ? 'EVENING' : 'MORNING';

/// Before 12:00 the next run is the morning one to the college.
String directionForTime(DateTime now) => now.hour < 12 ? toCollege : fromCollege;

class AppUser {
  AppUser({required this.id, required this.name, required this.role, this.email, this.employeeId});
  final int id;
  final String name;
  final String role;
  final String? email;
  final String? employeeId;

  factory AppUser.fromJson(Map<String, dynamic> j) => AppUser(
        id: _int(j['id'])!,
        name: j['name'] as String? ?? '',
        role: j['role'] as String? ?? '',
        email: j['email'] as String?,
        employeeId: (j['driver'] as Map<String, dynamic>?)?['employeeId'] as String?,
      );
}

class StopInfo {
  StopInfo({required this.id, required this.name, required this.order, required this.latitude, required this.longitude, this.scheduledTime});
  final int id;
  final String name;
  final int order;
  final double latitude;
  final double longitude;
  final String? scheduledTime; // "HH:MM:SS"

  factory StopInfo.fromJson(Map<String, dynamic> j) => StopInfo(
        id: _int(j['id'])!,
        name: j['stop_name'] as String? ?? '',
        order: _int(j['stop_order']) ?? 0,
        latitude: _double(j['latitude']) ?? 0,
        longitude: _double(j['longitude']) ?? 0,
        scheduledTime: j['estimated_time'] as String?,
      );
}

class RouteInfo {
  RouteInfo({required this.id, required this.name, this.start, this.destination, this.stops = const [], this.path});
  final int id;
  final String name;
  final String? start;
  final String? destination;
  final List<StopInfo> stops; // stored order: towards the college
  final List<List<double>>? path; // [[lat,lng], ...] road line, if the backend generated one

  /// Stops in the order the bus visits them on a trip in this direction.
  List<StopInfo> stopsFor(String? direction) => direction == fromCollege ? stops.reversed.toList() : stops;

  /// Where a trip in this direction begins and ends.
  String? startFor(String? direction) => direction == fromCollege ? destination : start;
  String? destinationFor(String? direction) => direction == fromCollege ? start : destination;

  factory RouteInfo.fromJson(Map<String, dynamic> j) {
    final stops = ((j['stops'] as List?) ?? []).map((s) => StopInfo.fromJson(s as Map<String, dynamic>)).toList()
      ..sort((a, b) => a.order.compareTo(b.order));
    final rawPath = j['path'];
    return RouteInfo(
      id: _int(j['id'])!,
      name: j['route_name'] as String? ?? '',
      start: j['start_location'] as String? ?? (stops.isNotEmpty ? stops.first.name : null),
      destination: j['destination'] as String? ?? (stops.isNotEmpty ? stops.last.name : null),
      stops: stops,
      path: rawPath is List
          ? rawPath.whereType<List>().where((p) => p.length >= 2).map((p) => [(_double(p[0]) ?? 0), (_double(p[1]) ?? 0)]).toList()
          : null,
    );
  }

  /// First stop's scheduled time, used as "scheduled start".
  String? get scheduledStart => stops.isNotEmpty ? stops.first.scheduledTime?.substring(0, 5) : null;
}

class BusInfo {
  BusInfo({required this.id, required this.number, required this.status, this.registration, this.route, this.activeTripId, this.isDemo = false});
  final int id;
  final String number;
  final String status;
  final String? registration;
  final RouteInfo? route;
  final int? activeTripId;
  final bool isDemo;

  factory BusInfo.fromJson(Map<String, dynamic> j) => BusInfo(
        id: _int(j['id'])!,
        number: j['bus_number'] as String? ?? '',
        status: j['status'] as String? ?? 'INACTIVE',
        registration: j['registration_number'] as String?,
        route: j['route'] is Map<String, dynamic> ? RouteInfo.fromJson(j['route'] as Map<String, dynamic>) : null,
        activeTripId: _int(j['active_trip_id']),
        isDemo: j['is_demo'] == true,
      );
}

class Trip {
  Trip({required this.id, required this.busId, required this.busNumber, required this.status, this.routeName, this.startTime, this.endTime, this.distanceMeters, this.durationSeconds, this.isSimulation = false, this.direction = toCollege, this.stopsReached, this.stopsTotal});
  final int id;
  final int busId;
  final String busNumber;
  final String status;
  final String? routeName;
  final DateTime? startTime;
  final DateTime? endTime;
  final double? distanceMeters;
  final int? durationSeconds;
  final bool isSimulation;
  final String direction;
  final int? stopsReached;
  final int? stopsTotal;

  factory Trip.fromJson(Map<String, dynamic> j) => Trip(
        id: _int(j['id'])!,
        busId: _int(j['bus_id'])!,
        busNumber: j['bus_number'] as String? ?? '',
        status: j['status'] as String? ?? '',
        routeName: j['route_name'] as String?,
        startTime: _date(j['start_time']),
        endTime: _date(j['end_time']),
        distanceMeters: _double(j['distance_meters']),
        durationSeconds: _int(j['duration_seconds']),
        isSimulation: j['is_simulation'] == true,
        direction: j['direction'] as String? ?? toCollege,
        stopsReached: _int(j['stops_reached']),
        stopsTotal: _int(j['stops_total']),
      );
}

class DriverHome {
  DriverHome({required this.name, required this.employeeId, required this.buses, this.activeTrip});
  final String name;
  final String employeeId;
  final List<BusInfo> buses;
  final Trip? activeTrip;

  factory DriverHome.fromJson(Map<String, dynamic> j) {
    final d = j['driver'] as Map<String, dynamic>? ?? {};
    return DriverHome(
      name: d['name'] as String? ?? '',
      employeeId: d['employeeId'] as String? ?? '',
      buses: ((j['buses'] as List?) ?? []).map((b) => BusInfo.fromJson(b as Map<String, dynamic>)).toList(),
      activeTrip: j['activeTrip'] is Map<String, dynamic> ? Trip.fromJson(j['activeTrip'] as Map<String, dynamic>) : null,
    );
  }
}
