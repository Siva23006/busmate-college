import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/bus_provider.dart';
import '../theme/app_theme.dart';
import '../utils/status.dart';
import '../widgets/app_bar.dart';
import '../widgets/bus_map.dart';
import '../widgets/common.dart';
import '../widgets/journey.dart';

/// Full-screen live map with a compact arrival card.
class LiveMapScreen extends StatelessWidget {
  const LiveMapScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final p = context.watch<BusProvider>();
    final pal = Palette.of(context);
    final top = MediaQuery.paddingOf(context).top;
    final bottom = MediaQuery.paddingOf(context).bottom;
    final (live, liveLevel) = liveLabel(p.liveState);
    const cardHeight = 200.0;

    return Scaffold(
      body: Stack(children: [
        Positioned.fill(child: BusMapView(bottomPadding: cardHeight + bottom, topPadding: top + 60, controlsBottom: cardHeight + bottom + 16)),
        Positioned(
          left: 4,
          right: 12,
          top: top + 4,
          child: Row(children: [
            const BmBackButton(onMap: true),
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: pal.card.withValues(alpha: 0.97),
                  borderRadius: BorderRadius.circular(Ui.radius),
                  border: Border.all(color: pal.line),
                  boxShadow: pal.floatShadow,
                ),
                child: Row(children: [
                  Expanded(
                    child: Text(p.bus?.number ?? 'Live map',
                        maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: pal.text, fontSize: 15, fontWeight: FontWeight.w700)),
                  ),
                  if (p.isSimulation) ...[const DemoTag(), const SizedBox(width: 6)],
                  PhaseChip(label: live, level: liveLevel, pulse: liveLevel == Level.good && p.hasActiveTrip),
                ]),
              ),
            ),
          ]),
        ),
        Positioned(
          left: 12,
          right: 12,
          bottom: bottom + 12,
          child: FadeSlideIn(
            offsetY: 24,
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: pal.bg,
                borderRadius: BorderRadius.circular(Ui.radiusLarge),
                border: Border.all(color: pal.line),
                boxShadow: pal.floatShadow,
              ),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Padding(padding: const EdgeInsets.fromLTRB(4, 2, 4, 10), child: RouteHeader(p: p)),
                BigEtaCard(p: p),
              ]),
            ),
          ),
        ),
      ]),
    );
  }
}
