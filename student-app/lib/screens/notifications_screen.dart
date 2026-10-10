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

  Future<void> _clearAll(BusProvider p) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Clear all alerts?'),
        content: const Text('This removes every message from this list.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Clear all', style: TextStyle(color: BrandColors.red))),
        ],
      ),
    );
    if (ok == true) {
      try {
        await p.clearNotifications();
      } catch (_) {
        await p.loadNotifications();
      }
    }
  }

  static String _dayKey(DateTime d) => '${d.year}-${d.month}-${d.day}';

  static String _dayTitle(DateTime d) {
    final now = DateTime.now();
    final yesterday = now.subtract(const Duration(days: 1));
    if (_dayKey(d) == _dayKey(now)) return 'Today';
    if (_dayKey(d) == _dayKey(yesterday)) return 'Yesterday';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${d.day} ${months[d.month - 1]} ${d.year}';
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<BusProvider>();
    final pal = Palette.of(context);
    final count = p.notifications.length;

    // Build "Today / Yesterday / date" sections (list is newest first).
    final rows = <Widget>[];
    String? lastKey;
    var i = 0;
    for (final n in p.notifications) {
      final local = n.createdAt.toLocal();
      final key = _dayKey(local);
      if (key != lastKey) {
        lastKey = key;
        rows.add(Padding(
          padding: EdgeInsets.fromLTRB(4, rows.isEmpty ? 4 : 14, 4, 8),
          child: Text(_dayTitle(local).toUpperCase(),
              style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, letterSpacing: 1.2, color: pal.muted)),
        ));
      }
      rows.add(Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Dismissible(
          key: ValueKey<int>(n.id),
          direction: DismissDirection.endToStart,
          onDismissed: (_) => p.removeNotification(n.id),
          background: Container(
            alignment: Alignment.centerRight,
            padding: const EdgeInsets.only(right: 20),
            decoration: BoxDecoration(color: BrandColors.red.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(16)),
            child: const Icon(Icons.delete_outline_rounded, color: BrandColors.red),
          ),
          child: FadeSlideIn(index: i < 8 ? i : 0, child: _AlertCard(n: n, style: _style(n.type))),
        ),
      ));
      i++;
    }

    return Scaffold(
      appBar: bmAppBar(
        context,
        'Alerts',
        subtitle: count == 0 ? 'Trip started, approaching and reached' : '$count message${count == 1 ? '' : 's'} · swipe left to remove',
        actions: [
          if (count > 0)
            IconButton(
              tooltip: 'Clear all',
              icon: const Icon(Icons.delete_sweep_rounded),
              onPressed: () => _clearAll(p),
            ),
          const SizedBox(width: 4),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: p.loadNotifications,
        child: count == 0
            ? ListView(padding: const EdgeInsets.fromLTRB(16, 24, 16, 24), children: [
                FadeSlideIn(
                  child: BmCard(
                    padding: const EdgeInsets.fromLTRB(20, 28, 20, 24),
                    child: Column(children: [
                      const IconTile(icon: Icons.notifications_none_rounded, color: BrandColors.indigo, size: 52),
                      const SizedBox(height: 14),
                      Text('No alerts', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: pal.text)),
                      const SizedBox(height: 4),
                      Text('You will be told when your bus starts, is near your stop, and arrives.',
                          textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: pal.muted, height: 1.4)),
                    ]),
                  ),
                ),
              ])
            : ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 24), children: rows),
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
              Text(clockTime(n.createdAt.toLocal()), style: TextStyle(fontSize: 11, color: pal.muted)),
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
