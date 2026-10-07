import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../providers/session_provider.dart';
import '../providers/trip_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';
import '../widgets/trip_map.dart';
import 'start_trip_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  int? _selectedBusId;
  String _gps = 'CHECKING'; // CHECKING, READY, OFF, NO PERMISSION
  bool? _locationOn; // null while checking
  LocationPermission? _permission; // null while checking
  bool _online = true;
  // Morning run before noon, evening run after; the driver can change it.
  String _direction = directionForTime(DateTime.now());
  StreamSubscription<List<ConnectivityResult>>? _connSub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    context.read<TripProvider>().loadHome();
    _checkGps();
    Connectivity().checkConnectivity().then(_setConn);
    _connSub = Connectivity().onConnectivityChanged.listen(_setConn);
  }

  void _setConn(List<ConnectivityResult> r) {
    if (mounted) setState(() => _online = !r.contains(ConnectivityResult.none));
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _checkGps(); // user may have turned GPS on in settings
  }

  Future<void> _checkGps() async {
    final enabled = await Geolocator.isLocationServiceEnabled();
    final perm = await Geolocator.checkPermission();
    if (!mounted) return;
    setState(() {
      _locationOn = enabled;
      _permission = perm;
      if (!enabled) {
        _gps = 'OFF';
      } else if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
        _gps = 'NO PERMISSION';
      } else {
        _gps = 'READY';
      }
    });
  }

  Future<void> _fixLocation() async {
    await Geolocator.openLocationSettings();
    _checkGps();
  }

  Future<void> _fixPermission() async {
    final p = _permission == LocationPermission.deniedForever ? _permission! : await Geolocator.requestPermission();
    if (p == LocationPermission.deniedForever) await Geolocator.openAppSettings();
    _checkGps();
  }

  Future<void> _logout() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Log out?', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('CANCEL')),
          TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('LOG OUT')),
        ],
      ),
    );
    if (ok == true && mounted) context.read<SessionProvider>().logout();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _connSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final trips = context.watch<TripProvider>();
    final theme = context.watch<ThemeController>();
    final home = trips.home;
    final buses = home?.buses ?? const <BusInfo>[];
    final bus = buses.isEmpty ? null : buses.firstWhere((b) => b.id == _selectedBusId, orElse: () => buses.first);
    final hint = Theme.of(context).hintColor;
    final name = home?.name ?? context.watch<SessionProvider>().user?.name ?? 'Driver';
    final canStart = bus != null && bus.route != null && bus.status != 'MAINTENANCE';

    // Readiness checklist: green = ready, amber = needs a tap / still checking, red = blocked.
    final permission = _permission;
    final permissionOk = permission == LocationPermission.always || permission == LocationPermission.whileInUse;
    final (gpsValue, gpsLevel) = switch (_locationOn) {
      null => ('CHECKING', Level.warn),
      true => ('READY', Level.good),
      false => ('TURNED OFF', Level.bad),
    };
    final (netValue, netLevel) = !_online
        ? ('OFFLINE', Level.bad)
        : trips.error == null
            ? ('CONNECTED', Level.good)
            : ('UNSTABLE', Level.warn);
    final (permValue, permLevel) = permission == null
        ? ('CHECKING', Level.warn)
        : permissionOk
            ? ('ALLOWED', Level.good)
            : permission == LocationPermission.deniedForever
                ? ('BLOCKED', Level.bad)
                : ('NOT ALLOWED', Level.warn);
    final allReady = _gps == 'READY' && netLevel == Level.good;

    return Scaffold(
      appBar: AppBar(
        titleSpacing: Ui.pad,
        title: Row(children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: BrandColors.amber, borderRadius: BorderRadius.circular(13)),
            child: const Icon(Icons.directions_bus_rounded, color: BrandColors.ink, size: 26),
          ),
          const SizedBox(width: 12),
          const Text('BUSMATE', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 2.5)),
        ]),
        actions: [
          IconButton(
            tooltip: theme.isDark ? 'Light mode' : 'Dark mode',
            icon: Icon(theme.isDark ? Icons.light_mode_rounded : Icons.dark_mode_rounded),
            onPressed: theme.toggle,
          ),
          IconButton(tooltip: 'Logout', icon: const Icon(Icons.logout_rounded), onPressed: _logout),
          const SizedBox(width: 8),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await trips.loadHome();
          await _checkGps();
        },
        child: ListView(padding: const EdgeInsets.fromLTRB(Ui.pad, 4, Ui.pad, 32), children: [
          Text('Hello, $name', style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900)),
          if (home != null) Text('Driver ID ${home.employeeId}', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: hint)),
          const SizedBox(height: Ui.gap),
          if (trips.error != null) ...[ErrorBanner(trips.error!, onRetry: trips.loadHome), const SizedBox(height: Ui.gap)],
          if (trips.loading && home == null) const Padding(padding: EdgeInsets.all(48), child: Center(child: CircularProgressIndicator())),
          if (home != null && buses.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text('No bus is assigned to you yet. Please contact the transport office.', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w600)),
              ),
            ),
          if (buses.length > 1) ...[
            const SectionLabel('Select bus'),
            Wrap(spacing: 10, runSpacing: 10, children: [
              for (final b in buses) _BusChoice(label: b.number, selected: b.id == bus?.id, onTap: () => setState(() => _selectedBusId = b.id)),
            ]),
            const SizedBox(height: Ui.gap),
          ],
          if (bus != null) ...[
            _HeroCard(bus: bus, direction: _direction, onDirection: (d) => setState(() => _direction = d)),
            if (bus.route != null) ...[
              const SizedBox(height: Ui.pad),
              const SectionLabel('Route to follow'),
              TripMap(
                key: ValueKey('preview-${bus.id}-$_direction'),
                route: bus.route,
                direction: _direction,
                height: 210,
                preview: true, // shows the driver's own blue dot, no "waiting for GPS" badge
              ),
              const SizedBox(height: 8),
              _StopStrip(stops: bus.route!.stopsFor(_direction)),
            ],
            const SizedBox(height: Ui.pad),
            const SectionLabel('Ready to drive'),
            Card(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                child: Column(children: [
                  ChecklistRow(
                    icon: Icons.gps_fixed_rounded,
                    label: 'GPS ready',
                    value: gpsValue,
                    level: gpsLevel,
                    action: 'Tap to turn on Location',
                    onTap: _locationOn == false ? _fixLocation : null,
                  ),
                  const Divider(),
                  ChecklistRow(icon: Icons.wifi_rounded, label: 'Network connected', value: netValue, level: netLevel),
                  const Divider(),
                  ChecklistRow(
                    icon: Icons.verified_user_rounded,
                    label: 'Location permission',
                    value: permValue,
                    level: permLevel,
                    action: permission == LocationPermission.deniedForever ? 'Tap to open app settings' : 'Tap to allow',
                    onTap: permission != null && !permissionOk ? _fixPermission : null,
                  ),
                ]),
              ),
            ),
            const SizedBox(height: Ui.pad),
            FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: BrandColors.green,
                foregroundColor: Colors.white,
                minimumSize: const Size.fromHeight(84),
                textStyle: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, letterSpacing: 1.5),
              ),
              onPressed: canStart
                  ? () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => StartTripScreen(bus: bus, direction: _direction)))
                  : null,
              icon: const Icon(Icons.play_arrow_rounded, size: 40),
              label: const Text('START TRIP'),
            ),
            const SizedBox(height: 12),
            Text(
              bus.route == null
                  ? 'This bus has no route yet. Contact the transport office.'
                  : bus.status == 'MAINTENANCE'
                      ? 'This bus is marked as under maintenance.'
                      : allReady
                          ? '${directionShift(_direction)} run · ${bus.route!.startFor(_direction) ?? 'Start'} → ${bus.route!.destinationFor(_direction) ?? 'College'}'
                          : 'Fix the items above. You will be asked again when you start.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: hint),
            ),
          ],
        ]),
      ),
    );
  }
}

