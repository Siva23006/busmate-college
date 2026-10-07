import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../models/models.dart';
import '../theme/app_theme.dart';

/// Look-only Google map for the active trip: the route line, its stops and the bus.
/// It follows the bus; the driver never has to touch it. Use a `GlobalKey<TripMapState>` to call
/// [TripMapState.recenter] / [TripMapState.showWholeRoute] from buttons drawn over the map.
class TripMap extends StatefulWidget {
  const TripMap({
    super.key,
    required this.route,
    required this.direction,
    this.position,
    this.heading,
    this.height = 200,
    this.radius = Ui.radius,
    this.start,
    this.preview = false,
    this.waitingText = 'Searching for GPS…',
    this.badgeBottom = 12,
  });
  final double radius;

  /// Where this trip started (first GPS fix): drawn as a green START pin.
  final LatLng? start;

  /// Home-screen preview: shows the phone's own blue dot and no GPS badge.
  final bool preview;

  /// Text of the badge shown while there is no GPS fix yet (trip screen only).
  final String waitingText;

  /// Distance of that badge from the bottom of the map (so it is not hidden under panels).
  final double badgeBottom;
  final RouteInfo? route;
  final String direction;
  final LatLng? position;

  /// Degrees clockwise from north, or null when unknown.
  final double? heading;
  final double height;

  @override
  State<TripMap> createState() => TripMapState();
}

class TripMapState extends State<TripMap> {
  static const _followZoom = 15.0;
  GoogleMapController? _map;

  /// False after "show whole route" until the driver taps recenter, so new fixes do not zoom back in.
  bool _follow = true;
  BitmapDescriptor? _busIcon;
  BitmapDescriptor? _stopIcon;
  BitmapDescriptor? _endIcon;
  BitmapDescriptor? _startIcon;

  @override
  void initState() {
    super.initState();
    Future.wait([_busDot(), _dot(BrandColors.ink3, 22), _dot(BrandColors.amber, 28), _startFlag()]).then((icons) {
      if (!mounted) return;
      setState(() {
        _busIcon = icons[0];
        _stopIcon = icons[1];
        _endIcon = icons[2];
        _startIcon = icons[3];
      });
    }).catchError((_) {});
  }

  /// Road line saved by the backend (routes.path); straight lines between stops if there is none.
  List<LatLng> get _line {
    final r = widget.route;
    if (r == null) return const [];
    final path = r.path;
    if (path != null && path.length >= 2) return [for (final p in path) LatLng(p[0], p[1])];
    return [for (final s in r.stops) LatLng(s.latitude, s.longitude)];
  }

  @override
  void didUpdateWidget(TripMap old) {
    super.didUpdateWidget(old);
    final p = widget.position;
    // Camera moves only when a new fix arrives (never on a timer).
    if (_follow && p != null && p != old.position) _map?.animateCamera(CameraUpdate.newLatLngZoom(p, _followZoom));
  }

  /// Centre on the bus again and keep following it.
  void recenter() {
    _follow = true;
    final p = widget.position;
    if (p != null) _map?.animateCamera(CameraUpdate.newLatLngZoom(p, _followZoom));
  }

  /// Zoom out to the whole route (and the bus); stops following until [recenter].
  void showWholeRoute() {
    final c = _map;
    final bounds = _bounds([..._line, if (widget.position != null) widget.position!]);
    if (c == null || bounds == null) return;
    _follow = false;
    c.animateCamera(CameraUpdate.newLatLngBounds(bounds, 48));
  }

  static LatLngBounds? _bounds(List<LatLng> points) {
    if (points.length < 2) return null;
    double minLat = points.first.latitude, maxLat = minLat, minLng = points.first.longitude, maxLng = minLng;
    for (final p in points) {
      minLat = math.min(minLat, p.latitude);
      maxLat = math.max(maxLat, p.latitude);
      minLng = math.min(minLng, p.longitude);
      maxLng = math.max(maxLng, p.longitude);
    }
    if (minLat == maxLat && minLng == maxLng) return null;
    return LatLngBounds(southwest: LatLng(minLat, minLng), northeast: LatLng(maxLat, maxLng));
  }

  void _onCreated(GoogleMapController c) {
    _map = c;
    if (widget.position != null) return;
    // No GPS fix yet: show the whole route.
    final bounds = _bounds(_line);
    if (bounds != null) c.moveCamera(CameraUpdate.newLatLngBounds(bounds, 28));
  }

