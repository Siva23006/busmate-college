import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart' show LatLng;
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../models/models.dart';
import '../providers/trip_provider.dart';
import '../services/location_tracker.dart';
import '../theme/app_theme.dart';
import '../utils/accuracy.dart';
import '../utils/format.dart';
import '../widgets/common.dart';
import '../widgets/route_timeline.dart';
import '../widgets/trip_map.dart';

/// Trip screen: Live (full map + next stop + HOLD TO END) · Stops (timeline) · More (status).
///
/// Battery: nothing here animates forever. The tracker notifies every few seconds; the map only
/// moves its camera when a new GPS fix arrives, and only the small [_Elapsed] text ticks each second.
class ActiveTripScreen extends StatefulWidget {
  const ActiveTripScreen({super.key});
  @override
  State<ActiveTripScreen> createState() => _ActiveTripScreenState();
}

class _ActiveTripScreenState extends State<ActiveTripScreen> {
  bool _ending = false;
  String? _resumeError;
  int _tab = 0;
  final _mapKey = GlobalKey<TripMapState>();

  @override
  void initState() {
    super.initState();
    // After an app restart the trip is still active on the server: restart GPS.
    WidgetsBinding.instance.addPostFrameCallback((_) => _resume());
  }

  Future<void> _resume() async {
    final trips = context.read<TripProvider>();
    if (trips.tracker.isRunning) return;
    try {
      await trips.resumeTracking();
      if (mounted) setState(() => _resumeError = null);
    } on TrackingStartException catch (e) {
      if (mounted) setState(() => _resumeError = e.message);
    }
  }

