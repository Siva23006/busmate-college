import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

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
    final hint = Theme.of(context).hintColor;
    final duration = t.durationSeconds != null
        ? Duration(seconds: t.durationSeconds!)
        : (t.startTime != null && t.endTime != null ? t.endTime!.difference(t.startTime!) : Duration.zero);
    final stops = t.stopsReached == null ? '-' : (t.stopsTotal != null ? '${t.stopsReached} of ${t.stopsTotal}' : '${t.stopsReached}');

    return Scaffold(
      body: SafeArea(
        child: Column(children: [
          Expanded(
            child: ListView(padding: const EdgeInsets.fromLTRB(Ui.pad, 28, Ui.pad, Ui.pad), children: [
              // The tick grows in once: a clear "done" moment.
              Center(
                child: TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0.6, end: 1),
                  duration: const Duration(milliseconds: 500),
                  curve: Curves.easeOutBack,
                  builder: (context, scale, child) => Transform.scale(scale: scale, child: child),
                  child: Container(
                    width: 104,
                    height: 104,
                    decoration: BoxDecoration(color: BrandColors.green.withValues(alpha: 0.16), shape: BoxShape.circle),
                    child: const Icon(Icons.check_circle_rounded, color: BrandColors.green, size: 84),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              const Text('Trip completed', textAlign: TextAlign.center, style: TextStyle(fontSize: 32, fontWeight: FontWeight.w900)),
              const SizedBox(height: 6),
              Text('${t.busNumber}${t.routeName == null ? '' : ' · ${t.routeName}'}',
                  textAlign: TextAlign.center, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: hint)),
              const SizedBox(height: 14),
              Center(child: DirectionChip(t.direction)),
              const SizedBox(height: 24),
              const SectionLabel('Trip summary'),
              Card(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
                  child: Column(children: [
                    SummaryRow(icon: Icons.play_circle_outline_rounded, label: 'Start', value: clockTime(t.startTime)),
                    const Divider(),
                    SummaryRow(icon: Icons.stop_circle_outlined, label: 'End', value: clockTime(t.endTime)),
                    const Divider(),
                    SummaryRow(icon: Icons.timer_outlined, label: 'Duration', value: durationText(duration)),
                    const Divider(),
                    SummaryRow(icon: Icons.straighten_rounded, label: 'Distance', value: distanceText(t.distanceMeters)),
                    const Divider(),
                    SummaryRow(icon: Icons.pin_drop_rounded, label: 'Stops reached', value: stops, highlight: true),
                  ]),
                ),
              ),
              if (t.isSimulation) ...[const SizedBox(height: 14), const Center(child: DemoTag())],
            ]),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(Ui.pad, 0, Ui.pad, Ui.pad),
            child: FilledButton.icon(
              onPressed: trips.dismissCompleted,
              icon: const Icon(Icons.home_rounded, size: 30),
              label: const Text('BACK TO HOME'),
            ),
          ),
        ]),
      ),
    );
  }
}