  @override
  Widget build(BuildContext context) {
    final line = _line;
    final stops = widget.route?.stopsFor(widget.direction) ?? const <StopInfo>[];
    final p = widget.position;
    final initial = p ?? (line.isNotEmpty ? line.first : const LatLng(13.0827, 80.2707));

    final markers = <Marker>{
      if (_stopIcon != null && _endIcon != null)
        for (var i = 0; i < stops.length; i++)
          Marker(
            markerId: MarkerId('stop_${stops[i].id}'),
            position: LatLng(stops[i].latitude, stops[i].longitude),
            icon: i == stops.length - 1 ? _endIcon! : _stopIcon!, // amber = where this trip ends
            anchor: const Offset(0.5, 0.5),
            zIndexInt: i == stops.length - 1 ? 2 : 1,
          ),
      if (widget.start != null)
        Marker(
          markerId: const MarkerId('start'),
          position: widget.start!,
          icon: _startIcon ?? BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
          anchor: _startIcon != null ? const Offset(0.5, 0.5) : const Offset(0.5, 1),
          zIndexInt: 5,
          infoWindow: const InfoWindow(title: 'Trip started here'),
        ),
      if (p != null)
        Marker(
          markerId: const MarkerId('bus'),
          position: p,
          icon: _busIcon ?? BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueYellow),
          rotation: widget.heading ?? 0,
          flat: _busIcon != null,
          anchor: _busIcon != null ? const Offset(0.5, 0.5) : const Offset(0.5, 1),
          zIndexInt: 10,
        ),
    };

    return ClipRRect(
      borderRadius: BorderRadius.circular(widget.radius),
      child: SizedBox(
        height: widget.height,
        child: Stack(children: [
          // Look-only: touches pass through so the page still scrolls over the map.
          IgnorePointer(
            child: GoogleMap(
              initialCameraPosition: CameraPosition(target: initial, zoom: p != null ? _followZoom : 13),
              markers: markers,
              polylines: {
                if (line.length >= 2) Polyline(polylineId: const PolylineId('route'), points: line, color: BrandColors.amber, width: 6),
              },
              onMapCreated: _onCreated,
              // The phone's own blue dot: visible even before the first GPS point reaches the server.
              myLocationEnabled: widget.preview || p == null,
              scrollGesturesEnabled: false,
              zoomGesturesEnabled: false,
              rotateGesturesEnabled: false,
              tiltGesturesEnabled: false,
              zoomControlsEnabled: false,
              myLocationButtonEnabled: false,
              mapToolbarEnabled: false,
              compassEnabled: false,
            ),
          ),
          if (p == null && !widget.preview)
            Positioned(
              left: 12,
              right: 12,
              bottom: widget.badgeBottom,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(color: BrandColors.ink.withValues(alpha: 0.9), borderRadius: BorderRadius.circular(14)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: BrandColors.amber)),
                    const SizedBox(width: 8),
                    Flexible(child: Text(widget.waitingText, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600))),
                  ]),
                ),
              ),
            ),
        ]),
      ),
    );
  }
}

Future<BitmapDescriptor> _finish(ui.PictureRecorder recorder, double size, double width) async {
  final image = await recorder.endRecording().toImage(size.toInt(), size.toInt());
  final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
  return BitmapDescriptor.bytes(bytes!.buffer.asUint8List(), width: width);
}

/// White-ringed dot for a stop.
Future<BitmapDescriptor> _dot(Color color, double width, {double size = 64}) {
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  final c = Offset(size / 2, size / 2);
  canvas.drawCircle(c, size * 0.46, Paint()..color = Colors.white);
  canvas.drawCircle(c, size * 0.32, Paint()..color = color);
  return _finish(recorder, size, width);
}

/// START pin: green circle with a white flag-like square.
Future<BitmapDescriptor> _startFlag({double size = 88}) {
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  final c = Offset(size / 2, size / 2);
  canvas.drawCircle(c, size * 0.46, Paint()..color = Colors.white);
  canvas.drawCircle(c, size * 0.36, Paint()..color = BrandColors.green);
  final flag = Path()
    ..moveTo(c.dx - size * 0.10, c.dy - size * 0.20)
    ..lineTo(c.dx + size * 0.18, c.dy - size * 0.10)
    ..lineTo(c.dx - size * 0.10, c.dy)
    ..close();
  canvas.drawPath(flag, Paint()..color = Colors.white);
  canvas.drawRect(Rect.fromLTWH(c.dx - size * 0.13, c.dy - size * 0.22, size * 0.04, size * 0.42), Paint()..color = Colors.white);
  return _finish(recorder, size, 36);
}

/// Bus marker: ink circle with an amber arrow pointing up (the marker is rotated to the heading).
Future<BitmapDescriptor> _busDot({double size = 112}) {
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  final c = Offset(size / 2, size / 2);
  canvas.drawCircle(c, size * 0.46, Paint()..color = Colors.black.withValues(alpha: 0.18));
  canvas.drawCircle(c, size * 0.42, Paint()..color = Colors.white);
  canvas.drawCircle(c, size * 0.36, Paint()..color = BrandColors.ink);
  final arrow = Path()
    ..moveTo(c.dx, c.dy - size * 0.24)
    ..lineTo(c.dx + size * 0.16, c.dy + size * 0.18)
    ..lineTo(c.dx, c.dy + size * 0.08)
    ..lineTo(c.dx - size * 0.16, c.dy + size * 0.18)
    ..close();
  canvas.drawPath(arrow, Paint()..color = BrandColors.amber);
  return _finish(recorder, size, 46);
}