/// Bus number, route and the morning / evening choice.
class _HeroCard extends StatelessWidget {
  const _HeroCard({required this.bus, required this.direction, required this.onDirection});
  final BusInfo bus;
  final String direction;
  final ValueChanged<String> onDirection;

  @override
  Widget build(BuildContext context) {
    final route = bus.route;
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [BrandColors.ink3, BrandColors.ink]),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: Colors.white.withValues(alpha: 0.10)),
        boxShadow: const [BoxShadow(color: Color(0x33000000), blurRadius: 24, offset: Offset(0, 12))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Text('YOUR BUS', style: TextStyle(color: Colors.white60, fontSize: 14, fontWeight: FontWeight.w800, letterSpacing: 1.6)),
          const Spacer(),
          if (bus.isDemo) const DemoTag(),
        ]),
        const SizedBox(height: 4),
        Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
          const Icon(Icons.directions_bus_rounded, color: BrandColors.amber, size: 40),
          const SizedBox(width: 12),
          Expanded(
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(bus.number, style: const TextStyle(color: Colors.white, fontSize: 44, fontWeight: FontWeight.w900, height: 1.1)),
            ),
          ),
        ]),
        const SizedBox(height: 14),
        if (route == null)
          const Text('No route assigned', style: TextStyle(color: Colors.white, fontSize: 21, fontWeight: FontWeight.w700))
        else ...[
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 250),
            layoutBuilder: (current, previous) => Stack(alignment: Alignment.centerLeft, children: [...previous, if (current != null) current]),
            child: Row(key: ValueKey(direction), children: [
              Flexible(child: Text(route.startFor(direction) ?? 'Start', style: const TextStyle(color: Colors.white, fontSize: 21, fontWeight: FontWeight.w800))),
              const Padding(padding: EdgeInsets.symmetric(horizontal: 8), child: Icon(Icons.arrow_forward_rounded, color: BrandColors.amber, size: 24)),
              Flexible(child: Text(route.destinationFor(direction) ?? 'College', style: const TextStyle(color: Colors.white, fontSize: 21, fontWeight: FontWeight.w800))),
            ]),
          ),
          const SizedBox(height: 6),
          Text(
            '${route.name} · ${route.stops.length} stops'
            '${route.timeFor(direction) != null ? ' · leaves ${clock12(route.timeFor(direction))}' : ''}',
            style: const TextStyle(color: Colors.white70, fontSize: 16, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 20),
          const Text('WHICH TRIP?', style: TextStyle(color: Colors.white60, fontSize: 14, fontWeight: FontWeight.w800, letterSpacing: 1.6)),
          const SizedBox(height: 10),
          DirectionSelector(value: direction, onChanged: onDirection, route: route),
        ],
      ]),
    );
  }
}

