import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'models/models.dart';
import 'providers/bus_provider.dart';
import 'providers/session_provider.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'screens/splash_screen.dart';
import 'theme/app_theme.dart';

final messengerKey = GlobalKey<ScaffoldMessengerState>();

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final session = SessionProvider();
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: session),
        ChangeNotifierProvider(create: (_) => BusProvider(session.api)),
      ],
      child: const BusMateStudentApp(),
    ),
  );
}

class BusMateStudentApp extends StatelessWidget {
  const BusMateStudentApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BusMate',
      debugShowCheckedModeBanner: false,
      scaffoldMessengerKey: messengerKey,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.system,
      home: const RootGate(),
    );
  }
}

class RootGate extends StatefulWidget {
  const RootGate({super.key});
  @override
  State<RootGate> createState() => _RootGateState();
}

class _RootGateState extends State<RootGate> {
  bool _splashDone = false;
  bool _started = false;
  late final SessionProvider _session;
  late final BusProvider _bus;
  StreamSubscription<AppNotification>? _notifSub;

  @override
  void initState() {
    super.initState();
    _session = context.read<SessionProvider>();
    _bus = context.read<BusProvider>();
    _session.addListener(_onSession);
    Future.wait([_session.restore(), Future<void>.delayed(const Duration(milliseconds: 1200))]).then((_) {
      if (mounted) setState(() => _splashDone = true);
    });
    // In-app banner for notifications pushed over Socket.IO.
    _notifSub = _bus.incoming.listen((n) {
      messengerKey.currentState?.showSnackBar(SnackBar(
        content: Text('${n.title}\n${n.message}'),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 6),
      ));
    });
  }

  void _onSession() {
    if (_session.state == SessionState.loggedIn && !_started && _session.token != null) {
      _started = true;
      _bus.start(_session.token!);
    } else if (_session.state == SessionState.loggedOut && _started) {
      _started = false;
      _bus.reset();
    }
  }

  @override
  void dispose() {
    _session.removeListener(_onSession);
    _notifSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    if (!_splashDone || session.state == SessionState.unknown) return const SplashScreen();
    if (session.state == SessionState.loggedOut) return const LoginScreen();
    return const HomeScreen();
  }
}
