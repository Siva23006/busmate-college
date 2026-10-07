import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../models/models.dart';
import '../providers/bus_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/app_bar.dart';
import '../widgets/common.dart';

class SelectBusScreen extends StatefulWidget {
  const SelectBusScreen({super.key});
  @override
  State<SelectBusScreen> createState() => _SelectBusScreenState();
}

class _SelectBusScreenState extends State<SelectBusScreen> {
  late Future<List<BusInfo>> _future;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _future = context.read<BusProvider>().listBuses();
  }

  Future<void> _pick(BusInfo b) async {
    setState(() => _busy = true);
    try {
      await context.read<BusProvider>().chooseBus(b.id);
      if (mounted) Navigator.pop(context);
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final current = context.watch<BusProvider>().bus?.id;
    final pal = Palette.of(context);
    return Scaffold(
      appBar: bmAppBar(context, 'Select your bus', subtitle: 'Choose the bus you travel on'),
      body: Column(children: [
        AnimatedSize(
          duration: const Duration(milliseconds: 200),
          child: _busy ? const LinearProgressIndicator(minHeight: 2) : const SizedBox(width: double.infinity),
        ),
        Expanded(
          child: FutureBuilder<List<BusInfo>>(
            future: _future,
            builder: (context, snap) {
              if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator(strokeWidth: 2.5));
              if (snap.hasError) {
                final err = snap.error;
                return Padding(
                  padding: const EdgeInsets.all(16),
                  child: Align(
                    alignment: Alignment.topCenter,
                    child: ErrorBanner(err is ApiException ? err.message : err.toString(),
                        onRetry: () => setState(() => _future = context.read<BusProvider>().listBuses())),
                  ),
                );
              }
              final buses = snap.data!;
              if (buses.isEmpty) {
                return Center(child: Text('No buses available yet.', style: TextStyle(fontSize: 13.5, color: pal.muted)));
              }
              return ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                itemCount: buses.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, i) {
                  final b = buses[i];
                  final running = b.activeTripId != null;
                  final selected = b.id == current;
                  return FadeSlideIn(
                    index: i < 8 ? i : 0,
                    child: BmCard(
                      radius: 16,
                      padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                      borderColor: selected ? BrandColors.amber : null,
                      onTap: _busy ? null : () => _pick(b),
                      child: Row(children: [
                        IconTile(
                          icon: Icons.directions_bus_rounded,
                          color: selected ? BrandColors.amber : (pal.dark ? BrandColors.indigo : BrandColors.ink),
                          filled: selected,
                          size: 40,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Row(children: [
                              Flexible(
                                child: Text(b.number,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: pal.text)),
                              ),
                              if (b.isDemo) ...[const SizedBox(width: 8), const DemoTag()],
                            ]),
                            const SizedBox(height: 2),
                            Text('${b.routeName ?? 'No route'}${b.isMyRoute ? ' · your route' : ''}',
                                maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, color: pal.muted)),
                          ]),
                        ),
                        const SizedBox(width: 8),
                        selected
                            ? const Icon(Icons.check_circle_rounded, color: BrandColors.green, size: 22)
                            : PhaseChip(label: running ? 'RUNNING' : 'IDLE', level: running ? Level.good : Level.warn, pulse: running),
                      ]),
                    ),
                  );
                },
              );
            },
          ),
        ),
      ]),
    );
  }
}
