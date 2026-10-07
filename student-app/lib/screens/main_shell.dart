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
    final pal = Palette.of(context);
    return ValueListenableBuilder<int>(
      valueListenable: MainShell.tab,
      builder: (context, index, _) => PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) _onBack();
        },
        child: Scaffold(
          // The map tab stays put (platform view); the other tabs fade/slide in when opened.
          body: IndexedStack(index: index, children: [
            const HomeScreen(),
            _TabEntrance(active: index == 1, child: const RouteScreen()),
            _TabEntrance(active: index == 2, child: const NotificationsScreen()),
            _TabEntrance(active: index == 3, child: const SettingsScreen()),
          ]),
          bottomNavigationBar: DecoratedBox(
            decoration: BoxDecoration(border: Border(top: BorderSide(color: pal.line))),
            child: NavigationBar(
              selectedIndex: index,
              labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
              animationDuration: const Duration(milliseconds: 400),
              onDestinationSelected: (i) => MainShell.tab.value = i,
              destinations: [
                const NavigationDestination(icon: Icon(Icons.map_outlined), selectedIcon: Icon(Icons.map_rounded), label: 'Live'),
                const NavigationDestination(icon: Icon(Icons.route_outlined), selectedIcon: Icon(Icons.route_rounded), label: 'Route'),
                NavigationDestination(
                  icon: Badge(isLabelVisible: unread > 0, label: Text('$unread'), child: const Icon(Icons.notifications_none_rounded)),
                  selectedIcon: const Icon(Icons.notifications_rounded),
                  label: 'Alerts',
                ),
                const NavigationDestination(icon: Icon(Icons.person_outline_rounded), selectedIcon: Icon(Icons.person_rounded), label: 'Profile'),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Plays a short fade + rise each time its tab becomes the selected one (state is kept).
class _TabEntrance extends StatefulWidget {
  const _TabEntrance({required this.active, required this.child});
  final bool active;
  final Widget child;

  @override
  State<_TabEntrance> createState() => _TabEntranceState();
}

class _TabEntranceState extends State<_TabEntrance> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 280), value: 1);
  late final Animation<double> _curve = CurvedAnimation(parent: _c, curve: Curves.easeOutCubic);
  late final Animation<Offset> _slide = Tween<Offset>(begin: const Offset(0, 0.025), end: Offset.zero).animate(_curve);

  @override
  void didUpdateWidget(covariant _TabEntrance old) {
    super.didUpdateWidget(old);
    if (widget.active && !old.active) _c.forward(from: 0);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(opacity: _curve, child: SlideTransition(position: _slide, child: widget.child));
  }
}
