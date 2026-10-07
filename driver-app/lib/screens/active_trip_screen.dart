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
import '../widgets/trip_map.dart';

/// Fleet-style trip screen: the route map fills the top, a heads-up panel below shows
/// FROM -> TO, next stop with ETA, journey progress, GPS / network, and HOLD TO END.
class ActiveTripScreen extends StatefulWidget {
  const ActiveTripScreen({super.key});
  @override
  State<ActiveTripScreen> createState() => _ActiveTripScreenState();
}

class _ActiveTripScreenState extends State<ActiveTripScreen> {
  bool _ending = false;
  String? _resumeError;

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
    final fix = t.lastFix;
    final speedKmh = fix == null || fix.speed < 0 ? null : (fix.speed * 3.6).round();
    final dark = Theme.of(context).brightness == Brightness.dark;
    final hint = Theme.of(context).hintColor;

    final gps = t.gpsState;
    final net = t.netState;
    final gpsLevel = gps == GpsState.connected ? Level.good : gps == GpsState.weak ? Level.warn : Level.bad;
    final netLevel = net == NetState.connected ? Level.good : net == NetState.unstable ? Level.warn : Level.bad;
    final gpsText = gps == GpsState.unavailable || fix == null
        ? 'No signal'
        : accuracyLevel(fix.accuracy) == AccuracyLevel.poor
            ? 'Poor ±${fix.accuracy.round()} m'
            : '±${fix.accuracy.round()} m';
    final netText = net == NetState.connected ? 'Online' : net == NetState.unstable ? 'Unstable' : 'Offline';

    final travelStops = route?.stopsFor(trip.direction) ?? const <StopInfo>[];
    // Place names set by the admin (e.g. Redhills -> Dr. MGR University); stop names as a fallback.
    final from = route?.startFor(trip.direction) ?? (travelStops.isNotEmpty ? travelStops.first.name : 'Start');
    final to = route?.destinationFor(trip.direction) ?? (travelStops.isNotEmpty ? travelStops.last.name : 'College');
    final shown = fix ?? t.lastKnown; // last known spot keeps the map useful until the first live fix
    final startFix = t.startFix;
    final wait = t.secondsWithoutFix;
    final waitingText = wait < 20
        ? 'Searching for GPS…'
        : wait < 60
            ? 'Still searching GPS… keep the phone near the windscreen'
            : 'No GPS yet. Check Location is ON and set to High accuracy';
    final nextStop = t.nextStopKnown ? (t.nextStopName ?? 'All stops reached') : (travelStops.isNotEmpty ? travelStops.first.name : '-');
    final int total = t.stopsTotal > 0 ? t.stopsTotal : travelStops.length;
    final int passed = t.stopsPassed > total ? total : t.stopsPassed;
    final double progress = total == 0 ? 0.0 : passed / total;
    final heading = fix != null && fix.heading >= 0 && fix.heading <= 360 ? fix.heading : null;
    final arriveAt = t.destinationEtaSeconds == null ? null : DateTime.now().add(Duration(seconds: t.destinationEtaSeconds!));

