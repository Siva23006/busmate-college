import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../theme/app_theme.dart';

Future<BitmapDescriptor> _toIcon(ui.PictureRecorder recorder, double size, double width) async {
  final image = await recorder.endRecording().toImage(size.toInt(), size.toInt());
  final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
  return BitmapDescriptor.bytes(bytes!.buffer.asUint8List(), width: width);
}

/// Bus marker: ink circle with an amber arrow pointing up (the marker is rotated to the heading).
Future<BitmapDescriptor> buildBusIcon({double size = 112}) {
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
  return _toIcon(recorder, size, size / 2.5);
}

/// Stop marker: numbered dot. The student's own stop is larger and amber.
Future<BitmapDescriptor> buildStopIcon(int order, {required bool mine, double size = 96}) {
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  final c = Offset(size / 2, size / 2);
  canvas.drawCircle(c, size * 0.47, Paint()..color = Colors.black.withValues(alpha: 0.18));
  canvas.drawCircle(c, size * 0.44, Paint()..color = Colors.white);
  canvas.drawCircle(c, size * 0.36, Paint()..color = mine ? BrandColors.amber : BrandColors.ink3);
  final text = TextPainter(
    text: TextSpan(
      text: '$order',
      style: TextStyle(color: mine ? BrandColors.ink : Colors.white, fontSize: size * (order > 9 ? 0.36 : 0.42), fontWeight: FontWeight.w900),
    ),
    textDirection: TextDirection.ltr,
  )..layout();
  text.paint(canvas, Offset(c.dx - text.width / 2, c.dy - text.height / 2));
  return _toIcon(recorder, size, mine ? 36 : 28);
}
