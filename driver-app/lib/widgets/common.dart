import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../theme/app_theme.dart';

enum Level { good, warn, bad }

Color levelColor(Level l) => switch (l) {
      Level.good => BrandColors.green,
      Level.warn => BrandColors.yellow,
      Level.bad => BrandColors.red,
    };

IconData levelIcon(Level l) => switch (l) {
      Level.good => Icons.check_circle_rounded,
      Level.warn => Icons.error_rounded,
      Level.bad => Icons.cancel_rounded,
    };

/// Colour used for the evening (moon) run.
const Color eveningColor = Color(0xFF6366F1);

// ============================================================================
// Motion helpers (Flutter built-ins only, all one-shot: nothing loops forever).
// ============================================================================

/// Fades and slides its child up once, after [delay]. Use increasing delays for a stagger.
class FadeSlideIn extends StatefulWidget {
  const FadeSlideIn({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.duration = const Duration(milliseconds: 420),
    this.offset = 14,
  });
  final Widget child;
  final Duration delay;
  final Duration duration;

  /// Pixels the child rises while fading in.
  final double offset;

  /// Delay for item [index] of a staggered list (capped so long lists do not wait).
  static Duration stagger(int index, {int stepMs = 60, int maxSteps = 8}) =>
      Duration(milliseconds: (index < maxSteps ? index : maxSteps) * stepMs);

  @override
  State<FadeSlideIn> createState() => _FadeSlideInState();
}

class _FadeSlideInState extends State<FadeSlideIn> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: widget.duration);
  late final Animation<double> _a = CurvedAnimation(parent: _c, curve: Curves.easeOutCubic);
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    if (widget.delay == Duration.zero) {
      _c.forward();
    } else {
      _timer = Timer(widget.delay, () {
        if (mounted) _c.forward();
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _a,
      child: AnimatedBuilder(
        animation: _a,
        builder: (context, child) => Transform.translate(offset: Offset(0, widget.offset * (1 - _a.value)), child: child),
        child: widget.child,
      ),
    );
  }
}

/// Rounded progress bar that animates to its new value (from 0 the first time).
class AnimatedBar extends StatelessWidget {
  const AnimatedBar({super.key, required this.value, this.color = BrandColors.green, this.height = 8, this.background});
  final double value;
  final Color color;
  final double height;
  final Color? background;

  @override
  Widget build(BuildContext context) {
    final v = value.isNaN ? 0.0 : (value < 0 ? 0.0 : (value > 1 ? 1.0 : value));
    final radius = BorderRadius.circular(height);
    return Container(
      height: height,
      decoration: BoxDecoration(color: background ?? context.track, borderRadius: radius),
      child: TweenAnimationBuilder<double>(
        tween: Tween<double>(begin: 0, end: v),
        duration: const Duration(milliseconds: 700),
        curve: Curves.easeOutCubic,
        builder: (context, x, _) => Align(
          alignment: Alignment.centerLeft,
          child: FractionallySizedBox(
            widthFactor: x,
            child: Container(decoration: BoxDecoration(color: color, borderRadius: radius)),
          ),
        ),
      ),
    );
  }
}

/// Static green "live" dot (a looping pulse would keep the GPU busy during a trip).
class LiveDot extends StatelessWidget {
  const LiveDot({super.key, this.size = 9, this.color = BrandColors.green});
  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        boxShadow: [BoxShadow(color: color.withValues(alpha: 0.55), blurRadius: 6, spreadRadius: 1)],
      ),
    );
  }
}

// ============================================================================
// Decoration
// ============================================================================

/// Abstract route lines with stop dots, drawn behind headers and the bus card.
class RouteLinesPainter extends CustomPainter {
  RouteLinesPainter({required this.color});
  final Color color;

