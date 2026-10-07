import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/bus_provider.dart';
import '../theme/app_theme.dart';
import '../utils/status.dart';
import '../widgets/bus_map.dart';
import '../widgets/common.dart';
import '../widgets/journey.dart';

/// Full-screen live map with a compact arrival card.
class LiveMapScreen extends StatelessWidget {
  const LiveMapScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final p = context.watch<BusProvider>();
    final top = MediaQuery.of(context).padding.top;
    final bottom = MediaQuery.of(context).padding.bottom;
    final (live, liveLevel) = liveLabel(p.liveState);
    const cardHeight = 210.0;

    return Scaffold(
      body: Stack(children: [
        Positioned.fill(child: BusMapView(bottomPadding: cardHeight + bottom, topPadding: top + 60, controlsBottom: cardHeight + bottom + 16)),
        Positioned(
          left: 12,
          right: 12,
          top: top + 8,
          child: Row(children: [
            Material(
              color: BrandColors.ink,
              shape: const CircleBorder(),
              elevation: 4,
              child: IconButton(
                icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
                onPressed: () => Navigator.pop(context),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                decoration: BoxDecoration(color: BrandColors.ink.withValues(alpha: 0.94), borderRadius: BorderRadius.circular(18)),
                child: Row(children: [
                  Expanded(
                    child: Text(p.bus?.number ?? 'Live map',
                        maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w900)),
                  ),
                  if (p.isSimulation) ...[const DemoTag(), const SizedBox(width: 6)],
                  PhaseChip(label: live, level: liveLevel),
                ]),
              ),
            ),
          ]),
        ),
        Positioned(
          left: 12,
          right: 12,
          bottom: bottom + 12,
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Theme.of(context).scaffoldBackgroundColor,
              borderRadius: BorderRadius.circular(26),
              boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 16, offset: Offset(0, 4))],
            ),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              RouteHeader(p: p),
              const SizedBox(height: 10),
              BigEtaCard(p: p),
            ]),
          ),
        ),
      ]),
    );
  }
}
