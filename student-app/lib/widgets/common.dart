import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

enum Level { good, warn, bad }

Color levelColor(Level l) => switch (l) {
      Level.good => BrandColors.green,
      Level.warn => BrandColors.yellow,
      Level.bad => BrandColors.red,
    };

/// Amber square brand tile with the bus glyph.
class BrandTile extends StatelessWidget {
  const BrandTile({super.key, this.size = 40});
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: BrandColors.amber,
        borderRadius: BorderRadius.circular(size * 0.3),
        boxShadow: [BoxShadow(color: BrandColors.amber.withValues(alpha: 0.35), blurRadius: size * 0.4, offset: Offset(0, size * 0.12))],
      ),
      child: Icon(Icons.directions_bus_rounded, size: size * 0.56, color: BrandColors.ink),
    );
  }
}

class Brand extends StatelessWidget {
  const Brand({super.key, this.subtitle = 'Your bus. Your route. Your time.', this.size = 1});
  final String subtitle;
  final double size;

  @override
  Widget build(BuildContext context) {
    final pal = Palette.of(context);
    return Column(mainAxisSize: MainAxisSize.min, children: [
      BrandTile(size: 60 * size),
      SizedBox(height: 14 * size),
      Text('BUSMATE', style: TextStyle(fontSize: 24 * size, fontWeight: FontWeight.w800, letterSpacing: 4, color: pal.text)),
      const SizedBox(height: 4),
      Text(subtitle, style: TextStyle(fontSize: 13 * size, color: pal.muted, fontWeight: FontWeight.w500, letterSpacing: 0.3)),
    ]);
  }
}

/// White (or ink in dark mode) card with a 1px border, soft shadow and optional tap.
class BmCard extends StatelessWidget {
  const BmCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
    this.color,
    this.borderColor,
    this.radius = Ui.radius,
  });
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? color;
  final Color? borderColor;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final pal = Palette.of(context);
    final r = BorderRadius.circular(radius);
    return DecoratedBox(
      decoration: BoxDecoration(borderRadius: r, boxShadow: pal.shadow),
      child: Material(
        color: color ?? pal.card,
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(borderRadius: r, side: BorderSide(color: borderColor ?? pal.line)),
        child: InkWell(onTap: onTap, child: Padding(padding: padding, child: child)),
      ),
    );
  }
}

/// Small uppercase, letter-spaced section label (e.g. "MY BUS").
class SectionLabel extends StatelessWidget {
  const SectionLabel(this.text, {super.key, this.trailing, this.padding = const EdgeInsets.fromLTRB(4, 0, 4, 8)});
  final String text;
  final Widget? trailing;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final pal = Palette.of(context);
    return Padding(
      padding: padding,
      child: Row(children: [
        Text(text.toUpperCase(), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 1.2, color: pal.muted)),
        const Spacer(),
        if (trailing != null) trailing!,
      ]),
    );
  }
}

/// Icon on a soft tinted rounded square.
class IconTile extends StatelessWidget {
  const IconTile({super.key, required this.icon, this.color = BrandColors.amber, this.size = 36, this.filled = false});
  final IconData icon;
  final Color color;
  final double size;

  /// Solid background with ink/white glyph instead of a soft tint.
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final fg = !filled
        ? color
        : color == BrandColors.amber
            ? BrandColors.ink
            : (color == BrandColors.ink ? BrandColors.amber : Colors.white);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: filled ? color : color.withValues(alpha: dark ? 0.18 : 0.13),
        borderRadius: BorderRadius.circular(size * 0.32),
      ),
      child: Icon(icon, size: size * 0.52, color: fg),
    );
  }
}

class ErrorBanner extends StatelessWidget {
  const ErrorBanner(this.message, {super.key, this.onRetry});
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 6, 10),
      decoration: BoxDecoration(
        color: BrandColors.red.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(Ui.radiusSmall),
        border: Border.all(color: BrandColors.red.withValues(alpha: 0.25)),
      ),
      child: Row(children: [
        const Icon(Icons.error_outline_rounded, color: BrandColors.red, size: 20),
        const SizedBox(width: 10),
        Expanded(child: Text(message, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500))),
        if (onRetry != null)
          TextButton(
            onPressed: onRetry,
            style: TextButton.styleFrom(foregroundColor: BrandColors.red, visualDensity: VisualDensity.compact),
            child: const Text('Retry'),
          ),
      ]),
    );
  }
}

class DemoTag extends StatelessWidget {
  const DemoTag({super.key});
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
        decoration: BoxDecoration(color: BrandColors.indigo.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(6)),
        child: const Text('DEMO', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 0.8, color: BrandColors.indigo)),
      );
}

/// Status chip: ON ROUTE, STOPPED, OFFLINE, Live ... Pulses its dot when [pulse] is set.
class PhaseChip extends StatelessWidget {
  const PhaseChip({super.key, required this.label, required this.level, this.large = false, this.pulse = false});
  final String label;
  final Level level;
  final bool large;
  final bool pulse;

  @override
  Widget build(BuildContext context) {
    final color = levelColor(level);
    final dot = large ? 8.0 : 7.0;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      padding: EdgeInsets.symmetric(horizontal: large ? 11 : 9, vertical: large ? 6 : 4),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (pulse)
          PulseDot(color: color, size: dot)
        else
          Container(width: dot, height: dot, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        SizedBox(width: large ? 7 : 6),
        Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: large ? 12.5 : 11.5, letterSpacing: 0.4)),
      ]),
    );
  }
}

