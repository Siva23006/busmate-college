import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../core/config.dart';
import '../providers/bus_provider.dart';
import '../providers/session_provider.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final p = context.watch<BusProvider>();
    final session = context.watch<SessionProvider>();
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(children: [
        SwitchListTile(
          title: const Text('Bus notifications'),
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
        const Divider(),
        ListTile(leading: const Icon(Icons.person_outline), title: Text(session.user?.name ?? '-'), subtitle: const Text('Student')),
        ListTile(leading: const Icon(Icons.dns_outlined), title: const Text('Server'), subtitle: Text(AppConfig.apiUrl)),
        const ListTile(
          leading: Icon(Icons.info_outline),
          title: Text('About BusMate'),
          subtitle: Text('College transportation technology prototype. Arrival times are estimates, not guarantees.'),
        ),
        const Divider(),
        ListTile(
          leading: const Icon(Icons.logout, color: Colors.red),
          title: const Text('Log out', style: TextStyle(color: Colors.red)),
          onTap: () {
            Navigator.of(context).popUntil((r) => r.isFirst);
            session.logout();
          },
        ),
      ]),
    );
  }
}
