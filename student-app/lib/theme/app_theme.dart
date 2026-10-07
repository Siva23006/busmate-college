import 'package:flutter/material.dart';

/// BusMate brand: route-ink navy + school-bus amber. Large type for use in a vehicle.
class BrandColors {
  static const ink = Color(0xFF0C1322);
  static const ink2 = Color(0xFF141D31);
  static const ink3 = Color(0xFF1E2A44);
  static const amber = Color(0xFFF5B301);
  static const green = Color(0xFF16A34A);
  static const yellow = Color(0xFFD97706);
  static const red = Color(0xFFDC2626);
}

class AppTheme {
  static ThemeData _base(Brightness b) {
    final dark = b == Brightness.dark;
    final scheme = ColorScheme.fromSeed(
      seedColor: BrandColors.amber,
      brightness: b,
      primary: dark ? BrandColors.amber : BrandColors.ink,
      onPrimary: dark ? BrandColors.ink : Colors.white,
      surface: dark ? BrandColors.ink2 : Colors.white,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: dark ? BrandColors.ink : const Color(0xFFF4F6FA),
      textTheme: Typography.material2021(platform: TargetPlatform.android).englishLike.apply(
            bodyColor: dark ? const Color(0xFFE6EBF5) : const Color(0xFF0F172A),
            displayColor: dark ? Colors.white : BrandColors.ink,
          ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: dark ? BrandColors.ink2 : Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: dark ? BrandColors.ink3 : const Color(0xFFE3E8F0)),
        ),
        margin: EdgeInsets.zero,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: dark ? BrandColors.ink2 : Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(64),
          textStyle: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, letterSpacing: 1),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(60),
          textStyle: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        ),
      ),
    );
  }

  static ThemeData get light => _base(Brightness.light);
  static ThemeData get dark => _base(Brightness.dark);
}
