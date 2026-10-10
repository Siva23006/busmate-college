import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../core/api_client.dart';

/// Phone notifications (Firebase Cloud Messaging).
///
/// The server sends "bus started", "bus arriving in ~10 min" and "bus at your stop" as push
/// notifications. Android shows them in the notification bar with sound even when the app is
/// closed, as long as the phone has internet. Inside the app the same alerts also appear as a banner.
///
/// Needs android/app/google-services.json from the Firebase console. Without it the app still
/// works; only the closed-app notifications are off.
class PushService {
  static bool _ready = false;
  static StreamSubscription<String>? _refreshSub;

  /// Call once at startup (before runApp).
  static Future<void> init() async {
    try {
      await Firebase.initializeApp();
      _ready = true;
    } catch (e) {
      debugPrint('[push] Firebase not configured (add google-services.json): $e');
    }
  }

  /// After login: ask permission, then give this phone's push address to the server.
  static Future<void> register(ApiClient api) async {
    if (!_ready) return;
    try {
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission(alert: true, badge: true, sound: true);
      final token = await messaging.getToken();
      if (token != null) await api.put('/me/fcm-token', {'token': token});
      await _refreshSub?.cancel();
      _refreshSub = messaging.onTokenRefresh.listen((t) {
        api.put('/me/fcm-token', {'token': t}).catchError((Object _) => <String, dynamic>{});
      });
    } catch (e) {
      debugPrint('[push] register failed: $e');
    }
  }

  /// On logout: this phone stops receiving the old student's alerts.
  static Future<void> unregister() async {
    if (!_ready) return;
    try {
      await _refreshSub?.cancel();
      _refreshSub = null;
      await FirebaseMessaging.instance.deleteToken();
    } catch (_) {}
  }
}
