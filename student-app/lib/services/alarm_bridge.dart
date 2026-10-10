import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Talks to the Android side (MainActivity "busmate/alarm") for the full-screen bus alarm.
class AlarmBridge {
  static const _ch = MethodChannel('busmate/alarm');

  static bool get supported => !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

  /// Whether Android lets the app show the alarm over the lock screen (Android 14+ asks the user).
  static Future<bool> canFullScreen() async {
    if (!supported) return false;
    try {
      return await _ch.invokeMethod<bool>('canFullScreen') ?? true;
    } catch (_) {
      return true;
    }
  }

  /// Opens the Android page where the student allows full-screen alerts.
  static Future<void> openFullScreenSettings() async {
    if (!supported) return;
    try {
      await _ch.invokeMethod('openFullScreenSettings');
    } catch (_) {}
  }

  /// Rings a test alarm after [delaySeconds] (time to lock the screen).
  static Future<bool> test({int delaySeconds = 0}) async {
    if (!supported) return false;
    try {
      return await _ch.invokeMethod<bool>('test', {'delaySeconds': delaySeconds}) ?? false;
    } catch (_) {
      return false;
    }
  }
}
