import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Stores the login token in Android Keystore-backed encrypted storage.
class TokenStorage {
  static const _key = 'busmate_driver_token';
  final _storage = const FlutterSecureStorage(aOptions: AndroidOptions(encryptedSharedPreferences: true));

  Future<String?> read() async {
    try {
      return await _storage.read(key: _key);
    } catch (_) {
      return null;
    }
  }

  Future<void> write(String token) => _storage.write(key: _key, value: token);
  Future<void> clear() => _storage.delete(key: _key);
}
