import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../core/config.dart';
import '../models/models.dart';
import '../providers/bus_provider.dart';
import '../providers/session_provider.dart';
import '../theme/app_theme.dart';
import '../theme/theme_controller.dart';
import '../utils/format.dart';
import '../widgets/app_bar.dart';
import '../widgets/common.dart';
import 'main_shell.dart';
import 'select_bus_screen.dart';

/// Profile tab: who I am, my bus and stop, appearance, alerts, and log out.
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  Future<void> _logout(BuildContext context) async {
    final session = context.read<SessionProvider>();
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        icon: const IconTile(icon: Icons.logout_rounded, color: BrandColors.red, size: 44),
        title: const Text('Log out?'),
        content: const Text('You will stop getting bus alerts on this phone.', textAlign: TextAlign.center),
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
    if (ok != true || !context.mounted) return;
    Navigator.of(context).popUntil((r) => r.isFirst);
    session.logout();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<BusProvider>();
    final session = context.watch<SessionProvider>();
    final theme = context.watch<ThemeController>();
    final pal = Palette.of(context);
    final name = p.studentName.isNotEmpty ? p.studentName : (session.user?.name ?? 'Student');
    final route = p.route;
    Widget divider() => Divider(height: 1, indent: 64, color: pal.line);

    return Scaffold(
      appBar: bmAppBar(context, 'Profile'),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 28), children: [
        // Student card with abstract route lines
        FadeSlideIn(
          child: BmCard(
            padding: EdgeInsets.zero,
            radius: Ui.radiusLarge,
            child: Stack(children: [
              const Positioned.fill(child: RouteLines(opacity: 0.7)),
              Padding(
                padding: const EdgeInsets.all(18),
                child: Row(children: [
                  Container(
                    width: 54,
                    height: 54,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: BrandColors.amber,
                      shape: BoxShape.circle,
                      border: Border.all(color: pal.card, width: 3),
                      boxShadow: [BoxShadow(color: BrandColors.amber.withValues(alpha: 0.35), blurRadius: 12, offset: const Offset(0, 4))],
                    ),
                    child: Text(name.isEmpty ? 'S' : name[0].toUpperCase(),
                        style: const TextStyle(color: BrandColors.ink, fontSize: 20, fontWeight: FontWeight.w800)),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: pal.text, fontSize: 18, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 2),
                      Text(p.bus == null ? 'Student' : 'Student · Bus ${p.bus!.number}',
                          style: TextStyle(color: pal.muted, fontSize: 12.5, fontWeight: FontWeight.w500)),
                    ]),
                  ),
                ]),
              ),
            ]),
          ),
        ),
        const SizedBox(height: 20),

        const SectionLabel('My bus'),
        FadeSlideIn(
          index: 1,
          child: BmCard(
            padding: EdgeInsets.zero,
            child: Column(children: [
              ListTile(
                leading: const IconTile(icon: Icons.directions_bus_rounded),
                title: Text(p.bus?.number ?? 'No bus selected'),
                subtitle: Text(route == null
                    ? 'Choose the bus you travel on'
                    : '${route.name}${p.bus?.driverName != null ? ' · Driver ${p.bus!.driverName}' : ''}'),
                trailing: Icon(Icons.chevron_right_rounded, color: pal.muted),
                onTap: () => Navigator.push(context, MaterialPageRoute<void>(builder: (_) => const SelectBusScreen())),
              ),
              divider(),
              ListTile(
                leading: const IconTile(icon: Icons.person_pin_circle_rounded, color: BrandColors.green),
                title: Text(p.myStopName ?? 'No stop selected'),
                subtitle: const Text('My stop · alerts are sent for this stop'),
                trailing: Icon(Icons.chevron_right_rounded, color: pal.muted),
                onTap: () => MainShell.tab.value = 1,
              ),
              if (route != null) ...[
                divider(),
                ListTile(
                  leading: const IconTile(icon: Icons.schedule_rounded, color: BrandColors.indigo),
                  title: Text('Morning ${clock12(route.timeFor(toCollege))} · Evening ${clock12(route.timeFor(fromCollege))}'),
                  subtitle: Text('${route.fromFor(toCollege)} ⇄ ${route.toFor(toCollege)}'),
                ),
              ],
            ]),
          ),
        ),
        const SizedBox(height: 20),

        const SectionLabel('Preferences'),
        FadeSlideIn(
          index: 2,
          child: BmCard(
            padding: EdgeInsets.zero,
            child: Column(children: [
              SwitchListTile(
                secondary: IconTile(
                  icon: theme.isDark ? Icons.dark_mode_rounded : Icons.light_mode_rounded,
                  color: theme.isDark ? BrandColors.indigo : BrandColors.amber,
                ),
                title: const Text('Dark mode'),
                subtitle: Text(theme.isDark ? 'Dark theme is on' : 'Light theme (default)'),
                value: theme.isDark,
                onChanged: theme.setDark,
              ),
              divider(),
              SwitchListTile(
                secondary: const IconTile(icon: Icons.notifications_active_rounded, color: BrandColors.red),
                title: const Text('Bus alerts'),
                subtitle: const Text('Trip started, approaching and reached your stop'),
                value: p.notificationsEnabled,
                onChanged: (v) async {
                  try {
                    await p.setNotificationsEnabled(v);
                  } on ApiException catch (e) {
                    if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
                  }
                },
              ),
            ]),
          ),
        ),
        const SizedBox(height: 20),

        const SectionLabel('About'),
        FadeSlideIn(
          index: 3,
          child: BmCard(
            padding: EdgeInsets.zero,
            child: Column(children: [
              const ListTile(
                leading: IconTile(icon: Icons.info_outline_rounded, color: BrandColors.indigo),
                title: Text('BusMate · Smart College Transport'),
                subtitle: Text('Arrival times are estimates, not guarantees.'),
              ),
              divider(),
              ListTile(
                leading: const IconTile(icon: Icons.dns_outlined, color: BrandColors.green),
                title: const Text('Server'),
                subtitle: Text(AppConfig.apiUrl, maxLines: 1, overflow: TextOverflow.ellipsis),
              ),
            ]),
          ),
        ),
        const SizedBox(height: 20),
        FadeSlideIn(
          index: 4,
          child: OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: BrandColors.red,
              side: BorderSide(color: BrandColors.red.withValues(alpha: 0.4)),
              backgroundColor: BrandColors.red.withValues(alpha: 0.05),
            ),
            onPressed: () => _logout(context),
            icon: const Icon(Icons.logout_rounded, size: 18),
            label: const Text('Log out'),
          ),
        ),
        const SizedBox(height: 28),
        const CreditFooter(),
      ]),
    );
  }
}
