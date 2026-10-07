import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// BusMate brand: route-ink navy + school-bus amber.
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
  static const paper = Color(0xFFF5F7FB);

  /// Amber that stays readable as text on white.
  static const amberDeep = Color(0xFFB45309);
}

/// Shared spacing, radii and touch-target sizes so every screen lines up.
class Ui {
  static const double gap = 12;
  static const double pad = 16;
  static const double radius = 18;
  static const double radiusSmall = 12;

  /// Smallest height of anything the driver taps.
  static const double touch = 48;
  static const double touchLarge = 56;
}

/// Small theme shortcuts used by the screens.
extension ThemeX on BuildContext {
  bool get isDarkTheme => Theme.of(this).brightness == Brightness.dark;
  Color get hint => Theme.of(this).hintColor;
  Color get outline => Theme.of(this).colorScheme.outlineVariant;
  Color get surface => Theme.of(this).colorScheme.surface;

  /// Amber for text / icons: brighter on dark, deeper on white.
  Color get amberText => isDarkTheme ? BrandColors.amber : BrandColors.amberDeep;

  /// Track behind progress bars.
  Color get track => isDarkTheme ? BrandColors.ink3 : const Color(0xFFE7EBF2);
}

class AppTheme {
  static ThemeData _base(Brightness b) {
    final dark = b == Brightness.dark;
    final surface = dark ? BrandColors.ink2 : Colors.white;
    final outline = dark ? const Color(0xFF26334F) : const Color(0xFFE3E8EF);
    final text = dark ? const Color(0xFFF1F4FA) : const Color(0xFF0F172A);
    final hint = dark ? const Color(0xFF9AA7C0) : const Color(0xFF64748B);
    final scheme = ColorScheme.fromSeed(
      seedColor: BrandColors.amber,
      brightness: b,
      primary: dark ? BrandColors.amber : BrandColors.ink,
      onPrimary: dark ? BrandColors.ink : Colors.white,
      surface: surface,
      onSurface: text,
      outlineVariant: outline,
    );
    final baseText = Typography.material2021(platform: TargetPlatform.android).englishLike.apply(
          bodyColor: text,
          displayColor: text,
        );
    final textTheme = baseText.copyWith(
      titleLarge: baseText.titleLarge?.copyWith(fontSize: 20, fontWeight: FontWeight.w700),
      titleMedium: baseText.titleMedium?.copyWith(fontSize: 16, fontWeight: FontWeight.w600),
      titleSmall: baseText.titleSmall?.copyWith(fontSize: 14, fontWeight: FontWeight.w600),
      bodyLarge: baseText.bodyLarge?.copyWith(fontSize: 15),
      bodyMedium: baseText.bodyMedium?.copyWith(fontSize: 14),
      bodySmall: baseText.bodySmall?.copyWith(fontSize: 12, color: hint),
      labelLarge: baseText.labelLarge?.copyWith(fontSize: 14, fontWeight: FontWeight.w600),
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: dark ? BrandColors.night : BrandColors.paper,
      hintColor: hint,
      dividerColor: outline,
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        foregroundColor: text,
        elevation: 0,
        scrolledUnderElevation: 0,
        toolbarHeight: 56,
        titleTextStyle: TextStyle(color: text, fontSize: 18, fontWeight: FontWeight.w700),
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
        style: IconButton.styleFrom(minimumSize: const Size(Ui.touch, Ui.touch), iconSize: 22),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        labelStyle: TextStyle(fontSize: 14, color: hint),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(Ui.radiusSmall), borderSide: BorderSide(color: outline)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(Ui.radiusSmall), borderSide: BorderSide(color: outline)),
        focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(Ui.radiusSmall), borderSide: const BorderSide(color: BrandColors.amber, width: 1.6)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(Ui.touchLarge),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, letterSpacing: 0.6),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(Ui.touchLarge),
          foregroundColor: text,
          side: BorderSide(color: outline, width: 1.5),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          minimumSize: const Size(Ui.touch, Ui.touch),
          textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 66,
        elevation: 0,
        backgroundColor: surface,
        surfaceTintColor: Colors.transparent,
        indicatorColor: BrandColors.amber.withValues(alpha: dark ? 0.22 : 0.28),
        labelTextStyle: WidgetStateProperty.resolveWith((states) => TextStyle(
              fontSize: 12,
              fontWeight: states.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
              color: states.contains(WidgetState.selected) ? text : hint,
            )),
        iconTheme: WidgetStateProperty.resolveWith((states) => IconThemeData(
              size: 22,
              color: states.contains(WidgetState.selected) ? (dark ? BrandColors.amber : BrandColors.ink) : hint,
            )),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Ui.radius)),
        titleTextStyle: TextStyle(color: text, fontSize: 18, fontWeight: FontWeight.w700),
        contentTextStyle: TextStyle(color: hint, fontSize: 14),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? BrandColors.ink : null),
        trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? BrandColors.amber : null),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(color: BrandColors.amber),
      snackBarTheme: const SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        contentTextStyle: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
      ),
    );
  }

  static ThemeData get light => _base(Brightness.light);
  static ThemeData get dark => _base(Brightness.dark);
}

/// Light by default; the driver can switch to dark and the choice is remembered on the phone.
class ThemeController extends ChangeNotifier {
  static const _key = 'busmate_driver_theme';
  final _storage = const FlutterSecureStorage(aOptions: AndroidOptions(encryptedSharedPreferences: true));

  ThemeMode mode = ThemeMode.light;
  bool get isDark => mode == ThemeMode.dark;

  Future<void> load() async {
    try {
      if (await _storage.read(key: _key) == 'dark') {
        mode = ThemeMode.dark;
        notifyListeners();
      }
    } catch (_) {/* keep the default */}
  }

  void toggle() => setDark(!isDark);

  void setDark(bool dark) {
    if (dark == isDark) return;
    mode = dark ? ThemeMode.dark : ThemeMode.light;
    notifyListeners();
    _storage.write(key: _key, value: dark ? 'dark' : 'light').catchError((_) {});
  }
}
