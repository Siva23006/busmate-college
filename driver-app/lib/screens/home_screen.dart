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
import '../widgets/trip_actions.dart';
import 'start_trip_screen.dart';
import 'tabs/profile_tab.dart';
import 'tabs/route_tab.dart';
import 'tabs/trips_tab.dart';

/// Pre-trip shell: Home · Route · Trips · Profile.
/// The chosen bus and run (morning / evening) are kept here so every tab shows the same one.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tab = 0;
  int? _selectedBusId;
  // Morning run before noon, evening run after; the driver can change it.
  String _direction = directionForTime(DateTime.now());

  @override
  void initState() {
    super.initState();
    // After the first frame: loading notifies listeners, which must not happen during build.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<TripProvider>().loadHome();
    });
  }

  void _setDirection(String d) => setState(() => _direction = d);

  @override
  Widget build(BuildContext context) {
    final trips = context.watch<TripProvider>();
    final buses = trips.home?.buses ?? const <BusInfo>[];
    final bus = buses.isEmpty ? null : buses.firstWhere((b) => b.id == _selectedBusId, orElse: () => buses.first);

    final Widget page = switch (_tab) {
      1 => RouteTab(bus: bus, direction: _direction, onDirection: _setDirection),
      2 => const TripsTab(),
      3 => ProfileTab(buses: buses),
      _ => _HomeTab(
          bus: bus,
          buses: buses,
          direction: _direction,
          onDirection: _setDirection,
          onBus: (id) => setState(() => _selectedBusId = id),
        ),
    };

    return PopScope(
      canPop: _tab == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) setState(() => _tab = 0); // back from another tab returns to Home
      },
      child: Scaffold(
        body: SafeArea(
          bottom: false,
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 260),
            switchInCurve: Curves.easeOutCubic,
            switchOutCurve: Curves.easeIn,
            transitionBuilder: (child, a) => FadeTransition(
              opacity: a,
              child: SlideTransition(position: Tween<Offset>(begin: const Offset(0, 0.015), end: Offset.zero).animate(a), child: child),
            ),
            child: KeyedSubtree(key: ValueKey(_tab), child: page),
          ),
        ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: _tab,
          onDestinationSelected: (i) => setState(() => _tab = i),
          destinations: const [
            NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home_rounded), label: 'Home'),
            NavigationDestination(icon: Icon(Icons.route_outlined), selectedIcon: Icon(Icons.route_rounded), label: 'Route'),
            NavigationDestination(icon: Icon(Icons.history_rounded), selectedIcon: Icon(Icons.history), label: 'Trips'),
            NavigationDestination(icon: Icon(Icons.person_outline_rounded), selectedIcon: Icon(Icons.person_rounded), label: 'Profile'),
          ],
        ),
      ),
    );
  }
}

/// Home: your bus, which run, pre-trip checklist and START TRIP.
class _HomeTab extends StatefulWidget {
  const _HomeTab({required this.bus, required this.buses, required this.direction, required this.onDirection, required this.onBus});
  final BusInfo? bus;
  final List<BusInfo> buses;
  final String direction;
  final ValueChanged<String> onDirection;
  final ValueChanged<int> onBus;

