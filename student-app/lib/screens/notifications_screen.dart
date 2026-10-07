import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/bus_provider.dart';
import '../utils/format.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    final p = context.read<BusProvider>();
    p.loadNotifications().then((_) => p.markAllRead());
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
      appBar: AppBar(title: const Text('Notifications')),
      body: RefreshIndicator(
        onRefresh: p.loadNotifications,
        child: p.notifications.isEmpty
            ? ListView(children: const [Padding(padding: EdgeInsets.all(48), child: Center(child: Text('No notifications yet.')))])
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
