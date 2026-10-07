import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import '../widgets/common.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(children: [
        Positioned.fill(child: RoutePattern(color: BrandColors.amber.withValues(alpha: context.isDarkTheme ? 0.08 : 0.16))),
        const Center(child: FadeSlideIn(child: Brand())),
        const Positioned(left: 0, right: 0, bottom: 0, child: SafeArea(child: Padding(padding: EdgeInsets.only(bottom: 16), child: CreditFooter()))),
      ]),
    );
  }
}
