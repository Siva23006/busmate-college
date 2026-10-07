import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../models/models.dart';
import '../providers/trip_provider.dart';
import '../services/location_tracker.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';

/// Confirmation before tracking starts: bus, route, direction, where the trip begins and ends.
class StartTripScreen extends StatefulWidget {
  const StartTripScreen({super.key, required this.bus, required this.direction});
  final BusInfo bus;
  final String direction;
  @override
  State<StartTripScreen> createState() => _StartTripScreenState();
}

class _StartTripScreenState extends State<StartTripScreen> {
  bool _busy = false;
  String? _error;
  TrackingStartException? _gpsProblem;

  Future<void> _start() async {
    setState(() {
      _busy = true;
      _error = null;
      _gpsProblem = null;
    });
    try {
      await context.read<TripProvider>().startTrip(widget.bus, widget.direction);
      if (mounted) Navigator.of(context).popUntil((r) => r.isFirst); // RootGate now shows Active Trip
    } on TrackingStartException catch (e) {
      setState(() => _gpsProblem = e);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Could not start the trip. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final route = widget.bus.route;
    final direction = widget.direction;
    final hint = context.hint;
    final evening = direction == fromCollege;

    return Scaffold(
      appBar: AppBar(title: const Text('Start this trip?')),
      body: SafeArea(
        child: Column(children: [
          Expanded(
            child: ListView(padding: const EdgeInsets.fromLTRB(Ui.pad, 4, Ui.pad, Ui.pad), children: [
              // Direction is the one thing a driver can get wrong, so it is the loudest item.
              FadeSlideIn(
                child: Container(
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(color: BrandColors.amber, borderRadius: BorderRadius.circular(Ui.radius)),
                  child: Stack(children: [
                    Positioned.fill(child: RoutePattern(color: BrandColors.ink.withValues(alpha: 0.10))),
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(color: BrandColors.ink.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(13)),
                          child: Icon(evening ? Icons.nights_stay_rounded : Icons.wb_sunny_rounded, color: BrandColors.ink, size: 24),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(directionTrip(direction).toUpperCase(),
                                style: const TextStyle(color: BrandColors.ink, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1.2)),
                            const SizedBox(height: 2),
                            Text(
                              route == null
                                  ? directionLabel(direction)
                                  : '${route.startFor(direction) ?? 'Start'} → ${route.destinationFor(direction) ?? 'College'}',
                              style: const TextStyle(color: BrandColors.ink, fontSize: 18, fontWeight: FontWeight.w800, height: 1.2),
                            ),
                          ]),
                        ),
                      ]),
                    ),
                  ]),
                ),
              ),
              const SizedBox(height: Ui.gap),
              FadeSlideIn(
                delay: FadeSlideIn.stagger(1),
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                    child: Column(children: [
                      SummaryRow(icon: Icons.directions_bus_rounded, label: 'Bus', value: widget.bus.number, highlight: true),
                      const Divider(),
                      SummaryRow(icon: Icons.route_rounded, label: 'Route', value: route?.name ?? '-'),
                      const Divider(),
                      SummaryRow(icon: Icons.trip_origin_rounded, label: 'From', value: route?.startFor(direction) ?? '-'),
                      const Divider(),
                      SummaryRow(icon: Icons.flag_rounded, label: 'To', value: route?.destinationFor(direction) ?? '-'),
                      const Divider(),
                      SummaryRow(icon: Icons.pin_drop_rounded, label: 'Stops', value: '${route?.stops.length ?? 0}'),
                      if (route?.timeFor(direction) != null) ...[
                        const Divider(),
                        SummaryRow(icon: Icons.schedule_rounded, label: 'Scheduled start', value: clock12(route!.timeFor(direction))),
                      ],
                    ]),
                  ),
                ),
              ),
              const SizedBox(height: Ui.gap),
              FadeSlideIn(
                delay: FadeSlideIn.stagger(2),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Icon(Icons.info_outline_rounded, size: 16, color: hint),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text('Your location will be shared with students and the college while the trip is active. Keep the phone charged and mounted.',
                        style: TextStyle(fontSize: 12, color: hint, height: 1.4)),
                  ),
                ]),
              ),
              if (_error != null) ...[const SizedBox(height: Ui.gap), ErrorBanner(_error!)],
              if (_gpsProblem != null) ...[
                const SizedBox(height: Ui.gap),
                ErrorBanner(_gpsProblem!.message),
                if (_gpsProblem!.canOpenSettings)
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton.icon(
                      icon: const Icon(Icons.settings_rounded, size: 18),
                      label: const Text('Open settings'),
                      onPressed: () => _gpsProblem!.isAppSettings ? Geolocator.openAppSettings() : Geolocator.openLocationSettings(),
                    ),
                  ),
              ],
            ]),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(Ui.pad, 0, Ui.pad, Ui.pad),
            child: Row(children: [
              Expanded(child: OutlinedButton(onPressed: _busy ? null : () => Navigator.pop(context), child: const Text('Back'))),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(backgroundColor: BrandColors.green, foregroundColor: Colors.white),
                  onPressed: _busy ? null : _start,
                  icon: _busy
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                      : const Icon(Icons.play_arrow_rounded, size: 22),
                  label: Text(_busy ? 'Starting…' : 'START TRIP'),
                ),
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}
