String two(int n) => n.toString().padLeft(2, '0');

String clockTime(DateTime? t) {
  if (t == null) return '-';
  final h = t.hour % 12 == 0 ? 12 : t.hour % 12;
  return '$h:${two(t.minute)} ${t.hour < 12 ? 'AM' : 'PM'}';
}

String durationText(Duration d) {
  final h = d.inHours;
  final m = d.inMinutes % 60;
  final s = d.inSeconds % 60;
  return h > 0 ? '$h:${two(m)}:${two(s)}' : '${two(m)}:${two(s)}';
}

String distanceText(double? meters) {
  if (meters == null) return '-';
  return meters < 1000 ? '${meters.round()} m' : '${(meters / 1000).toStringAsFixed(1)} km';
}

String agoText(DateTime? t) {
  if (t == null) return 'never';
  final s = DateTime.now().difference(t).inSeconds;
  if (s < 5) return 'just now';
  if (s < 60) return '${s}s ago';
  return '${(s / 60).floor()} min ago';
}

/// Elapsed time as "00:12:36".
String clockDuration(Duration d) => '${two(d.inHours)}:${two(d.inMinutes % 60)}:${two(d.inSeconds % 60)}';

/// "Tue, 7 Oct".
String dayText(DateTime? t) {
  if (t == null) return '-';
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return '${days[t.weekday - 1]}, ${t.day} ${months[t.month - 1]}';
}

/// "5 mins", "1 min", "now".
String minutesText(int seconds) {
  final m = (seconds / 60).round();
  if (m < 1) return 'now';
  return m == 1 ? '1 min' : '$m mins';
}

/// Short duration: "1 h 05 m" / "42 min".
String shortDuration(Duration d) {
  if (d.inMinutes < 60) return '${d.inMinutes} min';
  return '${d.inHours} h ${two(d.inMinutes % 60)} m';
}
