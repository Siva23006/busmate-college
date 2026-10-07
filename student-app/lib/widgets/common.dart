import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

enum Level { good, warn, bad }

Color levelColor(Level l) => switch (l) {
      Level.good => BrandColors.green,
      Level.warn => BrandColors.yellow,
      Level.bad => BrandColors.red,
    };

class Brand extends StatelessWidget {
  const Brand({super.key, this.subtitle = 'Your bus. Your route. Your time.', this.size = 1});
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
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: BrandColors.red.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(16)),
      child: Row(children: [
        const Icon(Icons.error_outline, color: BrandColors.red),
        const SizedBox(width: 10),
        Expanded(child: Text(message, style: const TextStyle(fontSize: 15))),
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

/// Big status chip, readable at a glance: 🟢 ON ROUTE, 🟡 STOPPED, 🔴 OFFLINE ...
class PhaseChip extends StatelessWidget {
  const PhaseChip({super.key, required this.label, required this.level, this.large = false});
  final String label;
  final Level level;
  final bool large;

  @override
  Widget build(BuildContext context) {
    final color = levelColor(level);
    return Container(
      padding: EdgeInsets.symmetric(horizontal: large ? 14 : 10, vertical: large ? 8 : 4),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Container(width: large ? 10 : 8, height: large ? 10 : 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        SizedBox(width: large ? 8 : 6),
        Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: large ? 16 : 12, letterSpacing: 0.5)),
      ]),
    );
  }
}
