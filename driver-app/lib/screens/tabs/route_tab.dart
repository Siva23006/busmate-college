import 'package:flutter/material.dart';

import '../../models/models.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';
import '../../widgets/route_timeline.dart';
import '../../widgets/trip_map.dart';

/// Pre-trip route view: map preview, stop timeline and totals for the chosen run.
class RouteTab extends StatelessWidget {
  const RouteTab({super.key, required this.bus, required this.direction, required this.onDirection});
  final BusInfo? bus;
  final String direction;
  final ValueChanged<String> onDirection;

  @override
  Widget build(BuildContext context) {
    final b = bus;
    final route = b?.route;
    final hint = context.hint;
    return ListView(padding: const EdgeInsets.fromLTRB(Ui.pad, 14, Ui.pad, 28), children: [
      const Text('Route Stops', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
      const SizedBox(height: 2),
      Text(
        b == null ? 'No bus assigned' : '${b.number}${route == null ? '' : ' · ${route.name}'}',
        style: TextStyle(fontSize: 13, color: hint),
      ),
      if (b == null || route == null)
        Padding(
          padding: const EdgeInsets.only(top: 40),
          child: Column(children: [
            Icon(Icons.route_outlined, size: 40, color: hint),
            const SizedBox(height: 10),
            Text(b == null ? 'No bus is assigned to you yet.' : 'This bus has no route yet.',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text('Please contact the transport office.', style: TextStyle(fontSize: 12, color: hint)),
          ]),
        )
      else ...[
        const SizedBox(height: 10),
        Row(children: [
          Text('${route.stops.length} stops', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
          const SizedBox(width: 8),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 250),
            child: DirectionChip(direction, key: ValueKey(direction)),
          ),
        ]),
        const SizedBox(height: 14),
        SizedBox(
          width: double.infinity,
          child: SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: toCollege, icon: Icon(Icons.wb_sunny_rounded, size: 16), label: Text('Morning')),
              ButtonSegment(value: fromCollege, icon: Icon(Icons.nights_stay_rounded, size: 16), label: Text('Evening')),
            ],
            selected: {direction},
            showSelectedIcon: false,
            onSelectionChanged: (s) => onDirection(s.first),
            style: ButtonStyle(
              minimumSize: const WidgetStatePropertyAll(Size(0, Ui.touch)),
              textStyle: const WidgetStatePropertyAll(TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
              backgroundColor: WidgetStateProperty.resolveWith(
                  (states) => states.contains(WidgetState.selected) ? BrandColors.amber.withValues(alpha: 0.25) : null),
            ),
          ),
        ),
        const SizedBox(height: 14),
        FadeSlideIn(
          child: TripMap(
            key: ValueKey('route-${b.id}-$direction'),
            route: route,
            direction: direction,
            height: 180,
            radius: Ui.radius,
            preview: true,
          ),
        ),
        const SizedBox(height: 18),
        SectionLabel('${route.startFor(direction) ?? 'Start'} → ${route.destinationFor(direction) ?? 'College'}'),
        Card(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(8, 8, 10, 8),
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 250),
              child: RouteTimeline(key: ValueKey(direction), route: route, direction: direction),
            ),
          ),
        ),
        const SizedBox(height: 12),
        RouteTotalsCard(route: route, direction: direction),
        const SizedBox(height: 8),
        Text('Distances are approximate (straight line between stops).',
            textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: hint)),
      ],
    ]);
  }
}