  static const _routes = <List<Offset>>[
    [Offset(-0.05, 0.86), Offset(0.24, 0.62), Offset(0.50, 0.74), Offset(0.74, 0.40), Offset(1.06, 0.30)],
    [Offset(0.12, -0.08), Offset(0.26, 0.30), Offset(0.58, 0.24), Offset(0.70, 0.64), Offset(0.96, 1.08)],
    [Offset(0.40, 1.08), Offset(0.62, 0.92), Offset(0.88, 0.80), Offset(1.06, 0.58)],
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
    final line = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    final fill = Paint()..color = color;
    for (final pts in _routes) {
      final path = Path()..moveTo(pts.first.dx * w, pts.first.dy * h);
      for (var i = 1; i < pts.length; i++) {
        final a = pts[i - 1], b = pts[i];
        final cx = (a.dx + b.dx) / 2 * w;
        path.cubicTo(cx, a.dy * h, cx, b.dy * h, b.dx * w, b.dy * h);
      }
      canvas.drawPath(path, line);
      for (var i = 1; i < pts.length - 1; i++) {
        final c = Offset(pts[i].dx * w, pts[i].dy * h);
        canvas.drawCircle(c, 5, line);
        canvas.drawCircle(c, 2, fill);
      }
    }
  }

  @override
  bool shouldRepaint(RouteLinesPainter oldDelegate) => oldDelegate.color != color;
}

/// Fills its parent (use inside a Stack via Positioned.fill) with the route-line pattern.
class RoutePattern extends StatelessWidget {
  const RoutePattern({super.key, required this.color});
  final Color color;

  @override
  Widget build(BuildContext context) => IgnorePointer(child: CustomPaint(painter: RouteLinesPainter(color: color)));
}

// ============================================================================
// Small building blocks
// ============================================================================

/// Small uppercase heading above a card or a group, with an optional trailing widget.
class SectionLabel extends StatelessWidget {
  const SectionLabel(this.text, {super.key, this.trailing});
  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 2, bottom: 8),
      child: Row(children: [
        Expanded(
          child: Text(text.toUpperCase(),
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 1.1, color: Theme.of(context).hintColor)),
        ),
        if (trailing != null) trailing!,
      ]),
    );
  }
}

/// Rounded square holding an icon on a tinted background.
class IconTile extends StatelessWidget {
  const IconTile({super.key, required this.icon, required this.color, this.size = 40, this.solid = false});
  final IconData icon;
  final Color color;
  final double size;

  /// Solid colour background (icon in ink) instead of a light tint.
  final bool solid;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 250),
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: solid ? color : color.withValues(alpha: context.isDarkTheme ? 0.18 : 0.12),
        borderRadius: BorderRadius.circular(size * 0.3),
      ),
      child: Icon(icon, size: size * 0.5, color: solid ? BrandColors.ink : color),
    );
  }
}

/// Small rounded label: "● Active", "Ready ✓", "Evening Trip".
class Pill extends StatelessWidget {
  const Pill({super.key, required this.label, required this.color, this.icon, this.dot = false, this.solid = false});
  final String label;
  final Color color;
  final IconData? icon;
  final bool dot;
  final bool solid;

  @override
  Widget build(BuildContext context) {
    final fg = solid ? BrandColors.ink : color;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: solid ? color : color.withValues(alpha: context.isDarkTheme ? 0.18 : 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (dot) ...[Container(width: 6, height: 6, decoration: BoxDecoration(color: fg, shape: BoxShape.circle)), const SizedBox(width: 5)],
        if (icon != null) ...[Icon(icon, size: 13, color: fg), const SizedBox(width: 4)],
        Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: fg)),
      ]),
    );
  }
}

/// Amber BusMate logo tile.
class LogoTile extends StatelessWidget {
  const LogoTile({super.key, this.size = 36});
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: BrandColors.amber, borderRadius: BorderRadius.circular(size * 0.3)),
      child: Icon(Icons.directions_bus_rounded, color: BrandColors.ink, size: size * 0.6),
    );
  }
}

