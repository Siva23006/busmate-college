import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../models/models.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import 'common.dart';

/// Straight-line distance from the first stop to each stop, along the stop order (metres).
List<double> cumulativeStopMeters(List<StopInfo> stops) {
  final out = <double>[];
  var total = 0.0;
  for (var i = 0; i < stops.length; i++) {
    if (i > 0) {
      final a = stops[i - 1], b = stops[i];
      total += Geolocator.distanceBetween(a.latitude, a.longitude, b.latitude, b.longitude);
    }
    out.add(total);
  }
  return out;
}

/// Length of the route: along the saved road line when there is one, else stop to stop.
double routeLengthMeters(RouteInfo route) {
  final path = route.path;
  if (path != null && path.length >= 2) {
    var total = 0.0;
    for (var i = 1; i < path.length; i++) {
      total += Geolocator.distanceBetween(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1]);
    }
    return total;
  }
  final c = cumulativeStopMeters(route.stops);
  return c.isEmpty ? 0 : c.last;
}

/// Scheduled time ("HH:MM[:SS]") at stop [index] of a trip in [direction].
/// Stop times are set for the morning run; the evening run only has its departure time.
String? stopTimeFor(RouteInfo route, String direction, int index, StopInfo stop) {
  if (direction == fromCollege) return index == 0 ? route.eveningTime : null;
  return stop.scheduledTime;
}

int? _minutesOfDay(String? hhmm) {
  if (hhmm == null) return null;
  final p = hhmm.split(':');
  if (p.length < 2) return null;
  final h = int.tryParse(p[0]), m = int.tryParse(p[1]);
  return h == null || m == null ? null : h * 60 + m;
}

/// Planned duration from the first to the last stop's scheduled times (morning run only).
Duration? scheduledDuration(RouteInfo route, String direction) {
  if (direction == fromCollege || route.stops.length < 2) return null;
  final a = _minutesOfDay(route.stops.first.scheduledTime), b = _minutesOfDay(route.stops.last.scheduledTime);
  if (a == null || b == null || b <= a) return null;
  return Duration(minutes: b - a);
}

/// Vertical timeline of a route's stops.
///
/// Pre-trip ([live] false): every stop is upcoming. During a trip: stops before [passed] are
/// done (green check), stop [passed] is the next one (amber), the rest are hollow circles.
class RouteTimeline extends StatelessWidget {
  const RouteTimeline({
    super.key,
    required this.route,
    required this.direction,
    this.live = false,
    this.passed = 0,
    this.nextEtaSeconds,
    this.nextMeters,
    this.nextName,
  });
  final RouteInfo route;
  final String direction;
  final bool live;
  final int passed;
  final int? nextEtaSeconds;
  final int? nextMeters;

  /// Next stop name reported by the server (used to pick the right row when known).
  final String? nextName;

  @override
  Widget build(BuildContext context) {
    final stops = route.stopsFor(direction);
    if (stops.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(20),
        child: Text('No stops on this route yet.', style: TextStyle(fontSize: 14, color: context.hint)),
      );
    }
    final dist = cumulativeStopMeters(stops);
    var next = live ? passed : -1;
    if (live && nextName != null) {
      final i = stops.indexWhere((s) => s.name == nextName);
      if (i >= 0) next = i;
    }
    if (next > stops.length) next = stops.length;
    return Column(children: [
      for (var i = 0; i < stops.length; i++)
        FadeSlideIn(
          delay: FadeSlideIn.stagger(i, stepMs: 45),
          child: _StopRow(
            stop: stops[i],
            index: i,
            count: stops.length,
            state: !live ? _StopState.upcoming : (i < next ? _StopState.done : (i == next ? _StopState.next : _StopState.upcoming)),
            lineBeforeDone: live && i <= next && i > 0,
            lineAfterDone: live && i < next,
            time: stopTimeFor(route, direction, i, stops[i]),
            meters: dist[i],
            etaSeconds: i == next ? nextEtaSeconds : null,
            remainingMeters: i == next ? nextMeters : null,
          ),
        ),
    ]);
  }
}

enum _StopState { done, next, upcoming }

class _StopRow extends StatelessWidget {
  const _StopRow({
    required this.stop,
    required this.index,
    required this.count,
    required this.state,
    required this.lineBeforeDone,
    required this.lineAfterDone,
    required this.time,
    required this.meters,
    this.etaSeconds,
    this.remainingMeters,
  });
  final StopInfo stop;
  final int index;
  final int count;
  final _StopState state;
  final bool lineBeforeDone;
  final bool lineAfterDone;
  final String? time;
  final double meters;
  final int? etaSeconds;
  final int? remainingMeters;

