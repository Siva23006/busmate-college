import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Light (white) theme by default; the student can switch to dark and the choice is
/// remembered on the phone.
class ThemeController extends ChangeNotifier {
  static const _key = 'busmate_student_theme';
  final _storage = const FlutterSecureStorage(aOptions: AndroidOptions(encryptedSharedPreferences: true));

  ThemeMode mode = ThemeMode.light;
  bool get isDark => mode == ThemeMode.dark;

  Future<void> load() async {
    try {
      if (await _storage.read(key: _key) == 'dark') {
        mode = ThemeMode.dark;
        notifyListeners();
      }
    } catch (_) {
      // keep the default
    }
  }

  void setDark(bool dark) {
    final next = dark ? ThemeMode.dark : ThemeMode.light;
    if (next == mode) return;
    mode = next;
    notifyListeners();
    _storage.write(key: _key, value: dark ? 'dark' : 'light').catchError((_) {});
  }

  void toggle() => setDark(!isDark);
}