/// Solid dot with an expanding, fading halo (used for "Live").
class PulseDot extends StatefulWidget {
  const PulseDot({super.key, required this.color, this.size = 8});
  final Color color;
  final double size;

  @override
  State<PulseDot> createState() => _PulseDotState();
}

class _PulseDotState extends State<PulseDot> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600))..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.size;
    return SizedBox(
      width: s,
      height: s,
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, _) {
          final t = Curves.easeOut.transform(_c.value);
          return Stack(clipBehavior: Clip.none, alignment: Alignment.center, children: [
            Positioned(
              left: -s * t * 0.75,
              top: -s * t * 0.75,
              child: Container(
                width: s * (1 + 1.5 * t),
                height: s * (1 + 1.5 * t),
                decoration: BoxDecoration(color: widget.color.withValues(alpha: 0.45 * (1 - t)), shape: BoxShape.circle),
              ),
            ),
            Container(width: s, height: s, decoration: BoxDecoration(color: widget.color, shape: BoxShape.circle)),
          ]);
        },
      ),
    );
  }
}

/// Fades a child in while sliding it up a little. [index] staggers a list of cards.
class FadeSlideIn extends StatefulWidget {
  const FadeSlideIn({
    super.key,
    required this.child,
    this.index = 0,
    this.delay = Duration.zero,
    this.duration = const Duration(milliseconds: 420),
    this.offsetY = 14,
  });
  final Widget child;
  final int index;
  final Duration delay;
  final Duration duration;
  final double offsetY;

  @override
  State<FadeSlideIn> createState() => _FadeSlideInState();
}

class _FadeSlideInState extends State<FadeSlideIn> with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final Animation<double> _a;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: widget.duration);
    _a = CurvedAnimation(parent: _c, curve: Curves.easeOutCubic);
    final wait = widget.delay + Duration(milliseconds: 55 * math.min(math.max(widget.index, 0), 10));
    if (wait == Duration.zero) {
      _c.forward();
    } else {
      _timer = Timer(wait, () {
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
        child: widget.child,
        builder: (context, child) => Transform.translate(offset: Offset(0, widget.offsetY * (1 - _a.value)), child: child),
      ),
    );
  }
}

/// "Built by Nexi Net" credit, small and muted.
class CreditFooter extends StatelessWidget {
  const CreditFooter({super.key});

  @override
  Widget build(BuildContext context) {
    final muted = Palette.of(context).muted;
    return Column(mainAxisSize: MainAxisSize.min, children: [
      Text('Built by Nexi Net', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: muted.withValues(alpha: 0.9))),
      const SizedBox(height: 2),
      Text('© ${DateTime.now().year} Nexi Net. All rights reserved.',
          textAlign: TextAlign.center, style: TextStyle(fontSize: 10.5, color: muted.withValues(alpha: 0.75))),
    ]);
  }
}

/// Abstract route lines with stop dots: decoration for headers and the splash/login screens.
class RouteLines extends StatelessWidget {
  const RouteLines({super.key, this.opacity = 1});
  final double opacity;

  @override
  Widget build(BuildContext context) {
    final pal = Palette.of(context);
    return IgnorePointer(
      child: CustomPaint(
        painter: RouteLinesPainter(
          primary: BrandColors.amber.withValues(alpha: 0.55 * opacity),
          secondary: pal.text.withValues(alpha: (pal.dark ? 0.10 : 0.07) * opacity),
          dot: pal.card,
        ),
        size: Size.infinite,
      ),
    );
  }
}

class RouteLinesPainter extends CustomPainter {
  RouteLinesPainter({required this.primary, required this.secondary, required this.dot});
  final Color primary;
  final Color secondary;
  final Color dot;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    if (w <= 0 || h <= 0) return;

    final thin = Paint()
      ..color = secondary
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round;
    final main = Paint()
      ..color = primary
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;

    // Two quiet background lines.
    final a = Path()
      ..moveTo(-20, h * 0.18)
      ..cubicTo(w * 0.3, h * 0.05, w * 0.45, h * 0.45, w + 20, h * 0.30);
    final b = Path()
      ..moveTo(-20, h * 0.78)
      ..cubicTo(w * 0.25, h * 0.95, w * 0.6, h * 0.55, w + 20, h * 0.70);
    canvas.drawPath(a, thin);
    canvas.drawPath(b, thin);

    // The highlighted route with stops.
    final r = Path()
      ..moveTo(-20, h * 0.55)
      ..cubicTo(w * 0.28, h * 0.30, w * 0.62, h * 0.85, w + 20, h * 0.48);
    canvas.drawPath(r, main);

    final fill = Paint()..color = dot;
    final ring = Paint()
      ..color = primary
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5;
    for (final metric in r.computeMetrics()) {
      for (final f in const [0.18, 0.42, 0.68, 0.88]) {
        final t = metric.getTangentForOffset(metric.length * f);
        if (t == null) continue;
        canvas.drawCircle(t.position, 5, fill);
        canvas.drawCircle(t.position, 5, ring);
      }
    }
  }

  @override
  bool shouldRepaint(RouteLinesPainter old) => old.primary != primary || old.secondary != secondary || old.dot != dot;
}
