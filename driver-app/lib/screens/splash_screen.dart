import 'package:flutter/material.dart';

import '../widgets/common.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: Brand()),
    );
  }
}
