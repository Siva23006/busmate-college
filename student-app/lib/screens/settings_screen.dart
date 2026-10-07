import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../core/config.dart';
import '../models/models.dart';
import '../providers/bus_provider.dart';
import '../providers/session_provider.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/app_bar.dart';
import 'main_shell.dart';
import 'select_bus_screen.dart';

/// Profile tab: who I am, my bus and stop, alerts, and log out.
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  Future<void> _logout(BuildContext context) async {
    final session = context.read<SessionProvider>();
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Log out?'),
        content: const Text('You will stop getting bus alerts on this phone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('CANCEL')),
          TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('LOG OUT', style: TextStyle(color: BrandColors.red))),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    Navigator.of(context).popUntil((r) => r.isFirst);
    session.logout();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<BusProvider>();
    final session = context.watch<SessionProvider>();
    final hint = Theme.of(context).hintColor;
    final name = p.studentName.isNotEmpty ? p.studentName : (session.user?.name ?? 'Student');
    final route = p.route;

    return Scaffold(
      appBar: bmAppBar(context, 'Profile'),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 28), children: [
        // Student card
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [BrandColors.ink3, BrandColors.ink], begin: Alignment.topLeft, end: Alignment.bottomRight),
            borderRadius: BorderRadius.circular(24),
          ),
          child: Row(children: [
            CircleAvatar(
              radius: 28,
              backgroundColor: BrandColors.amber,
              child: Text(name.isEmpty ? 'S' : name[0].toUpperCase(),
                  style: const TextStyle(color: BrandColors.ink, fontSize: 24, fontWeight: FontWeight.w900)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(name, maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900)),
                const Text('Student', style: TextStyle(color: BrandColors.amber, fontWeight: FontWeight.w700)),
              ]),
            ),
          ]),
        ),
        const SizedBox(height: 16),

        _Section('MY BUS'),
        Card(
          child: Column(children: [
            ListTile(
              leading: const Icon(Icons.directions_bus_rounded, color: BrandColors.amber),
              title: Text(p.bus?.number ?? 'No bus selected', style: const TextStyle(fontWeight: FontWeight.w800)),
              subtitle: Text(route == null
                  ? 'Choose the bus you travel on'
                  : '${route.name}${p.bus?.driverName != null ? ' · Driver ${p.bus!.driverName}' : ''}'),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () => Navigator.push(context, MaterialPageRoute<void>(builder: (_) => const SelectBusScreen())),
            ),
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.person_pin_circle_rounded, color: BrandColors.amber),
              title: Text(p.myStopName ?? 'No stop selected', style: const TextStyle(fontWeight: FontWeight.w800)),
              subtitle: const Text('My stop: alerts are sent for this stop'),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () => MainShell.tab.value = 1,
            ),
            if (route != null) ...[
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.schedule_rounded, color: BrandColors.amber),
                title: Text('Morning ${clock12(route.timeFor(toCollege))} · Evening ${clock12(route.timeFor(fromCollege))}',
                    style: const TextStyle(fontWeight: FontWeight.w800)),
                subtitle: Text('${route.fromFor(toCollege)} ⇄ ${route.toFor(toCollege)}'),
              ),
            ],
          ]),
        ),
        const SizedBox(height: 16),

        _Section('ALERTS'),
        Card(
          child: SwitchListTile(
            secondary: const Icon(Icons.notifications_active_rounded, color: BrandColors.amber),
            title: const Text('Bus alerts', style: TextStyle(fontWeight: FontWeight.w800)),
            subtitle: const Text('Trip started, approaching your stop, reached your stop'),
            value: p.notificationsEnabled,
            onChanged: (v) async {
              try {
                await p.setNotificationsEnabled(v);
              } on ApiException catch (e) {
                if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
              }
            },
          ),
        ),
        const SizedBox(height: 16),

        _Section('ABOUT'),
        Card(
          child: Column(children: [
            ListTile(
              leading: const Icon(Icons.info_outline_rounded),
              title: const Text('BusMate · Smart College Transport'),
              subtitle: Text('Arrival times are estimates, not guarantees.', style: TextStyle(color: hint)),
            ),
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.dns_outlined),
              title: const Text('Server'),
              subtitle: Text(AppConfig.apiUrl, style: TextStyle(color: hint)),
            ),
          ]),
        ),
        const SizedBox(height: 20),
        OutlinedButton.icon(
          style: OutlinedButton.styleFrom(foregroundColor: BrandColors.red, side: const BorderSide(color: BrandColors.red)),
          onPressed: () => _logout(context),
          icon: const Icon(Icons.logout_rounded),
          label: const Text('Log out'),
        ),
      ]),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
        child: Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, letterSpacing: 1.4, color: Theme.of(context).hintColor)),
      );
}