  /// Called after END TRIP has been held down (the hold is the confirmation).
  Future<void> _end() async {
    if (_ending) return;
    setState(() => _ending = true);
    try {
      await context.read<TripProvider>().endTrip();
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _ending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final trips = context.watch<TripProvider>();
    final t = trips.tracker;
    final trip = trips.activeTrip;
    // The trip has just ended and this screen is fading out.
    if (trip == null) return const Scaffold();
    final bus = trips.activeBus ?? trips.busById(trip.busId);
    final route = bus?.route;
    final travelStops = route?.stopsFor(trip.direction) ?? const <StopInfo>[];
    final int total = t.stopsTotal > 0 ? t.stopsTotal : travelStops.length;
    final int passed = t.stopsPassed > total ? total : t.stopsPassed;
    final info = _TripInfo(
      trip: trip,
      busNumber: bus?.number ?? trip.busNumber,
      route: route,
      // Place names set by the admin; stop names as a fallback.
      from: route?.startFor(trip.direction) ?? (travelStops.isNotEmpty ? travelStops.first.name : 'Start'),
      to: route?.destinationFor(trip.direction) ?? (travelStops.isNotEmpty ? travelStops.last.name : 'College'),
      total: total,
      passed: passed,
      arriveAt: t.destinationEtaSeconds == null ? null : DateTime.now().add(Duration(seconds: t.destinationEtaSeconds!)),
    );

    return PopScope(
      canPop: false, // only END TRIP stops tracking
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && _tab != 0) setState(() => _tab = 0);
      },
      child: Scaffold(
        // IndexedStack keeps the map alive between tabs (no re-creation, no camera reset).
        body: IndexedStack(index: _tab, children: [
          _live(context, t, info, travelStops),
          _StopsTab(info: info, tracker: t, onBack: () => setState(() => _tab = 0)),
          _MoreTab(info: info, tracker: t),
        ]),
        bottomNavigationBar: NavigationBar(
          selectedIndex: _tab,
          onDestinationSelected: (i) => setState(() => _tab = i),
          destinations: const [
            NavigationDestination(icon: Icon(Icons.map_outlined), selectedIcon: Icon(Icons.map_rounded), label: 'Live'),
            NavigationDestination(icon: Icon(Icons.format_list_bulleted_rounded), selectedIcon: Icon(Icons.list_alt_rounded), label: 'Stops'),
            NavigationDestination(icon: Icon(Icons.more_horiz_rounded), selectedIcon: Icon(Icons.more_horiz), label: 'More'),
          ],
        ),
      ),
    );
  }

  Widget _live(BuildContext context, LocationTracker t, _TripInfo info, List<StopInfo> travelStops) {
    final trip = info.trip;
    final fix = t.lastFix;
    final speedKmh = fix == null || fix.speed < 0 ? null : (fix.speed * 3.6).round();
    final shown = fix ?? t.lastKnown; // last known spot keeps the map useful until the first live fix
    final startFix = t.startFix;
    final wait = t.secondsWithoutFix;
    final waitingText = wait < 20
        ? 'Searching for GPS…'
        : wait < 60
            ? 'Still searching GPS… keep the phone near the windscreen'
            : 'No GPS yet. Check Location is ON and set to High accuracy';
    final heading = fix != null && fix.heading >= 0 && fix.heading <= 360 ? fix.heading : null;
    final top = MediaQuery.of(context).padding.top;

    final gps = t.gpsState;
    final net = t.netState;
    final gpsLevel = gps == GpsState.connected ? Level.good : gps == GpsState.weak ? Level.warn : Level.bad;
    final netLevel = net == NetState.connected ? Level.good : net == NetState.unstable ? Level.warn : Level.bad;
    final gpsText = gps == GpsState.unavailable || fix == null
        ? 'No GPS'
        : accuracyLevel(fix.accuracy) == AccuracyLevel.poor
            ? 'GPS poor'
            : 'GPS ±${fix.accuracy.round()} m';
    final netText = net == NetState.connected
        ? 'Online'
        : net == NetState.unstable
            ? (t.queuedCount > 0 ? '${t.queuedCount} queued' : 'Unstable')
            : 'Offline';

    final nextStop = t.nextStopKnown ? (t.nextStopName ?? 'All stops reached') : (travelStops.isNotEmpty ? travelStops.first.name : '-');
    final progress = info.total == 0 ? 0.0 : info.passed / info.total;

    return Column(children: [
      // ================= MAP =================
      Expanded(
        child: Stack(children: [
          Positioned.fill(
            child: TripMap(
              key: _mapKey,
              route: info.route,
              direction: trip.direction,
              position: shown == null ? null : LatLng(shown.latitude, shown.longitude),
              start: startFix == null ? null : LatLng(startFix.latitude, startFix.longitude),
              heading: heading,
              height: double.infinity,
              radius: 0,
              waitingText: waitingText,
              badgeBottom: 72,
            ),
          ),
          if (fix == null && shown != null)
            Positioned(
              left: 12,
              right: 12,
              bottom: 72,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(color: BrandColors.ink.withValues(alpha: 0.9), borderRadius: BorderRadius.circular(14)),
                  child: Text(waitingText, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
                ),
              ),
            ),
          // Banner: LIVE · bus · run, FROM -> TO
          Positioned(left: 12, right: 12, top: top + 8, child: _LiveBanner(info: info)),
          // Map buttons
          Positioned(
            right: 12,
            top: top + 96,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              _MapButton(icon: Icons.my_location_rounded, tooltip: 'Centre on bus', onTap: () => _mapKey.currentState?.recenter()),
              const SizedBox(height: 10),
              _MapButton(icon: Icons.route_rounded, tooltip: 'Show whole route', onTap: () => _mapKey.currentState?.showWholeRoute()),
            ]),
          ),
          // Speed
          Positioned(
            left: 12,
            bottom: 12,
            child: _DarkChip(
              child: Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
                Text(speedKmh?.toString() ?? '--',
                    style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800, height: 1, fontFeatures: [FontFeature.tabularFigures()])),
                const SizedBox(width: 4),
                const Text('km/h', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600)),
              ]),
            ),
          ),
          // Trip timer
          Positioned(
            right: 12,
            bottom: 12,
            child: _DarkChip(
              child: Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: [
                _Elapsed(trip.startTime),
                Text('Since ${clockTime(trip.startTime)}', style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w500)),
              ]),
            ),
          ),
        ]),
      ),

      // ================= NEXT STOP CARD =================
      Container(
        decoration: BoxDecoration(
          color: context.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
          boxShadow: const [BoxShadow(color: Color(0x22000000), blurRadius: 16, offset: Offset(0, -4))],
        ),
        padding: const EdgeInsets.fromLTRB(Ui.pad, 14, Ui.pad, 12),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          if (_resumeError != null) ...[ErrorBanner(_resumeError!, onRetry: _resume), const SizedBox(height: 8)],
          if (t.mockDetected) ...[
            const ErrorBanner('A fake (mock) GPS app is active. BusMate will not send fake locations. Turn it off in Developer options.'),
            const SizedBox(height: 8),
          ],
          if (t.lastServerMessage != null) ...[ErrorBanner(t.lastServerMessage!), const SizedBox(height: 8)],
          Row(children: [
            const IconTile(icon: Icons.near_me_rounded, color: BrandColors.amber, size: 44, solid: true),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(t.nextStopMeters == null ? 'Next Stop' : 'Next Stop (${distanceText(t.nextStopMeters!.toDouble())})',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: context.hint)),
                const SizedBox(height: 2),
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 300),
                  child: Text(nextStop,
                      key: ValueKey(nextStop),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, height: 1.2)),
                ),
              ]),
            ),
            if (t.nextStopEtaSeconds != null) ...[
              const SizedBox(width: 8),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('ETA', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: context.hint)),
                Text(minutesText(t.nextStopEtaSeconds!),
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: context.amberText)),
              ]),
            ],
          ]),
          const SizedBox(height: 12),
          Row(children: [
            Text('${info.passed} of ${info.total} stops', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            const Spacer(),
            _MiniStatus(level: gpsLevel, text: gpsText),
            const SizedBox(width: 10),
            _MiniStatus(level: netLevel, text: netText),
          ]),
          const SizedBox(height: 8),
          AnimatedBar(value: progress, height: 7),
          const SizedBox(height: 12),
          HoldButton(label: 'HOLD TO END TRIP', icon: Icons.stop_rounded, busy: _ending, onConfirmed: _end),
        ]),
      ),
    ]);
  }
}

