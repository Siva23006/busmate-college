import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// BusMate brand: route-ink navy + school-bus amber. Large type for use in a vehicle.
class BrandColors {
  static const ink = Color(0xFF0C1322);
  static const ink2 = Color(0xFF141D31);
  static const ink3 = Color(0xFF1E2A44);
  static const amber = Color(0xFFF5B301);
  static const green = Color(0xFF16A34A);
  static const yellow = Color(0xFFD97706);
  static const red = Color(0xFFDC2626);

  /// Page background behind the cards.
  static const night = Color(0xFF070B14);
  static const paper = Color(0xFFF2F4F8);
}

/// Shared spacing, radii and touch-target sizes so every screen lines up.
class Ui {
  static const double gap = 16;
  static const double pad = 20;
  static const double radius = 24;
  static const double radiusSmall = 18;

  /// Smallest height of anything the driver taps (usable with a glance, in a moving vehicle).
  static const double touch = 64;
  static const double touchLarge = 76;
}

class AppTheme {
  static ThemeData _base(Brightness b) {
    final dark = b == Brightness.dark;
    final surface = dark ? BrandColors.ink2 : Colors.white;
    final outline = dark ? const Color(0xFF26334F) : const Color(0xFFE1E6EF);
    final text = dark ? const Color(0xFFF1F4FA) : const Color(0xFF0B1220);
    final scheme = ColorScheme.fromSeed(
      seedColor: BrandColors.amber,
      brightness: b,
      primary: dark ? BrandColors.amber : BrandColors.ink,
      onPrimary: dark ? BrandColors.ink : Colors.white,
      surface: surface,
      onSurface: text,
      outlineVariant: outline,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: dark ? BrandColors.night : BrandColors.paper,
      hintColor: dark ? const Color(0xFF9AA7C0) : const Color(0xFF55627A),
      dividerColor: outline,
      textTheme: Typography.material2021(platform: TargetPlatform.android).englishLike.apply(
            bodyColor: text,
            displayColor: text,
          ),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        foregroundColor: text,
        elevation: 0,
        scrolledUnderElevation: 0,
        toolbarHeight: 68,
        titleTextStyle: TextStyle(color: text, fontSize: 22, fontWeight: FontWeight.w800),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(Ui.radius),
          side: BorderSide(color: outline),
        ),
        margin: EdgeInsets.zero,
      ),
      dividerTheme: DividerThemeData(color: outline, thickness: 1, space: 1),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(minimumSize: const Size(56, 56), iconSize: 26),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(Ui.radiusSmall), borderSide: BorderSide(color: outline)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(Ui.radiusSmall), borderSide: BorderSide(color: outline)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 22),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(Ui.touchLarge),
          textStyle: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, letterSpacing: 1),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Ui.radius)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(Ui.touchLarge),
          foregroundColor: text,
          side: BorderSide(color: outline, width: 2),
          textStyle: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Ui.radius)),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          minimumSize: const Size(Ui.touch, Ui.touch),
          textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
        ),
      ),
      snackBarTheme: const SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        contentTextStyle: TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
      ),
    );
  }

  static ThemeData get light => _base(Brightness.light);
  static ThemeData get dark => _base(Brightness.dark);
}

/// Dark by default (easier on the eyes in a cab); the driver can switch to light and the
/// choice is remembered on the phone.
class ThemeController extends ChangeNotifier {
  static const _key = 'busmate_driver_theme';
  final _storage = const FlutterSecureStorage(aOptions: AndroidOptions(encryptedSharedPreferences: true));

  ThemeMode mode = ThemeMode.dark;
  bool get isDark => mode == ThemeMode.dark;

  Future<void> load() async {
    try {
      if (await _storage.read(key: _key) == 'light') {
        mode = ThemeMode.light;
        notifyListeners();
      }
    } catch (_) {/* keep the default */}
  }

  void toggle() {
    mode = isDark ? ThemeMode.light : ThemeMode.dark;
    notifyListeners();
    _storage.write(key: _key, value: isDark ? 'dark' : 'light').catchError((_) {});
  }
}
