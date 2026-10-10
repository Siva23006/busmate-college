import 'package:flutter/foundation.dart';

import '../core/api_client.dart';
import '../services/push_service.dart';
import '../models/models.dart';
import '../services/token_storage.dart';

enum SessionState { unknown, loggedOut, loggedIn }

/// Login state for the student. Shares one ApiClient with the rest of the app.
class SessionProvider extends ChangeNotifier {
  SessionProvider() {
    api = ApiClient(onUnauthorized: () => logout(expired: true));
  }

  late final ApiClient api;
  final _storage = TokenStorage();
  SessionState state = SessionState.unknown;
  AppUser? user;
  String? message; // e.g. "Your session has expired"

  String? get token => api.token;

  Future<void> restore() async {
    final token = await _storage.read();
    if (token == null) {
      state = SessionState.loggedOut;
      notifyListeners();
      return;
    }
    api.token = token;
    try {
      final res = await api.get('/auth/me');
      final u = AppUser.fromJson(res['user'] as Map<String, dynamic>);
      if (u.role != 'STUDENT') throw ApiException('Not a student account', status: 403);
      user = u;
      state = SessionState.loggedIn;
    } on ApiException catch (e) {
      if (e.code == 'NETWORK' || e.code == 'TIMEOUT') {
        // Offline at launch: keep the saved login so the student is not locked out.
        state = SessionState.loggedIn;
        message = 'Offline. Some information may be out of date.';
      } else {
        await _storage.clear();
        api.token = null;
        state = SessionState.loggedOut;
      }
    }
    notifyListeners();
  }

  Future<void> login(String identifier, String password) async {
    final res = await api.post('/auth/login', {'identifier': identifier.trim(), 'password': password});
    final u = AppUser.fromJson(res['user'] as Map<String, dynamic>);
    if (u.role != 'STUDENT') {
      throw ApiException('This app is for students. Drivers should use the BusMate Driver app.');
    }
    api.token = res['token'] as String;
    await _storage.write(api.token!);
    user = u;
    message = null;
    state = SessionState.loggedIn;
    notifyListeners();
  }

  Future<void> logout({bool expired = false}) async {
    await PushService.unregister();
    await _storage.clear();
    api.token = null;
    user = null;
    message = expired ? 'Your session has expired. Please log in again.' : null;
    state = SessionState.loggedOut;
    notifyListeners();
  }
}
