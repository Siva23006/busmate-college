import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../providers/bus_provider.dart';
import '../theme/app_theme.dart';
import '../utils/map_icons.dart';

/// Live Google map of the student's bus: road route line, numbered stops (in travel order),
/// "my stop" circle, and a bus marker that glides smoothly between GPS points.
/// Used full-screen on Home (under the sheet) and on the Live map screen.
class BusMapView extends StatefulWidget {
  const BusMapView({super.key, this.bottomPadding = 0, this.topPadding = 0, this.controlsBottom = 16});

  /// Space covered by UI at the bottom (keeps Google logo and camera fits visible).
  final double bottomPadding;
  final double topPadding;

  /// Distance of the floating map buttons from the bottom edge.
  final double controlsBottom;

  @override
  State<BusMapView> createState() => _BusMapViewState();
}

class _BusMapViewState extends State<BusMapView> with SingleTickerProviderStateMixin {
  GoogleMapController? _map;
  BitmapDescriptor? _busIcon;
  final Map<String, BitmapDescriptor> _stopIcons = {};
  final Set<String> _stopIconsBuilding = {};
  late final AnimationController _anim;
  late final BusProvider _provider;
  LatLng? _from;
  LatLng? _to;
  LatLng? _shown;
  DateTime? _lastAnimatedFor;
  bool _followBus = true;
  bool _fitted = false;

  @override
  void initState() {
    super.initState();
    _provider = context.read<BusProvider>();
    _anim = AnimationController(vsync: this, duration: const Duration(milliseconds: 1500))
      ..addListener(() {
        if (_from == null || _to == null) return;
        final t = Curves.easeInOut.transform(_anim.value);
        setState(() => _shown = LatLng(
              _from!.latitude + (_to!.latitude - _from!.latitude) * t,
              _from!.longitude + (_to!.longitude - _from!.longitude) * t,
            ));
      });
    buildBusIcon().then((icon) {
      if (mounted) setState(() => _busIcon = icon);
    }).catchError((_) {});
    _provider.addListener(_onUpdate);
    _onUpdate();
  }

  static String _iconKey(StopInfo s, bool mine) => '${s.order}:$mine';

  void _ensureStopIcons() {
    for (final s in _provider.travelStops) {
      final mine = s.id == _provider.myStopId;
      final key = _iconKey(s, mine);
      if (_stopIcons.containsKey(key) || !_stopIconsBuilding.add(key)) continue;
      buildStopIcon(s.order, mine: mine).then((icon) {
        _stopIcons[key] = icon;
        if (mounted) setState(() {});
      }).catchError((_) {});
    }
  }

  void _onUpdate() {
    _ensureStopIcons();
    final loc = _provider.location;
    if (!_provider.hasActiveTrip) {
      if (_shown != null && mounted) setState(() => _shown = null);
      return;
    }
    if (loc == null || _lastAnimatedFor == loc.timestamp) return;
    _lastAnimatedFor = loc.timestamp;
    final target = LatLng(loc.latitude, loc.longitude);
    if (_shown == null) {
      if (mounted) setState(() => _shown = target);
    } else {
      _from = _shown;
      _to = target;
      _anim.forward(from: 0);
    }
    if (_followBus) _map?.animateCamera(CameraUpdate.newLatLng(target));
  }

  @override
  void dispose() {
    _provider.removeListener(_onUpdate);
    _anim.dispose();
    super.dispose();
  }

  /// Road line from the backend (routes.path), drawn in the trip's travel direction.
  List<LatLng> _routePoints(RouteInfo? r) {
    if (r == null) return const [];
    final pts = (r.path != null && r.path!.length >= 2)
        ? r.path!.map((p) => LatLng(p[0], p[1])).toList()
        : r.stops.map((s) => LatLng(s.latitude, s.longitude)).toList();
    return _provider.direction == fromCollege ? pts.reversed.toList() : pts;
  }

