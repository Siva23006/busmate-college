import 'package:flutter/material.dart';

import '../models/models.dart';
import '../providers/bus_provider.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';

/// FROM -> TO line for the current trip with the admin's place names
/// (e.g. Redhills -> Dr. MGR University in the morning, the reverse in the evening).
class RouteHeader extends StatelessWidget {
  const RouteHeader({super.key, required this.p, this.onDark = false});
  final BusProvider p;
  final bool onDark;

  @override
  Widget build(BuildContext context) {
    final r = p.route;
    // Before a trip starts, show the run that is next by time of day.
    final dir = p.direction ?? (DateTime.now().hour < 12 ? toCollege : fromCollege);
    final from = r?.fromFor(dir) ?? 'Start';
    final to = r?.toFor(dir) ?? 'College';
    final time = r?.timeFor(dir);
    final color = onDark ? Colors.white : Theme.of(context).colorScheme.onSurface;
    TextStyle style() => TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: color);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        const Icon(Icons.trip_origin_rounded, size: 16, color: BrandColors.green),
        const SizedBox(width: 6),
        Flexible(child: Text(from, maxLines: 1, overflow: TextOverflow.ellipsis, style: style())),
        const Padding(padding: EdgeInsets.symmetric(horizontal: 8), child: Icon(Icons.arrow_forward_rounded, size: 18, color: BrandColors.amber)),
        const Icon(Icons.flag_rounded, size: 16, color: BrandColors.amber),
        const SizedBox(width: 6),
        Flexible(child: Text(to, maxLines: 1, overflow: TextOverflow.ellipsis, style: style())),
      ]),
      if (!p.hasActiveTrip && time != null)
        Padding(
          padding: const EdgeInsets.only(top: 4, left: 22),
          child: Text('${dir == fromCollege ? 'Evening' : 'Morning'} bus leaves at ${clock12(time)}',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Theme.of(context).hintColor)),
        ),
    ]);
  }
}

/// The big answer: when will the bus reach MY stop (or the college if no stop is set).
class BigEtaCard extends StatelessWidget {
  const BigEtaCard({super.key, required this.p});
  final BusProvider p;

  @override
  Widget build(BuildContext context) {
    final mine = p.eta?.forStop(p.myStopId);
    final target = (mine != null && !mine.passed) ? mine : (p.myStopId == null ? p.eta?.destination : null);
    String title;
    String big;
    String sub;
    if (!p.hasActiveTrip) {
      title = p.tripCompleted ? 'TRIP COMPLETED' : 'BUS NOT STARTED';
      big = p.tripCompleted ? 'Done' : '--';
      sub = p.tripCompleted ? 'See you on the next trip.' : 'Live arrival appears when the driver starts the trip.';
    } else if (mine != null && mine.passed) {
      title = 'YOUR STOP';
      big = 'Passed';
      sub = 'The bus has already left ${p.myStopName ?? 'your stop'}.';
    } else if (target == null) {
      title = 'ESTIMATED ARRIVAL';
      big = '…';
      sub = p.location == null ? 'Waiting for the bus GPS…' : 'Calculating…';
    } else {
      title = target.stopId == p.myStopId ? 'ARRIVES AT YOUR STOP' : 'ARRIVES AT ${target.name.toUpperCase()}';
      final m = target.etaSeconds == null ? null : (target.etaSeconds! / 60).round();
      big = m == null ? '--' : (m < 1 ? 'Now' : '$m');
      sub = 'Expected ${clockTime(target.expectedAt)} · ${distanceText(target.remainingMeters)} away';
    }
    final isMinutes = int.tryParse(big) != null;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFFFFC72C), BrandColors.amber]),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(color: BrandColors.ink, fontSize: 12, fontWeight: FontWeight.w900, letterSpacing: 1.3)),
            const SizedBox(height: 4),
            Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
              Text(big, style: const TextStyle(color: BrandColors.ink, fontSize: 46, fontWeight: FontWeight.w900, height: 1.05)),
              if (isMinutes) const Padding(padding: EdgeInsets.only(left: 6), child: Text('min', style: TextStyle(color: BrandColors.ink, fontSize: 20, fontWeight: FontWeight.w800))),
            ]),
            const SizedBox(height: 4),
            Text(sub, style: const TextStyle(color: BrandColors.ink, fontSize: 14, fontWeight: FontWeight.w600)),
          ]),
        ),
        Container(
          width: 58,
          height: 58,
          decoration: BoxDecoration(color: BrandColors.ink, borderRadius: BorderRadius.circular(18)),
          child: const Icon(Icons.schedule_rounded, color: BrandColors.amber, size: 32),
        ),
      ]),
    );
  }
}

/// Small stat box: speed, next stop, last update.
class StatTile extends StatelessWidget {
  const StatTile({super.key, required this.icon, required this.label, required this.value});
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final hint = Theme.of(context).hintColor;
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, size: 20, color: BrandColors.amber),
          const SizedBox(height: 6),
          Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
          Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: hint)),
        ]),
      ),
    );
  }
}

/// Vertical journey: every stop in travel order with passed / next / my stop and times.
class JourneyTimeline extends StatelessWidget {
  const JourneyTimeline({super.key, required this.p});
  final BusProvider p;

  @override
  Widget build(BuildContext context) {
    final stops = p.hasActiveTrip ? p.travelStops : (p.route?.stops ?? const <StopInfo>[]);
    if (stops.isEmpty) return const SizedBox.shrink();
    final hint = Theme.of(context).hintColor;
    final line = Theme.of(context).dividerColor;
    final nextId = p.eta?.nextStop?.stopId;
    return Column(children: [
      for (var i = 0; i < stops.length; i++)
        () {
          final s = stops[i];
          final e = p.hasActiveTrip ? p.eta?.forStop(s.id) : null;
          final passed = e?.passed == true;
          final isNext = s.id == nextId && p.hasActiveTrip;
          final mine = s.id == p.myStopId;
          final atStop = p.location?.atStopId == s.id;
          final dot = atStop
              ? BrandColors.green
              : isNext
                  ? BrandColors.amber
                  : passed
                      ? Colors.grey
                      : (mine ? BrandColors.amber : BrandColors.ink3);
          final right = !p.hasActiveTrip
              ? (s.scheduledTime == null ? '' : s.scheduledTime!.substring(0, 5))
              : passed
                  ? 'Passed'
                  : (e?.expectedAt == null ? '' : '${clockTime(e!.expectedAt)} · ${etaText(e.etaSeconds)}');
          return IntrinsicHeight(
            child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              SizedBox(
                width: 28,
                child: Column(children: [
                  Expanded(child: Container(width: 3, color: i == 0 ? Colors.transparent : (passed ? BrandColors.green : line))),
                  Container(
                    width: isNext || mine ? 18 : 13,
                    height: isNext || mine ? 18 : 13,
                    decoration: BoxDecoration(color: dot, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 2.5)),
                  ),
                  Expanded(child: Container(width: 3, color: i == stops.length - 1 ? Colors.transparent : (passed ? BrandColors.green : line))),
                ]),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 9),
                  child: Row(children: [
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(s.name,
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: mine || isNext ? FontWeight.w900 : FontWeight.w600,
                              color: passed ? hint : null,
                            )),
                        if (mine || isNext || atStop)
                          Text(atStop ? 'Bus is here now' : (mine ? (isNext ? 'Your stop · next' : 'Your stop') : 'Next stop'),
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: atStop ? BrandColors.green : BrandColors.amber)),
                      ]),
                    ),
                    Text(right, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: passed ? hint : null)),
                  ]),
                ),
              ),
            ]),
          );
        }(),
    ]);
  }
}
