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
    final hint = Theme.of(context).hintColor;

    return Scaffold(
      appBar: AppBar(title: const Text('Start this trip?')),
      body: SafeArea(
        child: Column(children: [
          Expanded(
            child: ListView(padding: const EdgeInsets.fromLTRB(Ui.pad, 8, Ui.pad, Ui.pad), children: [
              // Direction is the one thing a driver can get wrong, so it is the loudest item.
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(color: BrandColors.amber, borderRadius: BorderRadius.circular(Ui.radius)),
                child: Row(children: [
                  Icon(direction == fromCollege ? Icons.nights_stay_rounded : Icons.wb_sunny_rounded, color: BrandColors.ink, size: 44),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${directionShift(direction)} TRIP',
                          style: const TextStyle(color: BrandColors.ink, fontSize: 15, fontWeight: FontWeight.w900, letterSpacing: 1.5)),
                      Text(directionLabel(direction), style: const TextStyle(color: BrandColors.ink, fontSize: 32, fontWeight: FontWeight.w900, height: 1.15)),
                    ]),
                  ),
                ]),
              ),
              const SizedBox(height: Ui.gap),
              Card(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
                  child: Column(children: [
                    SummaryRow(icon: Icons.directions_bus_rounded, label: 'Bus', value: widget.bus.number),
                    const Divider(),
                    SummaryRow(icon: Icons.route_rounded, label: 'Route', value: route?.name ?? '-'),
                    const Divider(),
                    SummaryRow(icon: Icons.trip_origin_rounded, label: 'From', value: route?.startFor(direction) ?? '-'),
                    const Divider(),
                    SummaryRow(icon: Icons.flag_rounded, label: 'To', value: route?.destinationFor(direction) ?? '-'),
                    const Divider(),
                    SummaryRow(icon: Icons.pin_drop_rounded, label: 'Stops', value: '${route?.stops.length ?? 0}'),
                    if (direction == toCollege && route?.scheduledStart != null) ...[
                      const Divider(),
                      SummaryRow(icon: Icons.schedule_rounded, label: 'Scheduled start', value: route!.scheduledStart!),
                    ],
                  ]),
                ),
              ),
              const SizedBox(height: Ui.gap),
              Text('Your location will be shared with students and the college while the trip is active. Keep the phone charged and mounted.',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: hint)),
              if (_error != null) ...[const SizedBox(height: Ui.gap), ErrorBanner(_error!)],
              if (_gpsProblem != null) ...[
                const SizedBox(height: Ui.gap),
                ErrorBanner(_gpsProblem!.message),
                if (_gpsProblem!.canOpenSettings)
                  TextButton.icon(
                    icon: const Icon(Icons.settings),
                    label: const Text('OPEN SETTINGS'),
                    onPressed: () => _gpsProblem!.isAppSettings ? Geolocator.openAppSettings() : Geolocator.openLocationSettings(),
                  ),
              ],
            ]),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(Ui.pad, 0, Ui.pad, Ui.pad),
            child: Row(children: [
              Expanded(child: OutlinedButton(onPressed: _busy ? null : () => Navigator.pop(context), child: const Text('BACK'))),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: BrandColors.green, foregroundColor: Colors.white),
                  onPressed: _busy ? null : _start,
                  child: _busy ? const SizedBox(width: 28, height: 28, child: CircularProgressIndicator(strokeWidth: 3, color: Colors.white)) : const Text('START TRIP'),
                ),
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}