/// Sun / moon button that flips the theme.
class ThemeToggleButton extends StatelessWidget {
  const ThemeToggleButton({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeController>();
    return IconButton(
      tooltip: theme.isDark ? 'Light mode' : 'Dark mode',
      onPressed: theme.toggle,
      icon: AnimatedSwitcher(
        duration: const Duration(milliseconds: 300),
        transitionBuilder: (child, a) => RotationTransition(turns: Tween<double>(begin: 0.75, end: 1).animate(a), child: FadeTransition(opacity: a, child: child)),
        child: Icon(theme.isDark ? Icons.light_mode_rounded : Icons.dark_mode_rounded, key: ValueKey(theme.isDark)),
      ),
    );
  }
}

/// Settings row with a switch for dark mode.
class ThemeSwitchTile extends StatelessWidget {
  const ThemeSwitchTile({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeController>();
    return InkWell(
      onTap: theme.toggle,
      borderRadius: BorderRadius.circular(Ui.radius),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 60),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          child: Row(children: [
            IconTile(icon: theme.isDark ? Icons.dark_mode_rounded : Icons.light_mode_rounded, color: theme.isDark ? eveningColor : BrandColors.yellow),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                const Text('Dark mode', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                Text(theme.isDark ? 'On' : 'Off · using light theme', style: TextStyle(fontSize: 12, color: context.hint)),
              ]),
            ),
            Switch(value: theme.isDark, onChanged: theme.setDark),
          ]),
        ),
      ),
    );
  }
}

/// "Built by Nexi Net" + copyright, small and muted.
class CreditFooter extends StatelessWidget {
  const CreditFooter({super.key, this.color});
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = (color ?? Theme.of(context).hintColor).withValues(alpha: 0.8);
    return Column(mainAxisSize: MainAxisSize.min, children: [
      Text('Built by Nexi Net', textAlign: TextAlign.center, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: c)),
      const SizedBox(height: 2),
      Text('© ${DateTime.now().year} Nexi Net. All rights reserved.', textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: c)),
    ]);
  }
}

/// Labelled value tile (trip summary, route totals).
class StatTile extends StatelessWidget {
  const StatTile({super.key, required this.icon, required this.label, required this.value, this.color});
  final IconData icon;
  final String label;
  final String value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? context.amberText;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: context.isDarkTheme ? BrandColors.ink3.withValues(alpha: 0.5) : const Color(0xFFF6F8FB),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(children: [
        Icon(icon, size: 18, color: c),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: context.hint)),
            const SizedBox(height: 2),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
            ),
          ]),
        ),
      ]),
    );
  }
}

/// One line of the readiness checklist: icon tile, label, and a green / amber / red state.
class ChecklistRow extends StatelessWidget {
  const ChecklistRow({super.key, required this.icon, required this.label, required this.value, required this.level, this.action, this.onTap});
  final IconData icon;
  final String label;
  final String value;
  final Level level;

  /// e.g. "Tap to turn on". Shown only with [onTap].
  final String? action;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final color = levelColor(level);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(Ui.radiusSmall),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 56),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(children: [
            IconTile(icon: icon, color: color, size: 38),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                if (onTap != null && action != null)
                  Text(action!, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Theme.of(context).hintColor)),
              ]),
            ),
            const SizedBox(width: 8),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 250),
              child: Row(key: ValueKey('$value$level'), mainAxisSize: MainAxisSize.min, children: [
                Text(value, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color)),
                const SizedBox(width: 4),
                Icon(levelIcon(level), color: color, size: 18),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

/// Coloured status tile (GPS accuracy, network).
class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.icon, required this.label, required this.value, required this.level});
  final IconData icon;
  final String label;
  final String value;
  final Level level;

  @override
  Widget build(BuildContext context) {
    final color = levelColor(level);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 250),
      constraints: const BoxConstraints(minHeight: 52),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(Ui.radiusSmall),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Row(children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(width: 8),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Text(label.toUpperCase(),
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8, color: Theme.of(context).hintColor)),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: color)),
            ),
          ]),
        ),
      ]),
    );
  }
}

/// "☀ Morning Trip" / "🌙 Evening Trip" chip.
class DirectionChip extends StatelessWidget {
  const DirectionChip(this.direction, {super.key, this.onDark = false});
  final String direction;

  /// True when drawn on a dark banner (kept amber there for contrast).
  final bool onDark;

  @override
  Widget build(BuildContext context) {
    final back = direction == fromCollege;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: onDark ? BrandColors.amber : BrandColors.amber.withValues(alpha: context.isDarkTheme ? 0.2 : 0.18),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(back ? Icons.nights_stay_rounded : Icons.wb_sunny_rounded, size: 13, color: onDark ? BrandColors.ink : context.amberText),
        const SizedBox(width: 5),
        Text(directionTrip(direction),
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: onDark ? BrandColors.ink : context.amberText)),
      ]),
    );
  }
}