class _BusChoice extends StatelessWidget {
  const _BusChoice({required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        constraints: const BoxConstraints(minHeight: Ui.touch, minWidth: 96),
        padding: const EdgeInsets.symmetric(horizontal: 20),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? scheme.primary : scheme.surface,
          borderRadius: BorderRadius.circular(Ui.radiusSmall),
          border: Border.all(color: selected ? scheme.primary : scheme.outlineVariant, width: 2),
        ),
        child: Text(label, style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900, color: selected ? scheme.onPrimary : scheme.onSurface)),
      ),
    );
  }
}


/// Horizontal list of stops in travel order: 1 Start · 2 ... · last (flag).
class _StopStrip extends StatelessWidget {
  const _StopStrip({required this.stops});
  final List<StopInfo> stops;

  @override
  Widget build(BuildContext context) {
    if (stops.isEmpty) return const SizedBox.shrink();
    final hint = Theme.of(context).hintColor;
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: stops.length,
        separatorBuilder: (_, __) => Icon(Icons.chevron_right_rounded, color: hint),
        itemBuilder: (context, i) {
          final last = i == stops.length - 1;
          return Container(
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: last ? BrandColors.amber : Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: last ? BrandColors.amber : Theme.of(context).colorScheme.outlineVariant),
            ),
            child: Text('${i + 1}. ${stops[i].name}',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: last ? BrandColors.ink : null)),
          );
        },
      ),
    );
  }
}
