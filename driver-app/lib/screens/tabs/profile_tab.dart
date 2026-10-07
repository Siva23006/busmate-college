import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../providers/session_provider.dart';
import '../../providers/trip_provider.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

/// Asks before logging out.
Future<void> confirmLogout(BuildContext context) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (c) => AlertDialog(
      title: const Text('Log out?'),
      content: const Text('You will need your Driver ID and password to log in again.'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
        TextButton(
          style: TextButton.styleFrom(foregroundColor: BrandColors.red),
          onPressed: () => Navigator.pop(c, true),
          child: const Text('Log out'),
        ),
      ],
    ),
  );
  if (ok == true && context.mounted) await context.read<SessionProvider>().logout();
}

/// Driver details, assigned bus, theme switch, logout and credits.
class ProfileTab extends StatelessWidget {
  const ProfileTab({super.key, required this.buses});
  final List<BusInfo> buses;

  @override
  Widget build(BuildContext context) {
    final home = context.watch<TripProvider>().home;
    final user = context.watch<SessionProvider>().user;
    final name = home?.name ?? user?.name ?? 'Driver';
    final employeeId = home?.employeeId ?? user?.employeeId;
    final hint = context.hint;
    final initials = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).take(2).map((p) => p[0].toUpperCase()).join();

    return ListView(padding: const EdgeInsets.fromLTRB(Ui.pad, 14, Ui.pad, 28), children: [
      const Text('Profile', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
      const SizedBox(height: 16),
      FadeSlideIn(
        child: Card(
          clipBehavior: Clip.antiAlias,
          child: Stack(children: [
            Positioned.fill(child: RoutePattern(color: BrandColors.amber.withValues(alpha: context.isDarkTheme ? 0.08 : 0.14))),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(children: [
                Container(
                  width: 56,
                  height: 56,
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(color: BrandColors.amber, shape: BoxShape.circle),
                  child: Text(initials.isEmpty ? 'D' : initials,
                      style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: BrandColors.ink)),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 2),
                    Text(employeeId == null || employeeId.isEmpty ? 'Driver' : 'Driver ID $employeeId',
                        style: TextStyle(fontSize: 13, color: hint)),
                  ]),
                ),
              ]),
            ),
          ]),
        ),
      ),
      const SizedBox(height: 18),
      FadeSlideIn(
        delay: FadeSlideIn.stagger(1),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const SectionLabel('Details'),
          Card(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
              child: Column(children: [
                SummaryRow(icon: Icons.phone_rounded, label: 'Phone', value: (home?.phone?.isNotEmpty ?? false) ? home!.phone! : '-'),
                const Divider(),
                SummaryRow(icon: Icons.alternate_email_rounded, label: 'Email', value: user?.email ?? '-'),
                const Divider(),
                SummaryRow(
                  icon: Icons.directions_bus_rounded,
                  label: buses.length > 1 ? 'Assigned buses' : 'Assigned bus',
                  value: buses.isEmpty ? 'None' : buses.map((b) => b.number).join(', '),
                  highlight: buses.isNotEmpty,
                ),
                if (buses.isNotEmpty && buses.first.route != null) ...[
                  const Divider(),
                  SummaryRow(icon: Icons.route_rounded, label: 'Route', value: buses.first.route!.name),
                ],
              ]),
            ),
          ),
        ]),
      ),
      const SizedBox(height: 18),
      FadeSlideIn(
        delay: FadeSlideIn.stagger(2),
        child: const Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          SectionLabel('Appearance'),
          Card(child: ThemeSwitchTile()),
        ]),
      ),
      const SizedBox(height: 22),
      FadeSlideIn(
        delay: FadeSlideIn.stagger(3),
        child: OutlinedButton.icon(
          style: OutlinedButton.styleFrom(
            foregroundColor: BrandColors.red,
            side: BorderSide(color: BrandColors.red.withValues(alpha: 0.5)),
          ),
          onPressed: () => confirmLogout(context),
          icon: const Icon(Icons.logout_rounded, size: 20),
          label: const Text('Log out'),
        ),
      ),
      const SizedBox(height: 28),
      const CreditFooter(),
    ]);
  }
}
