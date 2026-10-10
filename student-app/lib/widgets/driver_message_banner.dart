import 'package:flutter/material.dart';

import '../providers/bus_provider.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';

/// Banner with the driver's latest message ("Stuck in traffic · about 10 min late").
class DriverMessageBanner extends StatelessWidget {
  const DriverMessageBanner({super.key, required this.p});
  final BusProvider p;

  @override
  Widget build(BuildContext context) {
    final m = p.driverMessage;
    if (m == null) return const SizedBox.shrink();
    final pal = Palette.of(context);
    final (IconData icon, Color color) = switch (m.kind) {
      'BREAKDOWN' => (Icons.car_crash_rounded, BrandColors.red),
      'TRAFFIC' => (Icons.traffic_rounded, BrandColors.yellow),
      'LATE' => (Icons.schedule_rounded, BrandColors.yellow),
      _ => (Icons.campaign_rounded, BrandColors.indigo),
    };
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.fromLTRB(12, 10, 4, 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: pal.dark ? 0.18 : 0.08),
        borderRadius: BorderRadius.circular(Ui.radius),
        border: Border.all(color: color.withValues(alpha: 0.45)),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, color: color, size: 22),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Message from driver', style: TextStyle(color: color, fontSize: 11.5, fontWeight: FontWeight.w700)),
            const SizedBox(height: 2),
            Text(m.text, style: TextStyle(color: pal.text, fontSize: 13.5, fontWeight: FontWeight.w600)),
            const SizedBox(height: 2),
            Text(agoText(m.at), style: TextStyle(color: pal.muted, fontSize: 11)),
          ]),
        ),
        IconButton(
          visualDensity: VisualDensity.compact,
          tooltip: 'Hide',
          icon: Icon(Icons.close_rounded, size: 18, color: pal.muted),
          onPressed: p.dismissDriverMessage,
        ),
      ]),
    );
  }
}
