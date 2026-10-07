import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

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

/// Small uppercase heading above a card or a group.
class SectionLabel extends StatelessWidget {
  const SectionLabel(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 10),
      child: Text(text.toUpperCase(),
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, letterSpacing: 1.4, color: Theme.of(context).hintColor)),
    );
  }
}

/// One line of the readiness checklist: green / amber / red, with what to do if it is not ready.
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
        constraints: const BoxConstraints(minHeight: Ui.touch),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              width: 48,
              height: 48,
              decoration: BoxDecoration(color: color.withValues(alpha: 0.16), borderRadius: BorderRadius.circular(16)),
              child: Icon(icon, color: color, size: 26),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                Text(label, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w700)),
                if (onTap != null && action != null)
                  Text(action!, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Theme.of(context).hintColor)),
              ]),
            ),
            const SizedBox(width: 8),
            Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, letterSpacing: 0.5, color: color)),
            const SizedBox(width: 8),
            Icon(levelIcon(level), color: color, size: 28),
          ]),
        ),
      ),
    );
  }
}

/// Coloured status tile for the active trip (GPS accuracy, network).
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
      constraints: const BoxConstraints(minHeight: Ui.touchLarge),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(Ui.radiusSmall),
        border: Border.all(color: color.withValues(alpha: 0.6), width: 1.5),
      ),
      child: Row(children: [
        Icon(icon, color: color, size: 28),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Text(label.toUpperCase(),
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 1.1, color: Theme.of(context).hintColor)),
            const SizedBox(height: 2),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(value, style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900, color: color)),
            ),
          ]),
        ),
      ]),
    );
  }
}

/// "MORNING · To College" / "EVENING · From College" pill.
class DirectionChip extends StatelessWidget {
  const DirectionChip(this.direction, {super.key, this.onDark = false});
  final String direction;

  /// True when drawn on a dark or coloured banner.
  final bool onDark;

  @override
  Widget build(BuildContext context) {
    final back = direction == fromCollege;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: onDark ? Colors.white.withValues(alpha: 0.18) : BrandColors.amber,
        borderRadius: BorderRadius.circular(30),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(back ? Icons.nights_stay_rounded : Icons.wb_sunny_rounded, size: 18, color: onDark ? Colors.white : BrandColors.ink),
        const SizedBox(width: 6),
        Text('${directionShift(direction)} · ${directionLabel(direction)}',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: onDark ? Colors.white : BrandColors.ink)),
      ]),
    );
  }
}

/// Two large buttons to choose the run: morning to the college, or evening back.
class DirectionSelector extends StatelessWidget {
  const DirectionSelector({super.key, required this.value, required this.onChanged, this.route});
  final String value;
  final ValueChanged<String> onChanged;

  /// When given, the buttons show the real place names and times set by the admin.
  final RouteInfo? route;

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Expanded(child: _DirectionButton(direction: toCollege, route: route, selected: value == toCollege, onTap: () => onChanged(toCollege))),
      const SizedBox(width: 12),
      Expanded(child: _DirectionButton(direction: fromCollege, route: route, selected: value == fromCollege, onTap: () => onChanged(fromCollege))),
    ]);
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
    final fg = selected ? BrandColors.ink : Colors.white;
    final r = route;
    final places = r == null ? directionLabel(direction) : '${r.startFor(direction) ?? 'Start'} → ${r.destinationFor(direction) ?? 'College'}';
    final time = r?.timeFor(direction);
    return Semantics(
      button: true,
      selected: selected,
      label: '${directionShift(direction)}, $places',
      excludeSemantics: true,
      child: GestureDetector(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOut,
          constraints: const BoxConstraints(minHeight: 96),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
          decoration: BoxDecoration(
            color: selected ? BrandColors.amber : Colors.white.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(Ui.radiusSmall),
            border: Border.all(color: selected ? BrandColors.amber : Colors.white.withValues(alpha: 0.28), width: 2),
          ),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(direction == fromCollege ? Icons.nights_stay_rounded : Icons.wb_sunny_rounded, color: fg, size: 24),
              const SizedBox(width: 8),
              Flexible(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(directionShift(direction), style: TextStyle(color: fg, fontSize: 20, fontWeight: FontWeight.w900, letterSpacing: 1)),
                ),
              ),
            ]),
            const SizedBox(height: 4),
            Text(places,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: fg, fontSize: 15, fontWeight: FontWeight.w800, height: 1.2)),
            if (time != null) ...[
              const SizedBox(height: 2),
              Text(clock12(time), style: TextStyle(color: fg.withValues(alpha: 0.8), fontSize: 14, fontWeight: FontWeight.w700)),
            ],
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
          borderRadius: BorderRadius.circular(Ui.radius),
          child: SizedBox(
            height: Ui.touchLarge + 4,
            child: AnimatedBuilder(
              animation: _c,
              builder: (context, child) => Stack(fit: StackFit.expand, children: [
                ColoredBox(color: widget.color),
                FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: _c.value,
                  child: ColoredBox(color: Colors.black.withValues(alpha: 0.35)),
                ),
                child!,
              ]),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                if (widget.busy)
                  const SizedBox(width: 28, height: 28, child: CircularProgressIndicator(strokeWidth: 3, color: Colors.white))
                else
                  Icon(widget.icon, color: Colors.white, size: 34),
                const SizedBox(width: 12),
                Text(widget.label, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900, letterSpacing: 1)),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