  Future<void> _fit(List<LatLng> pts) async {
    if (_map == null || pts.isEmpty) return;
    if (pts.length == 1) {
      await _map!.animateCamera(CameraUpdate.newLatLngZoom(pts.first, 15));
      return;
    }
    double minLat = pts.first.latitude, maxLat = minLat, minLng = pts.first.longitude, maxLng = minLng;
    for (final p in pts) {
      minLat = math.min(minLat, p.latitude);
      maxLat = math.max(maxLat, p.latitude);
      minLng = math.min(minLng, p.longitude);
      maxLng = math.max(maxLng, p.longitude);
    }
    if (minLat == maxLat && minLng == maxLng) return;
    await _map!.animateCamera(CameraUpdate.newLatLngBounds(
      LatLngBounds(southwest: LatLng(minLat, minLng), northeast: LatLng(maxLat, maxLng)),
      50,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<BusProvider>();
    final pts = _routePoints(p.route);
    final stops = p.travelStops;
    final myStop = stops.where((s) => s.id == p.myStopId).firstOrNull;
    final start = p.hasActiveTrip && p.tripStart != null ? LatLng(p.tripStart![0], p.tripStart![1]) : null;
    final nextStopId = p.eta?.nextStop?.stopId;

    // First time the route is known: show it all (unless the bus is already on the map).
    if (!_fitted && _map != null && pts.isNotEmpty && _shown == null) {
      _fitted = true;
      WidgetsBinding.instance.addPostFrameCallback((_) => _fit(pts));
    }

    final markers = <Marker>{
      for (final s in stops)
        () {
          final mine = s.id == p.myStopId;
          final icon = _stopIcons[_iconKey(s, mine)];
          return Marker(
            markerId: MarkerId('stop_${s.id}'),
            position: LatLng(s.latitude, s.longitude),
            icon: icon ?? BitmapDescriptor.defaultMarkerWithHue(mine ? BitmapDescriptor.hueOrange : BitmapDescriptor.hueAzure),
            anchor: icon != null ? const Offset(0.5, 0.5) : const Offset(0.5, 1),
            infoWindow: InfoWindow(
              title: '${s.order}. ${s.name}',
              snippet: mine ? 'Your stop' : (s.id == nextStopId ? 'Next stop' : null),
            ),
            zIndexInt: mine ? 3 : (s.id == nextStopId ? 2 : 1),
          );
        }(),
      if (start != null)
        Marker(
          markerId: const MarkerId('trip_start'),
          position: start,
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
          zIndexInt: 4,
          infoWindow: InfoWindow(title: 'Bus started here', snippet: p.route?.fromFor(p.direction)),
        ),
      if (_shown != null && p.hasActiveTrip)
        Marker(
          markerId: const MarkerId('bus'),
          position: _shown!,
          icon: _busIcon ?? BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueYellow),
          rotation: p.location?.heading ?? 0,
          flat: _busIcon != null,
          anchor: _busIcon != null ? const Offset(0.5, 0.5) : const Offset(0.5, 1),
          zIndexInt: 10,
          infoWindow: InfoWindow(title: p.bus?.number ?? 'Bus', snippet: p.isSimulation ? 'DEMO / SIMULATION' : null),
        ),
    };

    final initial = _shown ?? (pts.isNotEmpty ? pts.first : const LatLng(13.0827, 80.2707));

    return Stack(children: [
      GoogleMap(
        initialCameraPosition: CameraPosition(target: initial, zoom: 13),
        markers: markers,
        polylines: {
          if (pts.length >= 2) ...{
            // Soft outline under the route for contrast on any map style.
            Polyline(polylineId: const PolylineId('route_shadow'), points: pts, color: BrandColors.ink.withValues(alpha: 0.35), width: 10, zIndex: 1),
            Polyline(polylineId: const PolylineId('route'), points: pts, color: BrandColors.amber, width: 6, zIndex: 2),
          },
        },
        circles: {
          if (myStop != null)
            Circle(
              circleId: const CircleId('my_stop'),
              center: LatLng(myStop.latitude, myStop.longitude),
              radius: myStop.radius.toDouble(),
              strokeWidth: 2,
              strokeColor: BrandColors.amber,
              fillColor: BrandColors.amber.withValues(alpha: 0.15),
            ),
        },
        zoomControlsEnabled: false,
        myLocationButtonEnabled: false,
        compassEnabled: false,
        mapToolbarEnabled: false,
        padding: EdgeInsets.only(bottom: widget.bottomPadding, top: widget.topPadding),
        onMapCreated: (c) {
          _map = c;
          if (_shown != null) {
            c.moveCamera(CameraUpdate.newLatLngZoom(_shown!, 15));
          } else {
            _fitted = true;
            _fit(pts);
          }
        },
        onTap: (_) => setState(() => _followBus = false),
      ),
      Positioned(
        right: 12,
        bottom: widget.controlsBottom,
        child: Column(children: [
          _MapButton(
            icon: Icons.directions_bus_rounded,
            tooltip: 'Follow bus',
            active: _followBus && _shown != null,
            onTap: _shown == null
                ? null
                : () {
                    setState(() => _followBus = true);
                    _map?.animateCamera(CameraUpdate.newLatLngZoom(_shown!, 16));
                  },
          ),
          const SizedBox(height: 8),
          _MapButton(
            icon: Icons.person_pin_circle_rounded,
            tooltip: 'My stop',
            onTap: myStop == null
                ? null
                : () {
                    setState(() => _followBus = false);
                    _map?.animateCamera(CameraUpdate.newLatLngZoom(LatLng(myStop.latitude, myStop.longitude), 16));
                  },
          ),
          const SizedBox(height: 8),
          _MapButton(
            icon: Icons.route_rounded,
            tooltip: 'Whole route',
            onTap: () {
              setState(() => _followBus = false);
              _fit([...pts, if (_shown != null) _shown!]);
            },
          ),
        ]),
      ),
    ]);
  }
}

class _MapButton extends StatelessWidget {
  const _MapButton({required this.icon, required this.tooltip, this.onTap, this.active = false});
  final IconData icon;
  final String tooltip;
  final VoidCallback? onTap;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final pal = Palette.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), boxShadow: pal.floatShadow),
      child: Material(
        color: active ? BrandColors.amber : pal.card,
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(color: active ? BrandColors.amber : pal.line),
        ),
        child: SizedBox(
          width: 44,
          height: 44,
          child: IconButton(
            tooltip: tooltip,
            padding: EdgeInsets.zero,
            iconSize: 20,
            onPressed: onTap,
            icon: Icon(icon, color: active ? BrandColors.ink : (onTap == null ? pal.muted.withValues(alpha: 0.5) : pal.text)),
          ),
        ),
      ),
    );
  }
}
