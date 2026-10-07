/// Where the app finds the BusMate backend.
///
/// Default: the online backend on Render, so the app works on any network (mobile data too).
/// If your Render address is different, change [productionApiUrl] once, or override when building:
///   flutter run --dart-define=API_URL=http://192.168.1.7:4000   (laptop backend on the same Wi-Fi)
///   flutter build apk --release                                    (uses productionApiUrl)
class AppConfig {
  static const String productionApiUrl = 'https://busmate-api.onrender.com';
  static const String apiUrl = String.fromEnvironment('API_URL', defaultValue: productionApiUrl);

  /// How often the phone reports its position during a trip.
  static const Duration locationInterval = Duration(seconds: 5);

  /// No GPS fix for this long => "GPS Unavailable".
  static const Duration gpsStaleAfter = Duration(seconds: 20);

  /// No server acknowledgement for this long => "Network Unstable".
  static const Duration ackStaleAfter = Duration(seconds: 15);
}
