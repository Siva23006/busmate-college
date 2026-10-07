import 'package:flutter/material.dart';

import '../models/models.dart';
import '../providers/bus_provider.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import 'common.dart';

/// Direction of the current (or next) run by time of day when no trip is running.
String currentRunDirection(BusProvider p) => p.direction ?? (DateTime.now().hour < 12 ? toCollege : fromCollege);

/// "Morning · Redhills → Dr. MGR University" with the admin's place names
/// (the reverse in the evening).
class RouteHeader extends StatelessWidget {
  const RouteHeader({super.key, required this.p, this.onDark = false});
  final BusProvider p;
  final bool onDark;

  @override
  Widget build(BuildContext context) {
    final pal = Palette.of(context);
    final r = p.route;
    final dir = currentRunDirection(p);
    final evening = dir == fromCollege;
    final from = r?.fromFor(dir) ?? 'Start';
    final to = r?.toFor(dir) ?? 'College';
    final color = onDark ? Colors.white : pal.text;
    final muted = onDark ? Colors.white70 : pal.muted;
    return Row(children: [
      Icon(evening ? Icons.nights_stay_rounded : Icons.wb_sunny_rounded, size: 15, color: evening ? BrandColors.indigo : BrandColors.amber),
      const SizedBox(width: 6),
      Text(evening ? 'Evening' : 'Morning', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: color)),
      Text('  ·  ', style: TextStyle(fontSize: 13, color: muted)),
      Flexible(
        child: Text('$from → $to',
            maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: muted)),
      ),
    ]);
  }
}

/// The answer: when will the bus reach MY stop (or the college if no stop is set).
class BigEtaCard extends StatelessWidget {
  const BigEtaCard({super.key, required this.p});
  final BusProvider p;

  @override
  Widget build(BuildContext context) {
    final pal = Palette.of(context);
    final mine = p.eta?.forStop(p.myStopId);
    final target = (mine != null && !mine.passed) ? mine : (p.myStopId == null ? p.eta?.destination : null);

    // ---------- No trip running: friendly state ----------
    if (!p.hasActiveTrip) {
      final dir = currentRunDirection(p);
      final time = p.route?.timeFor(dir);
      final run = dir == fromCollege ? 'Evening' : 'Morning';
      final done = p.tripCompleted;
      return _Shell(
        accent: done ? BrandColors.green : BrandColors.amber,
        child: Row(children: [
          IconTile(
            icon: done ? Icons.check_circle_rounded : Icons.schedule_rounded,
            color: done ? BrandColors.green : BrandColors.amber,
            size: 44,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(done ? 'Trip completed' : 'Bus not started',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: pal.text)),
              const SizedBox(height: 3),
              Text(
                done
                    ? 'See you on the next trip.'
                    : (time == null ? 'Live arrival appears when the driver starts the trip.' : '$run bus leaves at ${clock12(time)}'),
                style: TextStyle(fontSize: 13, color: pal.muted, height: 1.3),
              ),
            ]),
          ),
        ]),
      );
    }

    // ---------- Live ----------
    String title;
    String big;
    String sub;
    if (mine != null && mine.passed) {
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
      sub = 'Expected ${clockTime(target.expectedAt)}  ·  ${distanceText(target.remainingMeters)} away';
    }
    final isMinutes = int.tryParse(big) != null;

    final stops = p.eta?.stops ?? const <EtaStop>[];
    final passed = stops.where((s) => s.passed).length;
    final progress = stops.isEmpty ? 0.0 : passed / stops.length;

    return _Shell(
      accent: BrandColors.amber,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.1, color: pal.muted)),
              const SizedBox(height: 4),
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 380),
                switchInCurve: Curves.easeOutCubic,
                switchOutCurve: Curves.easeInCubic,
                transitionBuilder: (child, anim) => FadeTransition(
                  opacity: anim,
                  child: SlideTransition(
                    position: Tween<Offset>(begin: const Offset(0, 0.4), end: Offset.zero).animate(anim),
                    child: child,
                  ),
                ),
                layoutBuilder: (current, previous) => Stack(
                  alignment: Alignment.centerLeft,
                  children: [...previous, if (current != null) current],
                ),
                child: Row(
                  key: ValueKey<String>(big),
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text(big,
                        style: TextStyle(
                          fontSize: isMinutes ? 34 : 26,
                          fontWeight: FontWeight.w800,
                          height: 1.1,
                          letterSpacing: -0.5,
                          color: pal.text,
                        )),
                    if (isMinutes)
                      Padding(
                        padding: const EdgeInsets.only(left: 5),
                        child: Text('min', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: pal.muted)),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 4),
              Text(sub, maxLines: 2, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w500, color: pal.muted)),
            ]),
          ),
          const SizedBox(width: 12),
          const IconTile(icon: Icons.schedule_rounded, color: BrandColors.amber, size: 44, filled: true),
        ]),
        if (stops.isNotEmpty) ...[
          const SizedBox(height: 14),
          TweenAnimationBuilder<double>(
            tween: Tween<double>(begin: 0, end: progress),
            duration: const Duration(milliseconds: 700),
            curve: Curves.easeOutCubic,
            builder: (context, v, _) => ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(value: v, minHeight: 5, backgroundColor: pal.soft, color: BrandColors.amber),
            ),
          ),
          const SizedBox(height: 6),
          Text('$passed of ${stops.length} stops passed', style: TextStyle(fontSize: 11.5, color: pal.muted)),
        ],
      ]),
    );
  }
}