  @override
  State<_HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<_HomeTab> with WidgetsBindingObserver {
  bool? _locationOn; // null while checking
  LocationPermission? _permission; // null while checking
  bool _online = true;
  StreamSubscription<List<ConnectivityResult>>? _connSub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
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

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _connSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final trips = context.watch<TripProvider>();
    final home = trips.home;
    final bus = widget.bus;
    final buses = widget.buses;
    final direction = widget.direction;
    final hint = context.hint;
    final name = home?.name ?? context.watch<SessionProvider>().user?.name ?? 'Driver';
    final canStart = bus != null && bus.route != null && bus.status != 'MAINTENANCE';

    // Readiness checklist: green = ready, amber = needs a tap / still checking, red = blocked.
    final permission = _permission;
    final permissionOk = permission == LocationPermission.always || permission == LocationPermission.whileInUse;
    final (gpsValue, gpsLevel) = switch (_locationOn) {
      null => ('Checking', Level.warn),
      true => ('Ready', Level.good),
      false => ('Turned off', Level.bad),
    };
    final (netValue, netLevel) = !_online
        ? ('Offline', Level.bad)
        : trips.error == null
            ? ('Ready', Level.good)
            : ('Unstable', Level.warn);
    final (permValue, permLevel) = permission == null
        ? ('Checking', Level.warn)
        : permissionOk
            ? ('Ready', Level.good)
            : permission == LocationPermission.deniedForever
                ? ('Blocked', Level.bad)
                : ('Not allowed', Level.warn);
    final readyCount = [gpsLevel, netLevel, permLevel].where((l) => l == Level.good).length;
    final allReady = readyCount == 3;

    var step = 0;
    Widget item(Widget child) => FadeSlideIn(delay: FadeSlideIn.stagger(step++, stepMs: 70), child: child);

    return RefreshIndicator(
      color: BrandColors.amber,
      onRefresh: () async {
        await trips.loadHome();
        await _checkGps();
      },
      child: ListView(padding: const EdgeInsets.fromLTRB(Ui.pad, 6, Ui.pad, 28), children: [
        // Top bar
        Row(children: [
          const LogoTile(size: 36),
          const SizedBox(width: 10),
          const Text('BUSMATE', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, letterSpacing: 2.2)),
          const Spacer(),
          // Emergencies outside a trip too (tap opens a sheet; sending needs a hold).
          SosButton(size: 44, busId: bus?.id),
          const SizedBox(width: 4),
          const ThemeToggleButton(),
          IconButton(tooltip: 'Log out', icon: const Icon(Icons.logout_rounded), onPressed: () => confirmLogout(context)),
        ]),
        const SizedBox(height: 14),
        item(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Hello, $name', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 2),
          Text(home == null ? 'Driver' : 'Driver ID ${home.employeeId}', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: hint)),
        ])),
        const SizedBox(height: 16),
        if (trips.error != null) ...[ErrorBanner(trips.error!, onRetry: trips.loadHome), const SizedBox(height: Ui.gap)],
        if (trips.loading && home == null) const Padding(padding: EdgeInsets.all(48), child: Center(child: CircularProgressIndicator())),
        if (home != null && buses.isEmpty)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Row(children: [
                const IconTile(icon: Icons.info_outline_rounded, color: BrandColors.yellow),
                const SizedBox(width: 12),
                Expanded(
                  child: Text('No bus is assigned to you yet. Please contact the transport office.',
                      style: TextStyle(fontSize: 14, color: Theme.of(context).colorScheme.onSurface)),
                ),
              ]),
            ),
          ),
        if (buses.length > 1) ...[
          const SectionLabel('Select bus'),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final b in buses)
              ChoiceChip(
                label: Text(b.number, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                selected: b.id == bus?.id,
                showCheckmark: false,
                selectedColor: BrandColors.amber.withValues(alpha: 0.3),
                materialTapTargetSize: MaterialTapTargetSize.padded,
                onSelected: (_) => widget.onBus(b.id),
              ),
          ]),
          const SizedBox(height: 16),
        ],
        if (bus != null) ...[
          item(_BusCard(bus: bus, direction: direction)),
          if (bus.route != null) ...[
            const SizedBox(height: 20),
            item(Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              const SectionLabel('Select Trip'),
              DirectionSelector(value: direction, onChanged: widget.onDirection, route: bus.route),
            ])),
          ],
          const SizedBox(height: 20),
          item(Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            SectionLabel(
              'Pre-Trip Checklist',
              trailing: AnimatedSwitcher(
                duration: const Duration(milliseconds: 250),
                child: Pill(
                  key: ValueKey(readyCount),
                  label: '$readyCount/3 Ready',
                  color: allReady ? BrandColors.green : BrandColors.yellow,
                  icon: allReady ? Icons.check_rounded : Icons.schedule_rounded,
                ),
              ),
            ),
            Card(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                child: Column(children: [
                  ChecklistRow(
                    icon: Icons.gps_fixed_rounded,
                    label: 'GPS Ready',
                    value: gpsValue,
                    level: gpsLevel,
                    action: 'Tap to turn on Location',
                    onTap: _locationOn == false ? _fixLocation : null,
                  ),
                  const Divider(),
                  ChecklistRow(icon: Icons.wifi_rounded, label: 'Network Connected', value: netValue, level: netLevel),
                  const Divider(),
                  ChecklistRow(
                    icon: Icons.location_on_rounded,
                    label: 'Location Permission',
                    value: permValue,
                    level: permLevel,
                    action: permission == LocationPermission.deniedForever ? 'Tap to open app settings' : 'Tap to allow',
                    onTap: permission != null && !permissionOk ? _fixPermission : null,
                  ),
                ]),
              ),
            ),
          ])),
          const SizedBox(height: 20),
          item(Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: BrandColors.green,
                foregroundColor: Colors.white,
                disabledBackgroundColor: BrandColors.green.withValues(alpha: 0.3),
                disabledForegroundColor: Colors.white70,
                textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, letterSpacing: 1.2),
              ),
              onPressed: canStart
                  ? () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => StartTripScreen(bus: bus, direction: direction)))
                  : null,
              icon: const Icon(Icons.play_arrow_rounded, size: 24),
              label: const Text('START TRIP'),
            ),
            const SizedBox(height: 10),
            Text(
              bus.route == null
                  ? 'This bus has no route yet. Contact the transport office.'
                  : bus.status == 'MAINTENANCE'
                      ? 'This bus is marked as under maintenance.'
                      : allReady
                          ? 'All set. You will confirm the trip on the next screen.'
                          : 'Fix the items above. You will be asked again when you start.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: hint),
            ),
          ])),
        ],
      ]),
    );
  }
}

