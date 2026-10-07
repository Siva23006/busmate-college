/// Where the app finds the BusMate backend.
///
/// Default: the online backend on Render, so the app works on any network (mobile data too).
/// If your Render address is different, change [productionApiUrl] once, or override when building:
///   flutter run --dart-define=API_URL=http://192.168.1.7:4000   (laptop backend on the same Wi-Fi)
///   flutter build apk --release                                    (uses productionApiUrl)
class AppConfig {
  static const String productionApiUrl = 'https://busmate-api.onrender.com';
  static const String apiUrl = String.fromEnvironment('API_URL', defaultValue: productionApiUrl);

  /// Status shows "Updating" (yellow) after this long without a location, then "Offline" (red).
  static const Duration updatingAfter = Duration(seconds: 20);
  static const Duration offlineAfter = Duration(seconds: 60);
}
