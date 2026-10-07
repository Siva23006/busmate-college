import 'package:flutter/material.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:provider/provider.dart';

import 'providers/session_provider.dart';
import 'providers/trip_provider.dart';
import 'screens/active_trip_screen.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'screens/splash_screen.dart';
import 'screens/trip_completed_screen.dart';
import 'theme/app_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // Lets the background trip-tracking service send GPS / ETA updates to the screen.
  FlutterForegroundTask.initCommunicationPort();
  final session = SessionProvider();
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: session),
        ChangeNotifierProvider(create: (_) => TripProvider(session.api)),
        ChangeNotifierProvider(create: (_) => ThemeController()..load()),
      ],
      child: const BusMateDriverApp(),
    ),
  );
}

class BusMateDriverApp extends StatelessWidget {
  const BusMateDriverApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BusMate Driver',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: context.watch<ThemeController>().mode, // dark by default
      home: const RootGate(),
    );
  }
}

/// Picks the screen from login + trip state, so the driver never navigates by hand.
class RootGate extends StatefulWidget {
  const RootGate({super.key});
  @override
  State<RootGate> createState() => _RootGateState();
}

class _RootGateState extends State<RootGate> {
  bool _splashDone = false;
  late final SessionProvider _session;
  late final TripProvider _trips;

  @override
  void initState() {
    super.initState();
    final session = _session = context.read<SessionProvider>();
    _trips = context.read<TripProvider>();
    Future.wait([
      session.restore(),
      Future<void>.delayed(const Duration(milliseconds: 1200)), // brief splash
    ]).then((_) {
      if (mounted) setState(() => _splashDone = true);
    });
    session.addListener(_onSession);
  }

  void _onSession() {
    if (_session.state == SessionState.loggedOut) _trips.reset();
  }

  @override
  void dispose() {
    _session.removeListener(_onSession);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final trips = context.watch<TripProvider>();
    final Widget screen;
    if (!_splashDone || session.state == SessionState.unknown) {
      screen = const SplashScreen(key: ValueKey('splash'));
    } else if (session.state == SessionState.loggedOut) {
      screen = const LoginScreen(key: ValueKey('login'));
    } else if (trips.activeTrip != null) {
      screen = const ActiveTripScreen(key: ValueKey('active'));
    } else if (trips.lastCompleted != null) {
      screen = const TripCompletedScreen(key: ValueKey('completed'));
    } else {
      screen = const HomeScreen(key: ValueKey('home'));
    }
    // Screens cross-fade and rise slightly instead of snapping when the trip state changes.
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 380),
      switchInCurve: Curves.easeOutCubic,
      switchOutCurve: Curves.easeIn,
      transitionBuilder: (child, animation) => FadeTransition(
        opacity: animation,
        child: SlideTransition(position: Tween<Offset>(begin: const Offset(0, 0.03), end: Offset.zero).animate(animation), child: child),
      ),
      child: screen,
    );
  }
}