/// 🟢/🟡/🔴 style status row: dot + label + value.
class StatusLine extends StatelessWidget {
  const StatusLine({super.key, required this.icon, required this.label, required this.value, required this.level});
  final IconData icon;
  final String label;
  final String value;
  final Level level;

  @override
  Widget build(BuildContext context) {
    final color = levelColor(level);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(children: [
        Icon(icon, size: 26, color: color),
        const SizedBox(width: 12),
        Text(label, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        const Spacer(),
        Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 8),
        Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: color)),
      ]),
    );
  }
}

/// Big number tile for the active trip screen.
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
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label.toUpperCase(), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, letterSpacing: 1, color: Theme.of(context).hintColor)),
          const SizedBox(height: 6),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
              Text(value, style: TextStyle(fontSize: 36, fontWeight: FontWeight.w900, color: color)),
              if (unit != null) ...[const SizedBox(width: 4), Text(unit!, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700))],
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
      constraints: const BoxConstraints(minHeight: 60),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(children: [
          Icon(icon, size: 24, color: highlight ? BrandColors.amber : hint),
          const SizedBox(width: 12),
          Text(label, style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: hint)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(value,
                textAlign: TextAlign.right,
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: highlight ? BrandColors.amber : null)),
          ),
        ]),
      ),
    );
  }
}

class Brand extends StatelessWidget {
  const Brand({super.key, this.subtitle = 'Smart College Transport', this.size = 1});
  final String subtitle;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Column(mainAxisSize: MainAxisSize.min, children: [
      Container(
        width: 72 * size,
        height: 72 * size,
        decoration: BoxDecoration(color: BrandColors.amber, borderRadius: BorderRadius.circular(22 * size)),
        child: Icon(Icons.directions_bus_rounded, size: 44 * size, color: BrandColors.ink),
      ),
      SizedBox(height: 16 * size),
      Text('BUSMATE', style: TextStyle(fontSize: 34 * size, fontWeight: FontWeight.w900, letterSpacing: 3)),
      const SizedBox(height: 4),
      Text(subtitle, style: TextStyle(fontSize: 15 * size, color: BrandColors.amber, fontWeight: FontWeight.w600, letterSpacing: 1)),
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
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: BrandColors.red.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(Ui.radiusSmall),
        border: Border.all(color: BrandColors.red.withValues(alpha: 0.5)),
      ),
      child: Row(children: [
        const Icon(Icons.error_outline, color: BrandColors.red, size: 28),
        const SizedBox(width: 12),
        Expanded(child: Text(message, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600))),
        if (onRetry != null) TextButton(onPressed: onRetry, child: const Text('RETRY')),
      ]),
    );
  }
}

class DemoTag extends StatelessWidget {
  const DemoTag({super.key});
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(color: Colors.deepPurple.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(8)),
        child: const Text('DEMO / SIMULATION', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Colors.deepPurpleAccent)),
      );
}