/// Everything the three tabs share about the running trip.
class _TripInfo {
  const _TripInfo({
    required this.trip,
    required this.busNumber,
    required this.route,
    required this.from,
    required this.to,
    required this.total,
    required this.passed,
    required this.arriveAt,
  });
  final Trip trip;
  final String busNumber;
  final RouteInfo? route;
  final String from;
  final String to;
  final int total;
  final int passed;
  final DateTime? arriveAt;
}

class _LiveBanner extends StatelessWidget {
  const _LiveBanner({required this.info});
  final _TripInfo info;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 10, 10, 10),
      decoration: BoxDecoration(
        color: BrandColors.ink.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 14, offset: Offset(0, 5))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
        Row(children: [
          const LiveDot(),
          const SizedBox(width: 8),
          Expanded(
            child: Text('LIVE · ${info.busNumber}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w800, letterSpacing: 0.8)),
          ),
          if (info.trip.isSimulation) ...[const DemoTag(), const SizedBox(width: 6)],
          DirectionChip(info.trip.direction, onDark: true),
        ]),
        const SizedBox(height: 6),
        Row(children: [
          const LiveDot(size: 6, color: BrandColors.amber),
          const SizedBox(width: 9),
          Expanded(
            child: Text('${info.from.toUpperCase()}  →  ${info.to.toUpperCase()}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.3)),
          ),
        ]),
      ]),
    );
  }
}

class _MapButton extends StatelessWidget {
  const _MapButton({required this.icon, required this.tooltip, required this.onTap});
  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: context.surface,
        shape: const CircleBorder(),
        elevation: 3,
        shadowColor: Colors.black38,
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: SizedBox(width: 48, height: 48, child: Icon(icon, size: 22, color: context.isDarkTheme ? BrandColors.amber : BrandColors.ink)),
        ),
      ),
    );
  }
}

class _DarkChip extends StatelessWidget {
  const _DarkChip({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: BrandColors.ink.withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(14),
        boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 10, offset: Offset(0, 3))],
      ),
      child: child,
    );
  }
}

class _MiniStatus extends StatelessWidget {
  const _MiniStatus({required this.level, required this.text});
  final Level level;
  final String text;

  @override
  Widget build(BuildContext context) {
    final c = levelColor(level);
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Container(width: 7, height: 7, decoration: BoxDecoration(color: c, shape: BoxShape.circle)),
      const SizedBox(width: 5),
      Text(text, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: level == Level.good ? context.hint : c)),
    ]);
  }
}

/// Stops tab: the route timeline with progress from the tracker.
class _StopsTab extends StatelessWidget {
  const _StopsTab({required this.info, required this.tracker, required this.onBack});
  final _TripInfo info;
  final LocationTracker tracker;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final route = info.route;
    final hint = context.hint;
    return SafeArea(
      bottom: false,
      child: ListView(padding: const EdgeInsets.fromLTRB(8, 6, Ui.pad, 24), children: [
        Row(children: [
          IconButton(tooltip: 'Back to map', icon: const Icon(Icons.arrow_back_rounded), onPressed: onBack),
          const SizedBox(width: 2),
          const Text('Route Stops', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        ]),
        Padding(
          padding: const EdgeInsets.only(left: 8),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${info.busNumber}${route == null ? '' : ' · ${route.name}'}', style: TextStyle(fontSize: 13, color: hint)),
            const SizedBox(height: 8),
            Row(children: [
              Text('${info.total} stops', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
              const SizedBox(width: 8),
              DirectionChip(info.trip.direction),
              const Spacer(),
              Text('${info.passed}/${info.total} done', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: hint)),
            ]),
            const SizedBox(height: 8),
            AnimatedBar(value: info.total == 0 ? 0.0 : info.passed / info.total, height: 6),
            const SizedBox(height: 14),
            if (route == null)
              Text('Route details are not available.', style: TextStyle(fontSize: 14, color: hint))
            else ...[
              Card(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(8, 8, 10, 8),
                  child: RouteTimeline(
                    route: route,
                    direction: info.trip.direction,
                    live: true,
                    passed: info.passed,
                    nextName: tracker.nextStopKnown ? tracker.nextStopName : null,
                    nextEtaSeconds: tracker.nextStopEtaSeconds,
                    nextMeters: tracker.nextStopMeters,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              RouteTotalsCard(route: route, direction: info.trip.direction, arriveAt: info.arriveAt),
            ],
          ]),
        ),
      ]),
    );
  }
}

