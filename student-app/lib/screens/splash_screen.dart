import 'package:flutter/material.dart';

import '../widgets/common.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(children: [
        const Positioned.fill(child: RouteLines(opacity: 0.8)),
        Center(
          child: TweenAnimationBuilder<double>(
            tween: Tween<double>(begin: 0, end: 1),
            duration: const Duration(milliseconds: 700),
            curve: Curves.easeOutCubic,
            builder: (context, v, child) => Opacity(
              opacity: v,
              child: Transform.scale(scale: 0.92 + 0.08 * v, child: child),
            ),
            child: const Brand(),
          ),
        ),
        const Positioned(
          left: 16,
          right: 16,
          bottom: 0,
          child: SafeArea(
            top: false,
            child: Padding(
              padding: EdgeInsets.only(bottom: 18),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4)),
                SizedBox(height: 22),
                CreditFooter(),
              ]),
            ),
          ),
        ),
      ]),
    );
  }
}
