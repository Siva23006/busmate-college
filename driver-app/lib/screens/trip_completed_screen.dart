import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/session_provider.dart';
import '../providers/trip_provider.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/common.dart';

class TripCompletedScreen extends StatelessWidget {
  const TripCompletedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final trips = context.watch<TripProvider>();
    final t = trips.lastCompleted;
    // Dismissed: this screen is fading out.
    if (t == null) return const Scaffold();
    final hint = context.hint;
    final name = trips.home?.name ?? context.watch<SessionProvider>().user?.name ?? 'Driver';
    final firstName = name.trim().split(' ').first;
    final route = trips.busById(t.busId)?.route;
    final from = route?.startFor(t.direction) ?? '-';
    final to = route?.destinationFor(t.direction) ?? '-';
    final duration = t.durationSeconds != null
        ? Duration(seconds: t.durationSeconds!)
        : (t.startTime != null && t.endTime != null ? t.endTime!.difference(t.startTime!) : Duration.zero);
    final reached = t.stopsReached;
    final totalStops = t.stopsTotal;

    return Scaffold(
      body: SafeArea(
        child: Column(children: [
          Expanded(
            child: ListView(padding: const EdgeInsets.fromLTRB(Ui.pad, 32, Ui.pad, Ui.pad), children: [
              const Center(child: _DoneCheck()),
              const SizedBox(height: 18),
              FadeSlideIn(
                delay: const Duration(milliseconds: 250),
                child: Column(children: [
                  const Text('Trip Completed!', textAlign: TextAlign.center, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  Text('Great job, ${firstName.isEmpty ? 'Driver' : firstName}', textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: hint)),
                ]),
              ),
              const SizedBox(height: 24),
              FadeSlideIn(
                delay: const Duration(milliseconds: 380),
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      Row(children: [
                        const IconTile(icon: Icons.directions_bus_rounded, color: BrandColors.amber, size: 40, solid: true),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(t.busNumber, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                            if (t.routeName != null) Text(t.routeName!, style: TextStyle(fontSize: 12, color: hint)),
                          ]),
                        ),
                        DirectionChip(t.direction),
                      ]),
                      const SizedBox(height: 14),
                      Row(children: [
                        const Icon(Icons.trip_origin_rounded, size: 14, color: BrandColors.green),
                        const SizedBox(width: 6),
                        Flexible(child: Text(from, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700))),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          child: Icon(Icons.arrow_forward_rounded, size: 16, color: context.amberText),
                        ),
                        Icon(Icons.flag_rounded, size: 14, color: context.amberText),
                        const SizedBox(width: 6),
                        Flexible(child: Text(to, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700))),
                      ]),
                      const SizedBox(height: 14),
                      Row(children: [
                        Expanded(child: StatTile(icon: Icons.play_circle_outline_rounded, label: 'Start Time', value: clockTime(t.startTime))),
                        const SizedBox(width: 10),
                        Expanded(child: StatTile(icon: Icons.stop_circle_outlined, label: 'End Time', value: clockTime(t.endTime))),
                      ]),
                      const SizedBox(height: 10),
                      Row(children: [
                        Expanded(child: StatTile(icon: Icons.timer_outlined, label: 'Duration', value: durationText(duration))),
                        const SizedBox(width: 10),
                        Expanded(child: StatTile(icon: Icons.straighten_rounded, label: 'Distance', value: distanceText(t.distanceMeters))),
                      ]),
                      const SizedBox(height: 14),
                      Row(children: [
                        Text('Stops Reached', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: hint)),
                        const Spacer(),
                        Text(
                          reached == null ? '-' : (totalStops != null ? '$reached/$totalStops' : '$reached'),
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: BrandColors.green),
                        ),
                      ]),
                      if (reached != null && totalStops != null && totalStops > 0) ...[
                        const SizedBox(height: 8),
                        AnimatedBar(value: reached / totalStops, height: 7),
                      ],
                    ]),
                  ),
                ),
              ),
              if (t.isSimulation) ...[const SizedBox(height: 14), const Center(child: DemoTag())],
            ]),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(Ui.pad, 0, Ui.pad, Ui.pad),
            child: FadeSlideIn(
              delay: const Duration(milliseconds: 500),
              child: FilledButton.icon(
                onPressed: trips.dismissCompleted,
                icon: const Icon(Icons.home_rounded, size: 20),
                label: const Text('Back to Home'),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}

/// Green circle that pops in, then the tick draws itself (one-shot).
class _DoneCheck extends StatelessWidget {
  const _DoneCheck();

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0, end: 1),
      duration: const Duration(milliseconds: 900),
      builder: (context, v, _) {
        final scale = Curves.easeOutBack.transform((v / 0.55).clamp(0.0, 1.0).toDouble());
        final tick = Curves.easeOutCubic.transform(((v - 0.4) / 0.6).clamp(0.0, 1.0).toDouble());
        return Transform.scale(
          scale: scale,
          child: Container(
            width: 104,
            height: 104,
            decoration: BoxDecoration(color: BrandColors.green.withValues(alpha: 0.14), shape: BoxShape.circle),
            alignment: Alignment.center,
            child: Container(
              width: 76,
              height: 76,
              decoration: BoxDecoration(
                color: BrandColors.green,
                shape: BoxShape.circle,
                boxShadow: [BoxShadow(color: BrandColors.green.withValues(alpha: 0.35), blurRadius: 18, offset: const Offset(0, 6))],
              ),
              child: CustomPaint(painter: _TickPainter(tick)),
            ),
          ),
        );
      },
    );
  }
}

class _TickPainter extends CustomPainter {
  _TickPainter(this.progress);
  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    if (progress <= 0) return;
    final w = size.width, h = size.height;
    final a = Offset(w * 0.28, h * 0.52), b = Offset(w * 0.44, h * 0.67), c = Offset(w * 0.73, h * 0.36);
    final first = (b - a).distance, second = (c - b).distance;
    final drawn = (first + second) * progress;
    final path = Path()..moveTo(a.dx, a.dy);
    if (drawn <= first) {
      final p = Offset.lerp(a, b, drawn / first)!;
      path.lineTo(p.dx, p.dy);
    } else {
      path.lineTo(b.dx, b.dy);
      final p = Offset.lerp(b, c, (drawn - first) / second)!;
      path.lineTo(p.dx, p.dy);
    }
    canvas.drawPath(
      path,
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = 6
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(_TickPainter old) => old.progress != progress;
}