  @override
  Widget build(BuildContext context) {
    final first = index == 0, last = index == count - 1;
    final hint = context.hint;
    final amber = context.amberText;
    final String status = switch (state) {
      _StopState.done => first ? 'Departed' : 'Reached',
      _StopState.next => etaSeconds != null
          ? (etaSeconds! < 60 ? 'Arriving now' : 'Arriving in ${minutesText(etaSeconds!)}')
          : 'Next stop',
      _StopState.upcoming => first ? 'Start' : (last ? 'Destination' : ''),
    };
    final Color statusColor = switch (state) {
      _StopState.done => BrandColors.green,
      _StopState.next => amber,
      _StopState.upcoming => hint,
    };
    final distText = state == _StopState.next && remainingMeters != null
        ? '${distanceText(remainingMeters!.toDouble())} away'
        : (first ? '0 km' : distanceText(meters));

    return IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        SizedBox(
          width: 30,
          child: Column(children: [
            Expanded(child: _Rail(visible: !first, done: lineBeforeDone)),
            _Node(state: state, last: last),
            Expanded(child: _Rail(visible: !last, done: lineAfterDone)),
          ]),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            margin: const EdgeInsets.symmetric(vertical: 4),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: state == _StopState.next ? BrandColors.amber.withValues(alpha: context.isDarkTheme ? 0.14 : 0.10) : Colors.transparent,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: state == _StopState.next ? BrandColors.amber.withValues(alpha: 0.6) : Colors.transparent),
            ),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                  Text(stop.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: state == _StopState.next ? FontWeight.w800 : FontWeight.w600,
                        color: state == _StopState.done ? hint : null,
                      )),
                  if (status.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      state == _StopState.done && time != null ? '$status · ${clock12(time)}' : status,
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: statusColor),
                    ),
                  ],
                ]),
              ),
              const SizedBox(width: 8),
              Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: [
                Text(time == null ? '--' : clock12(time), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text(distText, style: TextStyle(fontSize: 11, color: hint)),
              ]),
            ]),
          ),
        ),
      ]),
    );
  }
}

class _Rail extends StatelessWidget {
  const _Rail({required this.visible, required this.done});
  final bool visible;
  final bool done;

  @override
  Widget build(BuildContext context) {
    if (!visible) return const SizedBox(width: 2);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 400),
      width: 2.5,
      color: done ? BrandColors.green : context.outline,
    );
  }
}

class _Node extends StatelessWidget {
  const _Node({required this.state, required this.last});
  final _StopState state;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return switch (state) {
      _StopState.done => Container(
          width: 22,
          height: 22,
          decoration: const BoxDecoration(color: BrandColors.green, shape: BoxShape.circle),
          child: const Icon(Icons.check_rounded, size: 14, color: Colors.white),
        ),
      _StopState.next => Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            color: BrandColors.amber,
            shape: BoxShape.circle,
            boxShadow: [BoxShadow(color: BrandColors.amber.withValues(alpha: 0.45), blurRadius: 8, spreadRadius: 1)],
          ),
          child: const Icon(Icons.near_me_rounded, size: 13, color: BrandColors.ink),
        ),
      _StopState.upcoming => Container(
          width: 18,
          height: 18,
          decoration: BoxDecoration(
            color: context.surface,
            shape: BoxShape.circle,
            border: Border.all(color: last ? context.amberText : context.hint.withValues(alpha: 0.6), width: 2),
          ),
          child: last ? Icon(Icons.flag_rounded, size: 10, color: context.amberText) : null,
        ),
    };
  }
}

/// "Total distance / Estimated duration" footer for a route.
class RouteTotalsCard extends StatelessWidget {
  const RouteTotalsCard({super.key, required this.route, required this.direction, this.arriveAt});
  final RouteInfo route;
  final String direction;

  /// During a trip: the server's estimated arrival at the destination.
  final DateTime? arriveAt;

  @override
  Widget build(BuildContext context) {
    final meters = routeLengthMeters(route);
    final planned = scheduledDuration(route, direction);
    // Fall back to ~25 km/h average for a city bus when no times are set.
    final estimate = planned ?? (meters > 0 ? Duration(minutes: (meters / 1000 / 25 * 60).round()) : null);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(children: [
          Expanded(child: StatTile(icon: Icons.straighten_rounded, label: 'Total Distance', value: meters > 0 ? '~${distanceText(meters)}' : '-')),
          const SizedBox(width: 10),
          Expanded(
            child: arriveAt != null
                ? StatTile(icon: Icons.flag_rounded, label: 'Arrive by', value: clockTime(arriveAt), color: BrandColors.green)
                : StatTile(
                    icon: Icons.schedule_rounded,
                    label: planned != null ? 'Scheduled Duration' : 'Estimated Duration',
                    value: estimate == null ? '-' : shortDuration(estimate),
                  ),
          ),
        ]),
      ),
    );
  }
}
