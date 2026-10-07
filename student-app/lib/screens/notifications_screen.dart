import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/bus_provider.dart';
import '../widgets/app_bar.dart';
import 'main_shell.dart';
import '../utils/format.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  late final BusProvider _p;

  @override
  void initState() {
    super.initState();
    _p = context.read<BusProvider>();
    // As a tab it is built in the background: only mark alerts read when the student opens it.
    MainShell.tab.addListener(_onTab);
    _p.loadNotifications().then((_) {
      if (mounted && _visible) _p.markAllRead();
    });
  }

  bool get _visible => Navigator.of(context).canPop() || MainShell.tab.value == 2;

  void _onTab() {
    if (MainShell.tab.value == 2) _p.loadNotifications().then((_) => _p.markAllRead());
  }

  @override
  void dispose() {
    MainShell.tab.removeListener(_onTab);
    super.dispose();
  }

  IconData _icon(String type) => switch (type) {
        'TRIP_STARTED' => Icons.play_circle_outline,
        'NEAR_1KM' || 'APPROACHING' => Icons.near_me_outlined,
        'REACHED_STOP' => Icons.place,
        'REACHED_COLLEGE' => Icons.school_outlined,
        _ => Icons.notifications_none,
      };

  @override
  Widget build(BuildContext context) {
    final p = context.watch<BusProvider>();
    return Scaffold(
      appBar: bmAppBar(context, 'Alerts', subtitle: 'Trip started, approaching and reached messages'),
      body: RefreshIndicator(
        onRefresh: p.loadNotifications,
        child: p.notifications.isEmpty
            ? ListView(children: [
                Padding(
                  padding: const EdgeInsets.all(48),
                  child: Column(children: [
                    Icon(Icons.notifications_none_rounded, size: 56, color: Theme.of(context).hintColor),
                    const SizedBox(height: 12),
                    const Text('No alerts yet', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 4),
                    Text('You will be told when your bus starts, is near your stop, and arrives.',
                        textAlign: TextAlign.center, style: TextStyle(color: Theme.of(context).hintColor)),
                  ]),
                ),
              ])
            : ListView.separated(
                itemCount: p.notifications.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, i) {
                  final n = p.notifications[i];
                  return ListTile(
                    leading: Icon(_icon(n.type)),
                    title: Text(n.title, style: TextStyle(fontWeight: n.read ? FontWeight.w500 : FontWeight.w800)),
                    subtitle: Text(n.message),
                    trailing: Text(agoText(n.createdAt), style: TextStyle(color: Theme.of(context).hintColor, fontSize: 12)),
                  );
                },
              ),
      ),
    );
  }
}
