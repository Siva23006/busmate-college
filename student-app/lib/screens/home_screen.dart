import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/bus_provider.dart';
import '../theme/app_theme.dart';
import '../theme/theme_controller.dart';
import '../utils/format.dart';
import '../utils/status.dart';
import '../widgets/bus_map.dart';
import '../widgets/common.dart';
import '../widgets/journey.dart';
import 'live_map_screen.dart';
import 'main_shell.dart';
import 'select_bus_screen.dart';

/// Map-first home: the live Google map fills the top; a sheet slides over it with the
/// answer the student needs in two seconds (status + ETA to my stop), then the journey.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  static const double _sheetMin = 0.30;
  static const double _sheetMid = 0.45;
  static const double _sheetMax = 0.94;

  @override
  Widget build(BuildContext context) {
    final p = context.watch<BusProvider>();
    final pal = Palette.of(context);
    final top = MediaQuery.paddingOf(context).top;

    return Scaffold(
      body: LayoutBuilder(builder: (context, c) {
        final h = c.maxHeight;
        return Stack(children: [
          // ---------- Live map (top ~55%) ----------
          Positioned.fill(
            child: p.bus == null
                ? ColoredBox(color: pal.bg, child: const RouteLines())
                : BusMapView(bottomPadding: h * _sheetMin, topPadding: top + 64, controlsBottom: h * _sheetMid + 12),
          ),

          // ---------- Floating top bar ----------
          Positioned(left: 12, right: 12, top: top + 8, child: _TopBar(p: p)),

          // ---------- Sheet ----------
          DraggableScrollableSheet(
            initialChildSize: p.bus == null ? 0.62 : _sheetMid,
            minChildSize: _sheetMin,
            maxChildSize: _sheetMax,
            snap: true,
            snapSizes: const [_sheetMid],
            snapAnimationDuration: const Duration(milliseconds: 280),
            builder: (context, controller) => Container(
              decoration: BoxDecoration(
                color: pal.bg,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(26)),
                border: Border(top: BorderSide(color: pal.line)),
                boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: pal.dark ? 0.5 : 0.10), blurRadius: 24, offset: const Offset(0, -6))],
              ),
              child: RefreshIndicator(
                onRefresh: p.load,
                child: ListView(
                  controller: controller,
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  children: [
                    Center(
                      child: Container(
                        width: 36,
                        height: 4,
                        decoration: BoxDecoration(color: pal.muted.withValues(alpha: 0.35), borderRadius: BorderRadius.circular(4)),
                      ),
                    ),
                    const SizedBox(height: 14),
                    if (p.error != null) ...[ErrorBanner(p.error!, onRetry: p.load), const SizedBox(height: 12)],
                    if (p.loading && p.bus == null)
                      const Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator(strokeWidth: 2.5))),
                    if (!p.loading && p.bus == null && p.error == null) const FadeSlideIn(child: _NoBus()),
                    if (p.bus != null) ..._content(context, p),
                  ],
                ),
              ),
            ),
          ),
        ]);
      }),
    );
  }

  List<Widget> _content(BuildContext context, BusProvider p) {
    final pal = Palette.of(context);
    final bus = p.bus!;
    final (phase, phaseLevel) = phaseLabel(p);
    final (live, liveLevel) = liveLabel(p.liveState);
    final next = p.eta?.nextStop;
    final speed = p.location?.speedKmh;
    void open(Widget page) => Navigator.push(context, MaterialPageRoute<void>(builder: (_) => page));

    return [
      // Bus + route + live
      FadeSlideIn(
        key: const ValueKey('bus'),
        child: Row(children: [
          IconTile(icon: Icons.directions_bus_rounded, color: pal.dark ? BrandColors.amber : BrandColors.ink, size: 42, filled: true),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Flexible(
                  child: Text(bus.number,
                      maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: pal.text)),
                ),
                if (p.isSimulation || bus.isDemo) ...[const SizedBox(width: 8), const DemoTag()],
              ]),
              const SizedBox(height: 1),
              Text(p.route?.name ?? 'No route',
                  maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, color: pal.muted, fontWeight: FontWeight.w500)),
            ]),
          ),
          const SizedBox(width: 8),
          PhaseChip(label: live, level: liveLevel, pulse: liveLevel == Level.good && p.hasActiveTrip),
        ]),
      ),
      const SizedBox(height: 12),

      // Morning · Redhills → Dr. MGR University  [ON ROUTE]
      FadeSlideIn(
        key: const ValueKey('dir'),
        index: 1,
        child: Row(children: [
          Expanded(child: RouteHeader(p: p)),
          if (p.hasActiveTrip || p.tripCompleted) ...[const SizedBox(width: 8), PhaseChip(label: phase, level: phaseLevel)],
        ]),
      ),
      const SizedBox(height: 12),

      // The answer
      FadeSlideIn(key: const ValueKey('eta'), index: 2, child: BigEtaCard(p: p)),

      // Quick stats (only while the bus is moving)
      if (p.hasActiveTrip) ...[
        const SizedBox(height: 10),
        FadeSlideIn(
          key: const ValueKey('stats'),
          index: 3,
          child: Row(children: [
            Expanded(child: StatTile(icon: Icons.near_me_rounded, label: 'Next stop', value: next == null ? '-' : next.name)),
            const SizedBox(width: 8),
            Expanded(child: StatTile(icon: Icons.speed_rounded, label: 'Speed', value: speed == null ? '-' : '${speed.round()} km/h')),
            const SizedBox(width: 8),
            Expanded(child: StatTile(icon: Icons.update_rounded, label: 'Updated', value: agoText(p.location?.timestamp))),
          ]),
        ),
      ],
      if (p.phase == BusPhase.gpsWeak) ...[
        const SizedBox(height: 10),
        Row(children: [
          const Icon(Icons.gps_not_fixed_rounded, size: 16, color: BrandColors.yellow),
          const SizedBox(width: 6),
          Expanded(
            child: Text('GPS signal is weak. Showing the last reliable position.',
                style: TextStyle(fontSize: 12.5, color: pal.dark ? BrandColors.amber : BrandColors.yellow, fontWeight: FontWeight.w600)),
          ),
        ]),
      ],
      const SizedBox(height: 10),

      // My stop
      FadeSlideIn(
        key: const ValueKey('mystop'),
        index: 4,
        child: BmCard(
          padding: const EdgeInsets.fromLTRB(12, 12, 8, 12),
          onTap: () => MainShell.tab.value = 1,
          child: Row(children: [
            const IconTile(icon: Icons.person_pin_circle_rounded, color: BrandColors.amber),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('My stop', style: TextStyle(fontSize: 12, color: pal.muted, fontWeight: FontWeight.w500)),
                Text(p.myStopName ?? 'Tap to choose your stop',
                    maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: pal.text)),
              ]),
            ),
            Icon(Icons.chevron_right_rounded, color: pal.muted),
          ]),
        ),
      ),
      const SizedBox(height: 18),

      // Journey
      FadeSlideIn(
        key: const ValueKey('journey'),
        index: 5,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          SectionLabel('Journey', trailing: Text('Estimated, not guaranteed', style: TextStyle(fontSize: 11, color: pal.muted))),
          BmCard(padding: const EdgeInsets.fromLTRB(12, 8, 14, 8), child: JourneyTimeline(p: p)),
        ]),
      ),
      const SizedBox(height: 14),

      // Actions
      FadeSlideIn(
        key: const ValueKey('actions'),
        index: 6,
        child: Row(children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: () => open(const LiveMapScreen()),
              icon: const Icon(Icons.fullscreen_rounded, size: 18),
              label: const Text('Full map'),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: OutlinedButton.icon(
              onPressed: () => open(const SelectBusScreen()),
              icon: const Icon(Icons.swap_horiz_rounded, size: 18),
              label: const Text('Change bus'),
            ),
          ),
        ]),
      ),
    ];
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.p});
  final BusProvider p;

  @override
  Widget build(BuildContext context) {
    final pal = Palette.of(context);
    final theme = context.watch<ThemeController>();
    final name = p.studentName.isEmpty ? 'Student' : p.studentName.split(' ').first;
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 8, 4, 8),
      decoration: BoxDecoration(
        color: pal.card.withValues(alpha: 0.97),
        borderRadius: BorderRadius.circular(Ui.radius),
        border: Border.all(color: pal.line),
        boxShadow: pal.floatShadow,
      ),
      child: Row(children: [
        const BrandTile(size: 34),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Text('${greeting()}, $name',
                maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: pal.text, fontSize: 14, fontWeight: FontWeight.w700)),
            Text('BusMate · Live tracking', style: TextStyle(color: pal.muted, fontSize: 11, fontWeight: FontWeight.w500, letterSpacing: 0.2)),
          ]),
        ),
        IconButton(
          tooltip: theme.isDark ? 'Light theme' : 'Dark theme',
          visualDensity: VisualDensity.compact,
          onPressed: theme.toggle,
          icon: AnimatedSwitcher(
            duration: const Duration(milliseconds: 300),
            transitionBuilder: (child, anim) => RotationTransition(
              turns: Tween<double>(begin: 0.75, end: 1).animate(anim),
              child: FadeTransition(opacity: anim, child: child),
            ),
            child: Icon(
              theme.isDark ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
              key: ValueKey<bool>(theme.isDark),
              size: 20,
              color: pal.text,
            ),
          ),
        ),
        IconButton(
          tooltip: 'Alerts',
          visualDensity: VisualDensity.compact,
          onPressed: () => MainShell.tab.value = 2,
          icon: Badge(
            isLabelVisible: p.unread > 0,
            label: Text('${p.unread}'),
            child: Icon(Icons.notifications_none_rounded, size: 21, color: pal.text),
          ),
        ),
      ]),
    );
  }
}

class _NoBus extends StatelessWidget {
  const _NoBus();

  @override
  Widget build(BuildContext context) {
    final pal = Palette.of(context);
    return BmCard(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
      child: Column(children: [
        const IconTile(icon: Icons.directions_bus_outlined, size: 52),
        const SizedBox(height: 14),
        Text('No bus selected', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: pal.text)),
        const SizedBox(height: 4),
        Text('Choose the bus you travel on to see it live.', textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: pal.muted)),
        const SizedBox(height: 18),
        FilledButton.icon(
          onPressed: () => Navigator.push(context, MaterialPageRoute<void>(builder: (_) => const SelectBusScreen())),
          icon: const Icon(Icons.search_rounded, size: 18),
          label: const Text('Select bus'),
        ),
      ]),
    );
  }
}
