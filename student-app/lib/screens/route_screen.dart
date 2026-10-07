import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../models/models.dart';
import '../providers/bus_provider.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/app_bar.dart';
import '../widgets/common.dart';

/// Route as a vertical timeline; the student's stop is highlighted. Tap a stop to make it "my stop".
class RouteScreen extends StatelessWidget {
  const RouteScreen({super.key});

  Future<void> _choose(BuildContext context, StopInfo s) async {
    final p = context.read<BusProvider>();
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        icon: const IconTile(icon: Icons.person_pin_circle_rounded, size: 44),
        title: const Text('Set as my stop?'),
        content: Text('You will get "approaching" and "reached" alerts for ${s.name}.', textAlign: TextAlign.center),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(96, 42)),
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Set stop'),
          ),
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
    final pal = Palette.of(context);
    final route = p.route;
    // Stops follow the running trip: the evening (From College) run lists them in reverse.
    final stops = p.travelStops;

    return Scaffold(
      appBar: bmAppBar(context, route?.name ?? 'Route', subtitle: p.bus == null ? 'No bus selected' : 'Bus ${p.bus!.number}'),
      body: route == null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const IconTile(icon: Icons.route_rounded, size: 52),
                  const SizedBox(height: 14),
                  Text('No route yet', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: pal.text)),
                  const SizedBox(height: 4),
                  Text('No route is assigned to this bus yet.', textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: pal.muted)),
                ]),
              ),
            )
          : RefreshIndicator(
              onRefresh: p.load,
              child: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 28), children: [
                // Daily timings set by the transport office
                const SectionLabel('Daily timings'),
                FadeSlideIn(
                  child: Row(children: [
                    Expanded(child: _RunCard(morning: true, route: route, live: p.hasActiveTrip && p.direction != fromCollege)),
                    const SizedBox(width: 10),
                    Expanded(child: _RunCard(morning: false, route: route, live: p.hasActiveTrip && p.direction == fromCollege)),
                  ]),
                ),
                const SizedBox(height: 20),
                SectionLabel(
                  p.hasActiveTrip ? 'Stops on this trip' : 'Stops',
                  trailing: Text('${stops.length} stops · tap to set yours', style: TextStyle(fontSize: 11.5, color: pal.muted)),
                ),
                FadeSlideIn(
                  index: 1,
                  child: BmCard(
                    padding: const EdgeInsets.fromLTRB(8, 6, 8, 6),
                    child: Column(children: [
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
                  ),
                ),
              ]),
            ),
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
    final pal = Palette.of(context);
    final passed = eta?.passed == true;
    final dotColor = atStop
        ? BrandColors.green
        : isMine
            ? BrandColors.amber
            : (passed ? BrandColors.green.withValues(alpha: 0.55) : pal.line);
    final lineColor = pal.line;
    final big = isMine || atStop;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(Ui.radiusSmall),
      child: IntrinsicHeight(
        child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          SizedBox(
            width: 30,
            child: Column(children: [
              Expanded(child: Container(width: 2, color: isFirst ? Colors.transparent : lineColor)),
              AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                width: big ? 16 : 11,
                height: big ? 16 : 11,
                decoration: BoxDecoration(
                  color: dotColor,
                  shape: BoxShape.circle,
                  border: Border.all(color: pal.card, width: 2),
                  boxShadow: big ? [BoxShadow(color: dotColor.withValues(alpha: 0.45), blurRadius: 6)] : null,
                ),
              ),
              Expanded(child: Container(width: 2, color: isLast ? Colors.transparent : lineColor)),
            ]),
          ),
          const SizedBox(width: 4),
          Expanded(
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              margin: const EdgeInsets.symmetric(vertical: 3),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: isMine ? BrandColors.amber.withValues(alpha: pal.dark ? 0.14 : 0.10) : Colors.transparent,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: isMine ? BrandColors.amber.withValues(alpha: 0.6) : Colors.transparent),
              ),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${stop.order}. ${stop.name}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: isMine ? FontWeight.w700 : FontWeight.w500,
                          color: passed ? pal.muted : pal.text,
                          decoration: passed ? TextDecoration.lineThrough : null,
                          decorationColor: pal.muted,
                        )),
                    if (isMine || atStop)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          atStop ? (isMine ? 'Your stop · bus is here now' : 'Bus is here now') : 'Your stop',
                          style: TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w600,
                            color: atStop ? BrandColors.green : (pal.dark ? BrandColors.amber : BrandColors.yellow),
                          ),
                        ),
                      ),
                  ]),
                ),
                const SizedBox(width: 8),
                if (eta != null && !passed)
                  Text('~${etaText(eta!.etaSeconds)}', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: pal.text))
                else if (stop.scheduledTime != null && stop.scheduledTime!.length >= 5)
                  Text(clock12(stop.scheduledTime!.substring(0, 5)), style: TextStyle(fontSize: 12, color: pal.muted)),
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
    final pal = Palette.of(context);
    final dir = morning ? toCollege : fromCollege;
    final tint = morning ? BrandColors.amber : BrandColors.indigo;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: pal.card,
        borderRadius: BorderRadius.circular(Ui.radius),
        border: Border.all(color: live ? BrandColors.green : pal.line, width: live ? 1.5 : 1),
        boxShadow: pal.shadow,
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          IconTile(icon: morning ? Icons.wb_sunny_rounded : Icons.nights_stay_rounded, color: tint, size: 30),
          const Spacer(),
          if (live) const PhaseChip(label: 'LIVE', level: Level.good, pulse: true),
        ]),
        const SizedBox(height: 10),
        Text(morning ? 'MORNING' : 'EVENING',
            style: TextStyle(color: pal.muted, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.1)),
        const SizedBox(height: 2),
        Text(route.timeFor(dir) == null ? '--:--' : clock12(route.timeFor(dir)),
            style: TextStyle(color: pal.text, fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 4),
        Text('${route.fromFor(dir)} → ${route.toFor(dir)}',
            maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: pal.muted, fontSize: 12, fontWeight: FontWeight.w500, height: 1.3)),
      ]),
    );
  }
}