    return PopScope(
      canPop: false, // only END TRIP stops tracking
      child: Scaffold(
        body: Column(children: [
          // ================= MAP =================
          Expanded(
            child: Stack(children: [
              Positioned.fill(
                child: TripMap(
                  route: route,
                  direction: trip.direction,
                  position: shown == null ? null : LatLng(shown.latitude, shown.longitude),
                  start: startFix == null ? null : LatLng(startFix.latitude, startFix.longitude),
                  heading: heading,
                  height: double.infinity,
                  radius: 0,
                  waitingText: waitingText,
                ),
              ),
              if (fix == null && shown != null)
                Positioned(
                  left: 12,
                  right: 12,
                  bottom: 12,
                  child: Center(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(color: BrandColors.ink.withValues(alpha: 0.9), borderRadius: BorderRadius.circular(16)),
                      child: Text(waitingText, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700)),
                    ),
                  ),
                ),
              // Route ribbon: FROM -> TO
              Positioned(
                left: 12,
                right: 12,
                top: MediaQuery.of(context).padding.top + 10,
                child: Container(
                  padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                  decoration: BoxDecoration(
                    color: BrandColors.ink.withValues(alpha: 0.94),
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: const [BoxShadow(color: Colors.black38, blurRadius: 16, offset: Offset(0, 6))],
                  ),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      const _PulseDot(),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text('LIVE · ${bus?.number ?? trip.busNumber}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w900, letterSpacing: 1)),
                      ),
                      if (trip.isSimulation) ...[const DemoTag(), const SizedBox(width: 6)],
                      DirectionChip(trip.direction, onDark: true),
                    ]),
                    const SizedBox(height: 10),
                    Row(children: [
                      const Icon(Icons.trip_origin_rounded, color: BrandColors.green, size: 18),
                      const SizedBox(width: 6),
                      Flexible(child: _place(from)),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 8),
                        child: Icon(Icons.arrow_forward_rounded, color: BrandColors.amber, size: 22),
                      ),
                      const Icon(Icons.flag_rounded, color: BrandColors.amber, size: 18),
                      const SizedBox(width: 6),
                      Flexible(child: _place(to)),
                    ]),
                  ]),
                ),
              ),
              // Speed bubble
              Positioned(
                left: 12,
                bottom: 14,
                child: Container(
                  width: 108,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    color: dark ? BrandColors.ink2 : Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: BrandColors.amber, width: 3),
                    boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 12, offset: Offset(0, 4))],
                  ),
                  child: Column(children: [
                    Text(speedKmh?.toString() ?? '--',
                        style: const TextStyle(fontSize: 40, fontWeight: FontWeight.w900, height: 1, fontFeatures: [FontFeature.tabularFigures()])),
                    Text('km/h', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: hint)),
                  ]),
                ),
              ),
              // Trip timer
              Positioned(
                right: 12,
                bottom: 14,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(color: BrandColors.ink.withValues(alpha: 0.9), borderRadius: BorderRadius.circular(18)),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                    _Elapsed(trip.startTime),
                    Text('since ${clockTime(trip.startTime)}', style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w700)),
                  ]),
                ),
              ),
            ]),
          ),

          // ================= HEADS-UP PANEL =================
          Container(
            decoration: BoxDecoration(
              color: Theme.of(context).scaffoldBackgroundColor,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(26)),
              boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 18, offset: Offset(0, -4))],
            ),
            padding: EdgeInsets.fromLTRB(Ui.pad, 14, Ui.pad, MediaQuery.of(context).padding.bottom + 10),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (_resumeError != null) ...[ErrorBanner(_resumeError!, onRetry: _resume), const SizedBox(height: 10)],
              if (t.mockDetected) ...[
                const ErrorBanner('A fake (mock) GPS app is active. BusMate will not send fake locations. Turn it off in Developer options.'),
                const SizedBox(height: 10),
              ],
              if (t.lastServerMessage != null) ...[ErrorBanner(t.lastServerMessage!), const SizedBox(height: 10)],

              // Next stop
              Row(children: [
                Container(
                  width: 54,
                  height: 54,
                  decoration: BoxDecoration(color: BrandColors.amber, borderRadius: BorderRadius.circular(17)),
                  child: const Icon(Icons.near_me_rounded, color: BrandColors.ink, size: 28),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('NEXT STOP', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, letterSpacing: 1.4, color: hint)),
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 300),
                      child: Text(nextStop,
                          key: ValueKey(nextStop),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, height: 1.15)),
                    ),
                  ]),
                ),
                if (t.nextStopEtaSeconds != null)
                  Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                    Text(_mins(t.nextStopEtaSeconds!), style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: BrandColors.amber)),
                    Text(t.nextStopMeters == null ? '' : distanceText(t.nextStopMeters!.toDouble()),
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: hint)),
                  ]),
              ]),
              const SizedBox(height: 14),

              // Journey progress
              Row(children: [
                Text('$passed of $total stops', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                const SizedBox(width: 12),
                Expanded(
                  child: arriveAt == null
                      ? const SizedBox.shrink()
                      : Text('$to ~${clockTime(arriveAt)}',
                          textAlign: TextAlign.right,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: hint)),
                ),
              ]),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: LinearProgressIndicator(
                  value: progress,
                  minHeight: 10,
                  backgroundColor: dark ? BrandColors.ink3 : const Color(0xFFE3E8F0),
                  valueColor: const AlwaysStoppedAnimation<Color>(BrandColors.green),
                ),
              ),
              const SizedBox(height: 14),

              // GPS + network
              Row(children: [
                Expanded(child: StatusBadge(icon: Icons.gps_fixed_rounded, label: 'GPS', value: gpsText, level: gpsLevel)),
                const SizedBox(width: 10),
                Expanded(
                  child: StatusBadge(
                    icon: net == NetState.offline ? Icons.wifi_off_rounded : Icons.wifi_rounded,
                    label: t.queuedCount > 0 ? 'Network · ${t.queuedCount} queued' : 'Network',
                    value: netText,
                    level: netLevel,
                  ),
                ),
              ]),
              const SizedBox(height: 14),

              // END TRIP: needs a long press
              HoldButton(label: 'HOLD TO END TRIP', icon: Icons.stop_rounded, busy: _ending, onConfirmed: _end),
              const SizedBox(height: 6),
              Text('Last sent ${agoText(t.lastSentAt)} · press and hold to end',
                  textAlign: TextAlign.center, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: hint)),
            ]),
          ),
        ]),
      ),
    );
  }

  static String _mins(int seconds) {
    final m = (seconds / 60).round();
    return m < 1 ? 'now' : '$m min';
  }

  Widget _place(String name) => Text(name,
      maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800));
}

/// Slowly pulsing green dot: tracking is live.
/// Static "live" dot (a constantly animating dot keeps the GPU busy and costs battery).
class _PulseDot extends StatelessWidget {
  const _PulseDot();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 12,
      height: 12,
      decoration: BoxDecoration(
        color: BrandColors.green,
        shape: BoxShape.circle,
        boxShadow: [BoxShadow(color: BrandColors.green.withValues(alpha: 0.6), blurRadius: 6, spreadRadius: 1)],
      ),
    );
  }
}

/// Trip timer. Only this small text rebuilds every second (not the map), which saves battery.
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
    return Text(durationText(elapsed),
        style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w900, fontFeatures: [FontFeature.tabularFigures()]));
  }
}