/// More tab: trip details, connection status, theme.
class _MoreTab extends StatelessWidget {
  const _MoreTab({required this.info, required this.tracker});
  final _TripInfo info;
  final LocationTracker tracker;

  @override
  Widget build(BuildContext context) {
    final t = tracker;
    final fix = t.lastFix;
    final gps = t.gpsState;
    final net = t.netState;
    final hint = context.hint;
    return SafeArea(
      bottom: false,
      child: ListView(padding: const EdgeInsets.fromLTRB(Ui.pad, 14, Ui.pad, 24), children: [
        const Text('More', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 2),
        Text('Trip details and connection', style: TextStyle(fontSize: 13, color: hint)),
        const SizedBox(height: 16),
        const SectionLabel('This trip'),
        Card(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            child: Column(children: [
              SummaryRow(icon: Icons.directions_bus_rounded, label: 'Bus', value: info.busNumber, highlight: true),
              const Divider(),
              SummaryRow(icon: Icons.route_rounded, label: 'Route', value: info.route?.name ?? info.trip.routeName ?? '-'),
              const Divider(),
              SummaryRow(icon: Icons.trip_origin_rounded, label: 'From', value: info.from),
              const Divider(),
              SummaryRow(icon: Icons.flag_rounded, label: 'To', value: info.to),
              const Divider(),
              SummaryRow(icon: Icons.play_circle_outline_rounded, label: 'Started', value: clockTime(info.trip.startTime)),
              if (info.arriveAt != null) ...[
                const Divider(),
                SummaryRow(icon: Icons.schedule_rounded, label: 'Expected arrival', value: clockTime(info.arriveAt)),
              ],
            ]),
          ),
        ),
        const SizedBox(height: 18),
        const SectionLabel('Connection'),
        Card(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            child: Column(children: [
              StatusLine(
                icon: Icons.gps_fixed_rounded,
                label: 'GPS',
                value: gps == GpsState.unavailable || fix == null ? 'No signal' : accuracyLabel(fix.accuracy),
                level: gps == GpsState.connected ? Level.good : gps == GpsState.weak ? Level.warn : Level.bad,
              ),
              const Divider(),
              StatusLine(
                icon: net == NetState.offline ? Icons.wifi_off_rounded : Icons.wifi_rounded,
                label: 'Network',
                value: net == NetState.connected ? 'Online' : net == NetState.unstable ? 'Unstable' : 'Offline',
                level: net == NetState.connected ? Level.good : net == NetState.unstable ? Level.warn : Level.bad,
              ),
              const Divider(),
              StatusLine(
                icon: Icons.cloud_upload_outlined,
                label: 'Last sent',
                value: agoText(t.lastSentAt),
                level: t.lastSentAt == null ? Level.warn : Level.good,
              ),
              if (t.queuedCount > 0) ...[
                const Divider(),
                StatusLine(icon: Icons.inbox_rounded, label: 'Waiting to send', value: '${t.queuedCount} points', level: Level.warn),
              ],
            ]),
          ),
        ),
        const SizedBox(height: 18),
        const SectionLabel('Appearance'),
        const Card(child: ThemeSwitchTile()),
        const SizedBox(height: 16),
        Text('To finish, go to Live and press and hold END TRIP.', textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: hint)),
        const SizedBox(height: 24),
        const CreditFooter(),
      ]),
    );
  }
}

/// Trip timer "00:12:36". Only this small text rebuilds every second (not the map), which saves battery.
class _Elapsed extends StatefulWidget {
  const _Elapsed(this.start);
  final DateTime? start;
  @override
  State<_Elapsed> createState() => _ElapsedState();
}

class _ElapsedState extends State<_Elapsed> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final elapsed = widget.start == null ? Duration.zero : DateTime.now().difference(widget.start!);
    return Text(clockDuration(elapsed.isNegative ? Duration.zero : elapsed),
        style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800, fontFeatures: [FontFeature.tabularFigures()]));
  }
}
