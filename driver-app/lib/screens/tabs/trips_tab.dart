import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../providers/trip_provider.dart';
import '../../theme/app_theme.dart';
import '../../utils/format.dart';
import '../../widgets/common.dart';

/// The driver's recent trips (newest first).
class TripsTab extends StatefulWidget {
  const TripsTab({super.key});
  @override
  State<TripsTab> createState() => _TripsTabState();
}

class _TripsTabState extends State<TripsTab> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final trips = context.read<TripProvider>();
      if (trips.history == null) trips.loadHistory();
    });
  }

  @override
  Widget build(BuildContext context) {
    final trips = context.watch<TripProvider>();
    final history = trips.history;
    final hint = context.hint;
    final completed = history?.where((t) => t.status == 'COMPLETED').toList() ?? const <Trip>[];
    final totalMeters = completed.fold<double>(0, (sum, t) => sum + (t.distanceMeters ?? 0));

    return RefreshIndicator(
      color: BrandColors.amber,
      onRefresh: trips.loadHistory,
      child: ListView(padding: const EdgeInsets.fromLTRB(Ui.pad, 14, Ui.pad, 28), children: [
        const Text('Trips', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 2),
        Text('Your recent trips', style: TextStyle(fontSize: 13, color: hint)),
        const SizedBox(height: 16),
        if (trips.historyError != null) ...[
          ErrorBanner(trips.historyError!, onRetry: trips.loadHistory),
          const SizedBox(height: Ui.gap),
        ],
        if (history == null && trips.historyLoading)
          const Padding(padding: EdgeInsets.all(48), child: Center(child: CircularProgressIndicator())),
        if (history != null && history.isEmpty)
          FadeSlideIn(
            child: Padding(
              padding: const EdgeInsets.only(top: 48),
              child: Column(children: [
                const IconTile(icon: Icons.history_rounded, color: BrandColors.amber, size: 56),
                const SizedBox(height: 14),
                const Text('No trips yet', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text('Your completed trips will appear here.', style: TextStyle(fontSize: 13, color: hint)),
              ]),
            ),
          ),
        if (history != null && history.isNotEmpty) ...[
          FadeSlideIn(
            child: Row(children: [
              Expanded(child: StatTile(icon: Icons.check_circle_rounded, label: 'Completed', value: '${completed.length}', color: BrandColors.green)),
              const SizedBox(width: 10),
              Expanded(child: StatTile(icon: Icons.straighten_rounded, label: 'Distance', value: distanceText(totalMeters))),
            ]),
          ),
          const SizedBox(height: 18),
          const SectionLabel('Recent'),
          for (var i = 0; i < history.length; i++)
            FadeSlideIn(
              delay: FadeSlideIn.stagger(i + 1, stepMs: 50),
              child: Padding(padding: const EdgeInsets.only(bottom: 10), child: _TripCard(trip: history[i])),
            ),
        ],
      ]),
    );
  }
}

class _TripCard extends StatelessWidget {
  const _TripCard({required this.trip});
  final Trip trip;

  @override
  Widget build(BuildContext context) {
    final t = trip;
    final hint = context.hint;
    final evening = t.direction == fromCollege;
    final duration = t.durationSeconds != null ? Duration(seconds: t.durationSeconds!) : null;
    final (statusText, statusColor) = switch (t.status) {
      'COMPLETED' => ('Completed', BrandColors.green),
      'ACTIVE' => ('Live', BrandColors.amber),
      _ => (t.status.isEmpty ? '-' : '${t.status[0]}${t.status.substring(1).toLowerCase()}', BrandColors.red),
    };
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            IconTile(icon: evening ? Icons.nights_stay_rounded : Icons.wb_sunny_rounded, color: evening ? eveningColor : BrandColors.yellow, size: 38),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${directionTrip(t.direction)} · ${dayText(t.startTime)}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text('${t.busNumber}${t.routeName == null ? '' : ' · ${t.routeName}'}',
                    maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: hint)),
              ]),
            ),
            if (t.isSimulation) ...[const DemoTag(), const SizedBox(width: 6)],
            Pill(label: statusText, color: statusColor),
          ]),
          const SizedBox(height: 12),
          Row(children: [
            _Fact(icon: Icons.schedule_rounded, text: '${clockTime(t.startTime)} – ${clockTime(t.endTime)}'),
            const SizedBox(width: 14),
            if (duration != null) _Fact(icon: Icons.timer_outlined, text: shortDuration(duration)),
            const Spacer(),
            Text(distanceText(t.distanceMeters), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
          ]),
          if (t.stopsTotal != null && t.stopsTotal! > 0) ...[
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: AnimatedBar(value: (t.stopsReached ?? 0) / t.stopsTotal!, height: 6)),
              const SizedBox(width: 10),
              Text('${t.stopsReached ?? 0}/${t.stopsTotal} stops', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: hint)),
            ]),
          ],
        ]),
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 14, color: context.hint),
      const SizedBox(width: 4),
      Text(text, style: TextStyle(fontSize: 12, color: context.hint)),
    ]);
  }
}
