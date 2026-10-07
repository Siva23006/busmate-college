import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../models/models.dart';
import '../providers/bus_provider.dart';
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
    return Scaffold(
      appBar: AppBar(title: const Text('Select bus')),
      body: FutureBuilder<List<BusInfo>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
          if (snap.hasError) {
            return Padding(
              padding: const EdgeInsets.all(20),
              child: ErrorBanner(snap.error.toString(), onRetry: () => setState(() => _future = context.read<BusProvider>().listBuses())),
            );
          }
          final buses = snap.data!;
          if (buses.isEmpty) return const Center(child: Text('No buses available yet.'));
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: buses.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, i) {
              final b = buses[i];
              final running = b.activeTripId != null;
              return Card(
                child: ListTile(
                  enabled: !_busy,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  leading: const Icon(Icons.directions_bus_rounded, size: 34),
                  title: Row(children: [
                    Text(b.number, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                    const SizedBox(width: 8),
                    if (b.isDemo) const DemoTag(),
                  ]),
                  subtitle: Text('${b.routeName ?? 'No route'}${b.isMyRoute ? ' · your route' : ''}'),
                  trailing: b.id == current
                      ? const Icon(Icons.check_circle, color: Colors.green)
                      : PhaseChip(label: running ? 'RUNNING' : 'IDLE', level: running ? Level.good : Level.warn),
                  onTap: () => _pick(b),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
