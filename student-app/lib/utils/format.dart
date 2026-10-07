String two(int n) => n.toString().padLeft(2, '0');

String clockTime(DateTime? t) {
  if (t == null) return '-';
  final h = t.hour % 12 == 0 ? 12 : t.hour % 12;
  return '$h:${two(t.minute)} ${t.hour < 12 ? 'AM' : 'PM'}';
}

String etaText(int? seconds) {
  if (seconds == null) return '-';
  final m = (seconds / 60).round();
  if (m < 1) return '< 1 min';
  if (m < 60) return '$m min';
  return '${m ~/ 60} h ${m % 60} min';
}

String distanceText(num? meters) {
  if (meters == null) return '-';
  return meters < 1000 ? '${meters.round()} m' : '${(meters / 1000).toStringAsFixed(1)} km';
}

String agoText(DateTime? t) {
  if (t == null) return 'never';
  final s = DateTime.now().difference(t).inSeconds;
  if (s < 5) return 'just now';
  if (s < 60) return '${s}s ago';
  if (s < 3600) return '${(s / 60).floor()} min ago';
  return clockTime(t);
}

String greeting() {
  final h = DateTime.now().hour;
  return h < 12 ? 'Good morning' : (h < 17 ? 'Good afternoon' : 'Good evening');
}

/// "07:30" -> "7:30 AM".
String clock12(String? hhmm) {
  if (hhmm == null) return '-';
  final parts = hhmm.split(':');
  final h = int.tryParse(parts[0]);
  if (h == null || parts.length < 2) return hhmm;
  final h12 = h % 12 == 0 ? 12 : h % 12;
  return '$h12:${parts[1]} ${h < 12 ? 'AM' : 'PM'}';
}
