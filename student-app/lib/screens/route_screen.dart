import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../models/models.dart';
import '../providers/bus_provider.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/app_bar.dart';

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
    final hint = Theme.of(context).hintColor;

    return Scaffold(
      appBar: bmAppBar(context, route?.name ?? 'Route', subtitle: p.bus == null ? null : 'Bus ${p.bus!.number}'),
      body: route == null
          ? const Center(child: Padding(padding: EdgeInsets.all(24), child: Text('No route assigned to this bus yet.')))
          : ListView(padding: const EdgeInsets.fromLTRB(20, 8, 20, 28), children: [
              // Daily timings set by the transport office
              Row(children: [
                Expanded(child: _RunCard(morning: true, route: route, live: p.hasActiveTrip && p.direction != fromCollege)),
                const SizedBox(width: 10),
                Expanded(child: _RunCard(morning: false, route: route, live: p.hasActiveTrip && p.direction == fromCollege)),
              ]),
              const SizedBox(height: 18),
              Row(children: [
                Text(p.hasActiveTrip ? 'STOPS ON THIS TRIP' : 'STOPS', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, letterSpacing: 1.4)),
                const Spacer(),
                Text('Tap a stop to make it yours', style: TextStyle(fontSize: 12, color: hint)),
              ]),
              const SizedBox(height: 8),
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


/// Morning or evening run: from -> to and the departure time set by the admin.
class _RunCard extends StatelessWidget {
  const _RunCard({required this.morning, required this.route, this.live = false});
  final bool morning;
  final RouteInfo route;
  final bool live;

  @override
  Widget build(BuildContext context) {
    final dir = morning ? toCollege : fromCollege;
    final fg = morning ? BrandColors.ink : Colors.white;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: morning ? BrandColors.amber : BrandColors.ink3,
        borderRadius: BorderRadius.circular(20),
        border: live ? Border.all(color: BrandColors.green, width: 3) : null,
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(morning ? Icons.wb_sunny_rounded : Icons.nights_stay_rounded, color: fg, size: 18),
          const SizedBox(width: 6),
          Text(morning ? 'MORNING' : 'EVENING', style: TextStyle(color: fg, fontSize: 12, fontWeight: FontWeight.w900, letterSpacing: 1.2)),
          const Spacer(),
          if (live)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(color: BrandColors.green, borderRadius: BorderRadius.circular(8)),
              child: const Text('LIVE', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w900)),
            ),
        ]),
        const SizedBox(height: 8),
        Text(route.timeFor(dir) == null ? '--:--' : clock12(route.timeFor(dir)),
            style: TextStyle(color: fg, fontSize: 24, fontWeight: FontWeight.w900)),
        const SizedBox(height: 4),
        Text('${route.fromFor(dir)} → ${route.toFor(dir)}',
            maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: fg, fontSize: 13, fontWeight: FontWeight.w700)),
      ]),
    );
  }
}
