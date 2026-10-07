import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../models/models.dart';
import '../providers/bus_provider.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';

/// Route as a vertical timeline; the student's stop is highlighted. Tap a stop to make it "my stop".
class RouteScreen extends StatelessWidget {
  const RouteScreen({super.key});

  Future<void> _choose(BuildContext context, StopInfo s) async {
    final p = context.read<BusProvider>();
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Set as my stop?'),
        content: Text('You will get "approaching" and "reached" alerts for ${s.name}.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('CANCEL')),
          FilledButton(style: FilledButton.styleFrom(minimumSize: const Size(100, 44)), onPressed: () => Navigator.pop(c, true), child: const Text('SET')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await p.chooseStop(s.id);
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${s.name} is now your stop.')));
    } on ApiException catch (e) {
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<BusProvider>();
    final route = p.route;
    // Stops follow the running trip: the evening (From College) run lists them in reverse.
    final stops = p.travelStops;
    final back = p.direction == fromCollege;
    final hint = Theme.of(context).hintColor;

    return Scaffold(
      appBar: AppBar(title: Text(p.bus == null ? 'Route' : 'COLLEGE ${p.bus!.number}')),
      body: route == null
          ? const Center(child: Padding(padding: EdgeInsets.all(24), child: Text('No route assigned to this bus yet.')))
          : ListView(padding: const EdgeInsets.all(20), children: [
              Text(route.name, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
              if (route.start != null || route.destination != null)
                Text(back ? '${route.destination ?? ''} → ${route.start ?? ''}' : '${route.start ?? ''} → ${route.destination ?? ''}',
                    style: TextStyle(color: hint, fontSize: 16)),
              if (p.direction != null)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text('${p.hasActiveTrip ? 'Current trip' : 'Last trip'}: ${directionLabel(p.direction)}',
                      style: const TextStyle(color: BrandColors.amber, fontWeight: FontWeight.w800, fontSize: 15)),
                ),
              const SizedBox(height: 6),
              Text('Tap a stop to set it as your stop.', style: TextStyle(color: hint)),
              const SizedBox(height: 16),
              for (var i = 0; i < stops.length; i++)
                _StopTile(
                  stop: stops[i],
                  isFirst: i == 0,
                  isLast: i == stops.length - 1,
                  isMine: stops[i].id == p.myStopId,
                  eta: p.hasActiveTrip ? p.eta?.forStop(stops[i].id) : null,
                  atStop: p.location?.atStopId == stops[i].id,
                  onTap: () => _choose(context, stops[i]),
                ),
            ]),
    );
  }
}

class _StopTile extends StatelessWidget {
  const _StopTile({required this.stop, required this.isFirst, required this.isLast, required this.isMine, required this.onTap, this.eta, this.atStop = false});
  final StopInfo stop;
  final bool isFirst;
  final bool isLast;
  final bool isMine;
  final bool atStop;
  final EtaStop? eta;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final passed = eta?.passed == true;
    final dotColor = atStop ? BrandColors.green : (isMine ? BrandColors.amber : (passed ? Colors.grey : BrandColors.ink3));
    final lineColor = Theme.of(context).dividerColor;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: IntrinsicHeight(
        child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          SizedBox(
            width: 36,
            child: Column(children: [
              Expanded(child: Container(width: 3, color: isFirst ? Colors.transparent : lineColor)),
              Container(
                width: isMine ? 24 : 18,
                height: isMine ? 24 : 18,
                decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 3)),
              ),
              Expanded(child: Container(width: 3, color: isLast ? Colors.transparent : lineColor)),
            ]),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Container(
              margin: const EdgeInsets.symmetric(vertical: 6),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: isMine ? BrandColors.amber.withValues(alpha: 0.16) : null,
                borderRadius: BorderRadius.circular(14),
                border: isMine ? Border.all(color: BrandColors.amber) : null,
              ),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(stop.name,
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: isMine ? FontWeight.w900 : FontWeight.w600,
                          decoration: passed ? TextDecoration.lineThrough : null,
                        )),
                    if (isMine) const Text('Your stop', style: TextStyle(color: BrandColors.amber, fontWeight: FontWeight.w700)),
                    if (atStop) const Text('Bus is here now', style: TextStyle(color: BrandColors.green, fontWeight: FontWeight.w700)),
                  ]),
                ),
                if (eta != null && !passed)
                  Text('~${etaText(eta!.etaSeconds)}', style: const TextStyle(fontWeight: FontWeight.w800))
                else if (stop.scheduledTime != null)
                  Text(stop.scheduledTime!.substring(0, 5), style: TextStyle(color: Theme.of(context).hintColor)),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}
