import 'package:flutter/material.dart';

/// BusMate brand: route-ink navy + school-bus amber (same language as the driver app).
class BrandColors {
  static const ink = Color(0xFF0C1322);
  static const ink2 = Color(0xFF141D31);
  static const ink3 = Color(0xFF1E2A44);
  static const amber = Color(0xFFF5B301);
  static const green = Color(0xFF16A34A);
  static const yellow = Color(0xFFD97706);
  static const red = Color(0xFFDC2626);
  static const indigo = Color(0xFF5B6CF0);

  /// Light page background and card border.
  static const paper = Color(0xFFF5F7FB);
  static const line = Color(0xFFE6EAF2);

  /// Dark page background and card border.
  static const night = Color(0xFF070B14);
  static const nightLine = Color(0xFF223050);
}

/// Shared radii so every screen lines up.
class Ui {
  static const double radius = 18;
  static const double radiusSmall = 14;
  static const double radiusLarge = 22;
}

/// Light/dark aware colours used by the custom widgets (cards, labels, tiles).
class Palette {
  const Palette._(this.dark);
  final bool dark;

  static Palette of(BuildContext context) => Palette._(Theme.of(context).brightness == Brightness.dark);

  Color get bg => dark ? BrandColors.night : BrandColors.paper;
  Color get card => dark ? BrandColors.ink2 : Colors.white;
  Color get line => dark ? BrandColors.nightLine : BrandColors.line;
  Color get text => dark ? const Color(0xFFEEF2F9) : BrandColors.ink;
  Color get muted => dark ? const Color(0xFF8E9AB3) : const Color(0xFF66728A);
  Color get soft => dark ? BrandColors.ink3 : const Color(0xFFF0F3F8);

  /// Brand accent that stays readable on this background (ink on light, amber on dark).
  Color get accentText => dark ? BrandColors.amber : BrandColors.ink;

  List<BoxShadow> get shadow => dark
      ? const <BoxShadow>[]
      : const [BoxShadow(color: Color(0x0F0C1322), blurRadius: 18, offset: Offset(0, 6))];

  List<BoxShadow> get floatShadow => [
        BoxShadow(color: Colors.black.withValues(alpha: dark ? 0.5 : 0.12), blurRadius: 24, offset: const Offset(0, 8)),
      ];
}

class AppTheme {
  static ThemeData _base(Brightness b) {
    final dark = b == Brightness.dark;
    final surface = dark ? BrandColors.ink2 : Colors.white;
    final outline = dark ? BrandColors.nightLine : BrandColors.line;
    final text = dark ? const Color(0xFFEEF2F9) : BrandColors.ink;
    final muted = dark ? const Color(0xFF8E9AB3) : const Color(0xFF66728A);
    final scheme = ColorScheme.fromSeed(
      seedColor: BrandColors.amber,
      brightness: b,
      primary: dark ? BrandColors.amber : BrandColors.ink,
      onPrimary: dark ? BrandColors.ink : Colors.white,
      secondary: BrandColors.amber,
      onSecondary: BrandColors.ink,
      surface: surface,
      onSurface: text,
      outlineVariant: outline,
      error: BrandColors.red,
    );

    final base = Typography.material2021(platform: TargetPlatform.android).englishLike;
    final textTheme = base
        .copyWith(
          titleLarge: base.titleLarge?.copyWith(fontSize: 20, fontWeight: FontWeight.w700),
          titleMedium: base.titleMedium?.copyWith(fontSize: 16, fontWeight: FontWeight.w600),
          titleSmall: base.titleSmall?.copyWith(fontSize: 14, fontWeight: FontWeight.w600),
          bodyLarge: base.bodyLarge?.copyWith(fontSize: 15),
          bodyMedium: base.bodyMedium?.copyWith(fontSize: 14),
          bodySmall: base.bodySmall?.copyWith(fontSize: 12),
          labelLarge: base.labelLarge?.copyWith(fontSize: 14, fontWeight: FontWeight.w600),
          labelMedium: base.labelMedium?.copyWith(fontSize: 12),
          labelSmall: base.labelSmall?.copyWith(fontSize: 11),
        )
        .apply(bodyColor: text, displayColor: text);

    final buttonShape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(Ui.radiusSmall));

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: dark ? BrandColors.night : BrandColors.paper,
      canvasColor: dark ? BrandColors.night : BrandColors.paper,
      hintColor: muted,
      dividerColor: outline,
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: dark ? BrandColors.night : BrandColors.paper,
        surfaceTintColor: Colors.transparent,
        foregroundColor: text,
        elevation: 0,
        scrolledUnderElevation: 0,
        toolbarHeight: 60,
        titleTextStyle: TextStyle(color: text, fontSize: 18, fontWeight: FontWeight.w700),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Ui.radius), side: BorderSide(color: outline)),
        margin: EdgeInsets.zero,
      ),
      dividerTheme: DividerThemeData(color: outline, thickness: 1, space: 1),
      listTileTheme: ListTileThemeData(
        iconColor: muted,
        titleTextStyle: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: text),
        subtitleTextStyle: TextStyle(fontSize: 12.5, color: muted, height: 1.3),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14),
        minVerticalPadding: 10,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: dark ? BrandColors.ink3.withValues(alpha: 0.5) : const Color(0xFFF7F9FC),
        labelStyle: TextStyle(fontSize: 14, color: muted),
        floatingLabelStyle: TextStyle(fontSize: 13, color: dark ? BrandColors.amber : BrandColors.ink, fontWeight: FontWeight.w600),
        prefixIconColor: muted,
        suffixIconColor: muted,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(Ui.radiusSmall), borderSide: BorderSide(color: outline)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(Ui.radiusSmall), borderSide: BorderSide(color: outline)),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(Ui.radiusSmall),
          borderSide: const BorderSide(color: BrandColors.amber, width: 1.6),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 15),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(50),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, letterSpacing: 0.2),
          shape: buttonShape,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(46),
          foregroundColor: text,
          side: BorderSide(color: outline),
          textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
          shape: buttonShape,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: dark ? BrandColors.amber : BrandColors.ink,
          textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
        ),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? Colors.white : null),
        trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? BrandColors.amber : null),
        trackOutlineColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? BrandColors.amber : null),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(color: BrandColors.amber),
      navigationBarTheme: NavigationBarThemeData(
        height: 64,
        elevation: 0,
        backgroundColor: surface,
        surfaceTintColor: Colors.transparent,
        indicatorColor: BrandColors.amber.withValues(alpha: dark ? 0.22 : 0.28),
        labelTextStyle: WidgetStateProperty.resolveWith((s) => TextStyle(
              fontSize: 12,
              fontWeight: s.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
              color: s.contains(WidgetState.selected) ? text : muted,
            )),
        iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(
              size: 22,
              color: s.contains(WidgetState.selected) ? (dark ? BrandColors.amber : BrandColors.ink) : muted,
            )),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Ui.radiusLarge)),
        titleTextStyle: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: text),
        contentTextStyle: TextStyle(fontSize: 14, color: muted, height: 1.4),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: dark ? BrandColors.ink3 : BrandColors.ink,
        contentTextStyle: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w500, color: Colors.white),
        actionTextColor: BrandColors.amber,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Ui.radiusSmall)),
      ),
    );
  }

  static ThemeData get light => _base(Brightness.light);
  static ThemeData get dark => _base(Brightness.dark);
}