/// "YOUR BUS" card: status, bus number, where this run goes and when.
class _BusCard extends StatelessWidget {
  const _BusCard({required this.bus, required this.direction});
  final BusInfo bus;
  final String direction;

  @override
  Widget build(BuildContext context) {
    final route = bus.route;
    final hint = context.hint;
    final (statusText, statusColor) = bus.status == 'MAINTENANCE'
        ? ('Maintenance', BrandColors.red)
        : route == null
            ? ('No route', BrandColors.yellow)
            : ('Active', BrandColors.green);
    final time = route?.timeFor(direction);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Stack(children: [
        Positioned.fill(child: RoutePattern(color: BrandColors.amber.withValues(alpha: context.isDarkTheme ? 0.10 : 0.16))),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Text('YOUR BUS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.2, color: hint)),
              const Spacer(),
              if (bus.isDemo) ...[const DemoTag(), const SizedBox(width: 6)],
              Pill(label: statusText, color: statusColor, dot: true),
            ]),
            const SizedBox(height: 6),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(bus.number, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, letterSpacing: 0.4, height: 1.15)),
            ),
            const SizedBox(height: 8),
            if (route == null)
              Text('No route assigned', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: hint))
            else
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 300),
                transitionBuilder: (child, a) => FadeTransition(
                  opacity: a,
                  child: SlideTransition(position: Tween<Offset>(begin: const Offset(0.04, 0), end: Offset.zero).animate(a), child: child),
                ),
                layoutBuilder: (current, previous) => Stack(alignment: Alignment.topLeft, children: [...previous, if (current != null) current]),
                child: Column(key: ValueKey(direction), crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(
                    '${(route.startFor(direction) ?? 'Start').toUpperCase()}  →  ${(route.destinationFor(direction) ?? 'College').toUpperCase()}',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, letterSpacing: 0.3, color: context.amberText),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${route.name} · ${route.stops.length} stops · ${directionTrip(direction)}${time != null ? ' (${clock12(time)})' : ''}',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: hint),
                  ),
                ]),
              ),
          ]),
        ),
      ]),
    );
  }
}
