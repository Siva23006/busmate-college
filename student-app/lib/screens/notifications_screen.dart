import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../providers/bus_provider.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/app_bar.dart';
import '../widgets/common.dart';
import 'main_shell.dart';

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

  (IconData, Color) _style(String type) => switch (type) {
        'TRIP_STARTED' => (Icons.play_arrow_rounded, BrandColors.green),
        'NEAR_1KM' || 'APPROACHING' => (Icons.near_me_rounded, BrandColors.amber),
        'REACHED_STOP' => (Icons.place_rounded, BrandColors.amber),
        'REACHED_COLLEGE' => (Icons.school_rounded, BrandColors.indigo),
        'TRIP_COMPLETED' => (Icons.check_circle_rounded, BrandColors.green),
        'DELAY' || 'ALERT' || 'EMERGENCY' => (Icons.warning_amber_rounded, BrandColors.red),
        _ => (Icons.notifications_rounded, BrandColors.indigo),
      };

  @override
  Widget build(BuildContext context) {
    final p = context.watch<BusProvider>();
    final pal = Palette.of(context);
    final count = p.notifications.length;
    return Scaffold(
      appBar: bmAppBar(context, 'Alerts', subtitle: count == 0 ? 'Trip started, approaching and reached' : '$count message${count == 1 ? '' : 's'}'),
      body: RefreshIndicator(
        onRefresh: p.loadNotifications,
        child: p.notifications.isEmpty
            ? ListView(padding: const EdgeInsets.fromLTRB(16, 24, 16, 24), children: [
                FadeSlideIn(
                  child: BmCard(
                    padding: const EdgeInsets.fromLTRB(20, 28, 20, 24),
                    child: Column(children: [
                      const IconTile(icon: Icons.notifications_none_rounded, color: BrandColors.indigo, size: 52),
                      const SizedBox(height: 14),
                      Text('No alerts yet', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: pal.text)),
                      const SizedBox(height: 4),
                      Text('You will be told when your bus starts, is near your stop, and arrives.',
                          textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: pal.muted, height: 1.4)),
                    ]),
                  ),
                ),
              ])
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                itemCount: count,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, i) => FadeSlideIn(
                  key: ValueKey<int>(p.notifications[i].id),
                  index: i < 8 ? i : 0,
                  child: _AlertCard(n: p.notifications[i], style: _style(p.notifications[i].type)),
                ),
              ),
      ),
    );
  }
}

class _AlertCard extends StatelessWidget {
  const _AlertCard({required this.n, required this.style});
  final AppNotification n;
  final (IconData, Color) style;

  @override
  Widget build(BuildContext context) {
    final pal = Palette.of(context);
    final (icon, color) = style;
    return BmCard(
      padding: const EdgeInsets.fromLTRB(12, 12, 14, 12),
      radius: 16,
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        IconTile(icon: icon, color: color, size: 38),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(
                child: Text(n.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 14, fontWeight: n.read ? FontWeight.w600 : FontWeight.w800, color: pal.text)),
              ),
              const SizedBox(width: 8),
              Text(agoText(n.createdAt), style: TextStyle(fontSize: 11, color: pal.muted)),
              if (!n.read) ...[
                const SizedBox(width: 6),
                Container(width: 7, height: 7, decoration: const BoxDecoration(color: BrandColors.amber, shape: BoxShape.circle)),
              ],
            ]),
            if (n.message.isNotEmpty) ...[
              const SizedBox(height: 3),
              Text(n.message, style: TextStyle(fontSize: 12.5, color: pal.muted, height: 1.35)),
            ],
          ]),
        ),
      ]),
    );
  }
}
