import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../providers/bus_provider.dart';
import '../theme/app_theme.dart';
import 'home_screen.dart';
import 'notifications_screen.dart';
import 'route_screen.dart';
import 'settings_screen.dart';

/// Student app frame: Live / Route / Alerts / Profile tabs at the bottom.
/// The phone's back button returns to the Live tab first, and asks twice before closing the app.
class MainShell extends StatefulWidget {
  const MainShell({super.key});

  /// Current tab; other screens can switch it (e.g. the bell on the Live tab).
  static final ValueNotifier<int> tab = ValueNotifier<int>(0);

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  DateTime? _lastBack;

  @override
  void initState() {
    super.initState();
    MainShell.tab.value = 0;
  }

  void _onBack() {
    if (MainShell.tab.value != 0) {
      MainShell.tab.value = 0;
      return;
    }
    final now = DateTime.now();
    if (_lastBack != null && now.difference(_lastBack!) < const Duration(seconds: 2)) {
      SystemNavigator.pop();
      return;
    }
    _lastBack = now;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(const SnackBar(content: Text('Press back again to close BusMate'), duration: Duration(seconds: 2)));
  }

  @override
  Widget build(BuildContext context) {
    final unread = context.select<BusProvider, int>((p) => p.unread);
    return ValueListenableBuilder<int>(
      valueListenable: MainShell.tab,
      builder: (context, index, _) => PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) _onBack();
        },
        child: Scaffold(
          body: IndexedStack(index: index, children: const [
            HomeScreen(),
            RouteScreen(),
            NotificationsScreen(),
            SettingsScreen(),
          ]),
          bottomNavigationBar: NavigationBar(
            selectedIndex: index,
            height: 68,
            indicatorColor: BrandColors.amber,
            onDestinationSelected: (i) => MainShell.tab.value = i,
            destinations: [
              const NavigationDestination(icon: Icon(Icons.map_outlined), selectedIcon: Icon(Icons.map_rounded, color: BrandColors.ink), label: 'Live'),
              const NavigationDestination(icon: Icon(Icons.route_outlined), selectedIcon: Icon(Icons.route_rounded, color: BrandColors.ink), label: 'Route'),
              NavigationDestination(
                icon: Badge(isLabelVisible: unread > 0, label: Text('$unread'), child: const Icon(Icons.notifications_none_rounded)),
                selectedIcon: const Icon(Icons.notifications_rounded, color: BrandColors.ink),
                label: 'Alerts',
              ),
              const NavigationDestination(icon: Icon(Icons.person_outline_rounded), selectedIcon: Icon(Icons.person_rounded, color: BrandColors.ink), label: 'Profile'),
            ],
          ),
        ),
      ),
    );
  }
}