/// Two side-by-side cards to choose the run: morning to the college, or evening back.
class DirectionSelector extends StatelessWidget {
  const DirectionSelector({super.key, required this.value, required this.onChanged, this.route});
  final String value;
  final ValueChanged<String> onChanged;

  /// When given, the cards show the real place names and times set by the admin.
  final RouteInfo? route;

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Expanded(child: _DirectionButton(direction: toCollege, route: route, selected: value == toCollege, onTap: () => onChanged(toCollege))),
        const SizedBox(width: 10),
        Expanded(child: _DirectionButton(direction: fromCollege, route: route, selected: value == fromCollege, onTap: () => onChanged(fromCollege))),
      ]),
    );
  }
}

class _DirectionButton extends StatelessWidget {
  const _DirectionButton({required this.direction, required this.selected, required this.onTap, this.route});
  final String direction;
  final bool selected;
  final VoidCallback onTap;
  final RouteInfo? route;

  @override
  Widget build(BuildContext context) {
    final r = route;
    final evening = direction == fromCollege;
    final places = r == null ? directionLabel(direction) : '${r.startFor(direction) ?? 'Start'} → ${r.destinationFor(direction) ?? 'College'}';
    final time = r?.timeFor(direction);
    final iconColor = evening ? eveningColor : BrandColors.yellow;
    final dark = context.isDarkTheme;
    return Semantics(
      button: true,
      selected: selected,
      label: '${directionShift(direction)}, $places',
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 260),
          curve: Curves.easeOutCubic,
          constraints: const BoxConstraints(minHeight: 108),
          padding: const EdgeInsets.fromLTRB(12, 12, 10, 12),
          decoration: BoxDecoration(
            color: selected ? BrandColors.amber.withValues(alpha: dark ? 0.16 : 0.12) : context.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: selected ? BrandColors.amber : context.outline, width: selected ? 1.6 : 1),
          ),
          child: Stack(clipBehavior: Clip.none, children: [
            Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              IconTile(icon: evening ? Icons.nights_stay_rounded : Icons.wb_sunny_rounded, color: iconColor, size: 32),
              const SizedBox(height: 10),
              Text(directionShift(direction),
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.1,
                      color: selected ? context.amberText : Theme.of(context).hintColor)),
              const SizedBox(height: 3),
              Text(places, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, height: 1.25)),
              if (time != null) ...[
                const SizedBox(height: 4),
                Text(clock12(time), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Theme.of(context).hintColor)),
              ],
            ]),
            Positioned(
              top: 0,
              right: 0,
              child: AnimatedScale(
                scale: selected ? 1 : 0,
                duration: const Duration(milliseconds: 280),
                curve: selected ? Curves.easeOutBack : Curves.easeIn,
                child: Container(
                  width: 22,
                  height: 22,
                  decoration: const BoxDecoration(color: BrandColors.green, shape: BoxShape.circle),
                  child: const Icon(Icons.check_rounded, size: 15, color: Colors.white),
                ),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

/// A button that must be held down for a moment, so it cannot be pressed by accident
/// (END TRIP). The fill sweeps across while holding; releasing early cancels.
class HoldButton extends StatefulWidget {
  const HoldButton({
    super.key,
    required this.label,
    required this.icon,
    required this.onConfirmed,
    this.color = BrandColors.red,
    this.busy = false,
    this.hold = const Duration(milliseconds: 1300),
  });
  final String label;
  final IconData icon;
  final VoidCallback onConfirmed;
  final Color color;
  final bool busy;
  final Duration hold;

  @override
  State<HoldButton> createState() => _HoldButtonState();
}

class _HoldButtonState extends State<HoldButton> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: widget.hold)
    ..addStatusListener((status) {
      if (status != AnimationStatus.completed) return;
      HapticFeedback.heavyImpact();
      _c.reset();
      widget.onConfirmed();
    });

  void _down() {
    if (widget.busy) return;
    HapticFeedback.selectionClick();
    _c.forward();
  }

  void _up() {
    if (_c.isAnimating) _c.reverse();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '${widget.label}. Press and hold.',
      onLongPress: widget.busy ? null : widget.onConfirmed,
      excludeSemantics: true,
      child: GestureDetector(
        onTapDown: (_) => _down(),
        onTapUp: (_) => _up(),
        onTapCancel: _up,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: SizedBox(
            height: Ui.touchLarge,
            child: AnimatedBuilder(
              animation: _c,
              builder: (context, child) => Stack(fit: StackFit.expand, children: [
                ColoredBox(color: widget.color),
                FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: _c.value,
                  child: ColoredBox(color: Colors.black.withValues(alpha: 0.3)),
                ),
                child!,
              ]),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                if (widget.busy)
                  const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                else
                  Icon(widget.icon, color: Colors.white, size: 22),
                const SizedBox(width: 10),
                Text(widget.label, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w800, letterSpacing: 0.8)),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

/// Dot + label + value status row.
class StatusLine extends StatelessWidget {
  const StatusLine({super.key, required this.icon, required this.label, required this.value, required this.level});
  final IconData icon;
  final String label;
  final String value;
  final Level level;

  @override
  Widget build(BuildContext context) {
    final color = levelColor(level);
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 52),
      child: Row(children: [
        IconTile(icon: icon, color: color, size: 36),
        const SizedBox(width: 12),
        Expanded(child: Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600))),
        Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: color)),
      ]),
    );
  }
}

