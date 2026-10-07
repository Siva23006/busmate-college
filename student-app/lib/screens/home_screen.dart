import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../providers/bus_provider.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../utils/status.dart';
import '../widgets/bus_map.dart';
import '../widgets/common.dart';
import '../widgets/journey.dart';
import 'live_map_screen.dart';
import 'notifications_screen.dart';
import 'route_screen.dart';
import 'select_bus_screen.dart';
import 'settings_screen.dart';

/// Map-first home: the live Google map fills the screen; a sheet slides over it with the
/// answer the student needs in two seconds (status + ETA to my stop), then the journey.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  static const double _sheetMin = 0.36;

  @override
  Widget build(BuildContext context) {
    final p = context.watch<BusProvider>();
    final h = MediaQuery.of(context).size.height;
    final top = MediaQuery.of(context).padding.top;

    return Scaffold(
      body: Stack(children: [
        // ---------- Live map ----------
        Positioned.fill(
          child: p.bus == null
              ? Container(color: Theme.of(context).scaffoldBackgroundColor)
              : BusMapView(bottomPadding: h * _sheetMin, topPadding: top + 64, controlsBottom: h * _sheetMin + 16),
        ),

        // ---------- Floating top bar ----------
        Positioned(
          left: 12,
          right: 12,
          top: top + 8,
          child: _TopBar(p: p),
        ),

        // ---------- Sheet ----------
        DraggableScrollableSheet(
          initialChildSize: p.bus == null ? 0.7 : 0.46,
          minChildSize: _sheetMin,
          maxChildSize: 0.92,
          snap: true,
          snapSizes: const [0.46],
          builder: (context, controller) => Container(
            decoration: BoxDecoration(
              color: Theme.of(context).scaffoldBackgroundColor,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
              boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 20, offset: Offset(0, -4))],
            ),
            child: RefreshIndicator(
              onRefresh: p.load,
              child: ListView(
                controller: controller,
                padding: const EdgeInsets.fromLTRB(18, 10, 18, 28),
                children: [
                  Center(
                    child: Container(
                      width: 44,
                      height: 5,
                      decoration: BoxDecoration(color: Theme.of(context).dividerColor, borderRadius: BorderRadius.circular(4)),
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (p.error != null) ...[ErrorBanner(p.error!, onRetry: p.load), const SizedBox(height: 12)],
                  if (p.loading && p.bus == null) const Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator())),
                  if (!p.loading && p.bus == null && p.error == null) const _NoBus(),
                  if (p.bus != null) ..._content(context, p),
                ],
              ),
            ),
          ),
        ),
      ]),
    );
  }

  List<Widget> _content(BuildContext context, BusProvider p) {
    final bus = p.bus!;
    final (phase, phaseLevel) = phaseLabel(p);
    final (live, liveLevel) = liveLabel(p.liveState);
    final next = p.eta?.nextStop;
    final speed = p.location?.speedKmh;
    final hint = Theme.of(context).hintColor;
    void open(Widget page) => Navigator.push(context, MaterialPageRoute<void>(builder: (_) => page));

    return [
      // Bus + status
      Row(children: [
        Container(
          width: 50,
          height: 50,
          decoration: BoxDecoration(color: BrandColors.ink, borderRadius: BorderRadius.circular(16)),
          child: const Icon(Icons.directions_bus_rounded, color: BrandColors.amber, size: 28),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Flexible(
                child: Text(bus.number,
                    maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
              ),
              const SizedBox(width: 8),
              if (p.isSimulation || bus.isDemo) const DemoTag(),
            ]),
            Text(p.route?.name ?? 'No route', style: TextStyle(color: hint, fontWeight: FontWeight.w600)),
          ]),
        ),
        PhaseChip(label: live, level: liveLevel),
      ]),
      const SizedBox(height: 12),
      Wrap(spacing: 8, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
        PhaseChip(label: phase, level: phaseLevel, large: true),
        if (p.direction != null) _DirectionTag(p.direction!),
      ]),
      const SizedBox(height: 12),
      RouteHeader(p: p),
      const SizedBox(height: 14),

      // The answer
      BigEtaCard(p: p),
      const SizedBox(height: 12),

      // Quick stats
      Row(children: [
        Expanded(child: StatTile(icon: Icons.near_me_rounded, label: 'Next stop', value: next == null ? '-' : next.name)),
        const SizedBox(width: 8),
        Expanded(child: StatTile(icon: Icons.speed_rounded, label: 'Speed', value: !p.hasActiveTrip || speed == null ? '-' : '${speed.round()} km/h')),
        const SizedBox(width: 8),
        Expanded(child: StatTile(icon: Icons.update_rounded, label: 'Updated', value: p.hasActiveTrip ? agoText(p.location?.timestamp) : '-')),
      ]),
      if (p.phase == BusPhase.gpsWeak) ...[
        const SizedBox(height: 10),
        const Text('GPS signal is weak. Showing the last reliable position.', style: TextStyle(color: BrandColors.yellow, fontWeight: FontWeight.w600)),
      ],
      const SizedBox(height: 18),

      // My stop
      Card(
        child: ListTile(
          leading: const Icon(Icons.person_pin_circle_rounded, color: BrandColors.amber, size: 30),
          title: const Text('My stop', style: TextStyle(fontWeight: FontWeight.w700)),
          subtitle: Text(p.myStopName ?? 'Tap to choose your stop'),
          trailing: const Icon(Icons.chevron_right_rounded),
          onTap: () => open(const RouteScreen()),
        ),
      ),
      const SizedBox(height: 18),

      // Journey
      Row(children: [
        const Text('JOURNEY', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900, letterSpacing: 1.4)),
        const Spacer(),
        Text('Estimated, not guaranteed', style: TextStyle(fontSize: 12, color: hint)),
      ]),
      const SizedBox(height: 6),
      JourneyTimeline(p: p),
      const SizedBox(height: 18),

      // Actions
      Row(children: [
        Expanded(
          child: OutlinedButton.icon(
            onPressed: () => open(const LiveMapScreen()),
            icon: const Icon(Icons.fullscreen_rounded),
            label: const Text('Full map'),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: OutlinedButton.icon(
            onPressed: () => open(const SelectBusScreen()),
            icon: const Icon(Icons.swap_horiz_rounded),
            label: const Text('Change bus'),
          ),
        ),
      ]),
    ];
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.p});
  final BusProvider p;

  @override
  Widget build(BuildContext context) {
    final name = p.studentName.isEmpty ? 'Student' : p.studentName.split(' ').first;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 8, 6, 8),
      decoration: BoxDecoration(
        color: BrandColors.ink.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(20),
        boxShadow: const [BoxShadow(color: Colors.black38, blurRadius: 14, offset: Offset(0, 4))],
      ),
      child: Row(children: [
        Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(color: BrandColors.amber, borderRadius: BorderRadius.circular(11)),
          child: const Icon(Icons.directions_bus_rounded, color: BrandColors.ink, size: 20),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Text('${greeting()}, $name', maxLines: 1, overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w800)),
            const Text('BUSMATE · Smart College Transport', style: TextStyle(color: BrandColors.amber, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.6)),
          ]),
        ),
        IconButton(
          tooltip: 'Notifications',
          onPressed: () => Navigator.push(context, MaterialPageRoute<void>(builder: (_) => const NotificationsScreen())),
          icon: Badge(
            isLabelVisible: p.unread > 0,
            label: Text('${p.unread}'),
            child: const Icon(Icons.notifications_rounded, color: Colors.white),
          ),
        ),
        IconButton(
          tooltip: 'Settings',
          onPressed: () => Navigator.push(context, MaterialPageRoute<void>(builder: (_) => const SettingsScreen())),
          icon: const Icon(Icons.settings_rounded, color: Colors.white),
        ),
      ]),
    );
  }
}

class _DirectionTag extends StatelessWidget {
  const _DirectionTag(this.direction);
  final String direction;

  @override
  Widget build(BuildContext context) {
    final evening = direction == fromCollege;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(color: evening ? BrandColors.ink3 : BrandColors.amber, borderRadius: BorderRadius.circular(20)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(evening ? Icons.nights_stay_rounded : Icons.wb_sunny_rounded, size: 16, color: evening ? Colors.white : BrandColors.ink),
        const SizedBox(width: 6),
        Text('${evening ? 'Evening' : 'Morning'} · ${directionLabel(direction)}',
            style: TextStyle(color: evening ? Colors.white : BrandColors.ink, fontWeight: FontWeight.w800, fontSize: 13)),
      ]),
    );
  }
}

class _NoBus extends StatelessWidget {
  const _NoBus();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(children: [
          const Icon(Icons.directions_bus_outlined, size: 48),
          const SizedBox(height: 12),
          const Text('No bus selected', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          const Text('Choose the bus you travel on.', textAlign: TextAlign.center),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () => Navigator.push(context, MaterialPageRoute<void>(builder: (_) => const SelectBusScreen())),
            child: const Text('SELECT BUS'),
          ),
        ]),
      ),
    );
  }
}