/// Card with a coloured accent bar on the left.
class _Shell extends StatelessWidget {
  const _Shell({required this.child, required this.accent});
  final Widget child;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final pal = Palette.of(context);
    final r = BorderRadius.circular(Ui.radius);
    return DecoratedBox(
      decoration: BoxDecoration(borderRadius: r, boxShadow: pal.shadow),
      child: ClipRRect(
        borderRadius: r,
        child: Container(
          decoration: BoxDecoration(color: pal.card, borderRadius: r, border: Border.all(color: pal.line)),
          child: Stack(children: [
            Positioned(left: 0, top: 0, bottom: 0, child: AnimatedContainer(duration: const Duration(milliseconds: 300), width: 4, color: accent)),
            Padding(padding: const EdgeInsets.fromLTRB(18, 16, 16, 16), child: child),
          ]),
        ),
      ),
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
    final pal = Palette.of(context);
    return BmCard(
      padding: const EdgeInsets.fromLTRB(12, 12, 10, 12),
      radius: 16,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        IconTile(icon: icon, size: 28, color: BrandColors.amber),
        const SizedBox(height: 10),
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 250),
          child: Text(value,
              key: ValueKey<String>(value),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: pal.text)),
        ),
        const SizedBox(height: 1),
        Text(label, maxLines: 1, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w500, color: pal.muted)),
      ]),
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
    final pal = Palette.of(context);
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
              : isNext || mine
                  ? BrandColors.amber
                  : passed
                      ? BrandColors.green.withValues(alpha: 0.55)
                      : pal.line;
          final big = isNext || mine || atStop;
          final right = !p.hasActiveTrip
              ? (s.scheduledTime == null || s.scheduledTime!.length < 5 ? '' : clock12(s.scheduledTime!.substring(0, 5)))
              : passed
                  ? 'Passed'
                  : (e?.expectedAt == null ? '' : '${clockTime(e!.expectedAt)} · ${etaText(e.etaSeconds)}');
          final lineAbove = i == 0 ? Colors.transparent : (passed || isNext || atStop ? BrandColors.green.withValues(alpha: 0.6) : pal.line);
          final lineBelow = i == stops.length - 1 ? Colors.transparent : (passed ? BrandColors.green.withValues(alpha: 0.6) : pal.line);
          return IntrinsicHeight(
            child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              SizedBox(
                width: 22,
                child: Column(children: [
                  Expanded(child: Container(width: 2, color: lineAbove)),
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 350),
                    curve: Curves.easeOut,
                    width: big ? 14 : 10,
                    height: big ? 14 : 10,
                    decoration: BoxDecoration(
                      color: dot,
                      shape: BoxShape.circle,
                      border: Border.all(color: pal.card, width: 2),
                      boxShadow: big ? [BoxShadow(color: dot.withValues(alpha: 0.45), blurRadius: 6)] : null,
                    ),
                  ),
                  Expanded(child: Container(width: 2, color: lineBelow)),
                ]),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 7),
                  child: Row(children: [
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(s.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 13.5,
                              fontWeight: big ? FontWeight.w700 : FontWeight.w500,
                              color: passed ? pal.muted : pal.text,
                            )),
                        if (big)
                          Text(atStop ? 'Bus is here now' : (mine ? (isNext ? 'Your stop · next' : 'Your stop') : 'Next stop'),
                              style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w600,
                                color: atStop ? BrandColors.green : (pal.dark ? BrandColors.amber : BrandColors.yellow),
                              )),
                      ]),
                    ),
                    const SizedBox(width: 8),
                    Text(right, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: passed ? pal.muted : pal.text)),
                  ]),
                ),
              ),
            ]),
          );
        }(),
    ]);
  }
}