/// Number tile with a label and optional unit.
class MetricTile extends StatelessWidget {
  const MetricTile({super.key, required this.label, required this.value, this.unit, this.color});
  final String label;
  final String value;
  final String? unit;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label.toUpperCase(), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1, color: Theme.of(context).hintColor)),
          const SizedBox(height: 4),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
              Text(value, style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: color)),
              if (unit != null) ...[const SizedBox(width: 4), Text(unit!, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600))],
            ]),
          ),
        ]),
      ),
    );
  }
}

/// Label on the left, value on the right: one line of a summary card.
class SummaryRow extends StatelessWidget {
  const SummaryRow({super.key, required this.icon, required this.label, required this.value, this.highlight = false});
  final IconData icon;
  final String label;
  final String value;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final hint = Theme.of(context).hintColor;
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 48),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(children: [
          Icon(icon, size: 18, color: highlight ? context.amberText : hint),
          const SizedBox(width: 10),
          Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: hint)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(value,
                textAlign: TextAlign.right,
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: highlight ? context.amberText : null)),
          ),
        ]),
      ),
    );
  }
}

/// Logo, name and tagline (splash / login).
class Brand extends StatelessWidget {
  const Brand({super.key, this.subtitle = 'Driver · Smart College Transport', this.size = 1});
  final String subtitle;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Column(mainAxisSize: MainAxisSize.min, children: [
      LogoTile(size: 60 * size),
      SizedBox(height: 14 * size),
      Text('BUSMATE', style: TextStyle(fontSize: 24 * size, fontWeight: FontWeight.w900, letterSpacing: 3)),
      const SizedBox(height: 4),
      Text(subtitle, style: TextStyle(fontSize: 13 * size, color: context.amberText, fontWeight: FontWeight.w600, letterSpacing: 0.4)),
    ]);
  }
}

class ErrorBanner extends StatelessWidget {
  const ErrorBanner(this.message, {super.key, this.onRetry});
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 6, 8),
      constraints: const BoxConstraints(minHeight: 48),
      decoration: BoxDecoration(
        color: BrandColors.red.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(Ui.radiusSmall),
        border: Border.all(color: BrandColors.red.withValues(alpha: 0.4)),
      ),
      child: Row(children: [
        const Icon(Icons.error_outline_rounded, color: BrandColors.red, size: 20),
        const SizedBox(width: 10),
        Expanded(child: Text(message, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500))),
        if (onRetry != null) TextButton(onPressed: onRetry, child: const Text('Retry')),
      ]),
    );
  }
}

class DemoTag extends StatelessWidget {
  const DemoTag({super.key});
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
        decoration: BoxDecoration(color: Colors.deepPurple.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(8)),
        child: const Text('DEMO', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.deepPurpleAccent)),
      );
}
