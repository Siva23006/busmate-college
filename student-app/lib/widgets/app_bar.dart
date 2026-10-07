import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// One app bar style for every student screen.
/// Shows a clear round back button whenever the screen can go back.
PreferredSizeWidget bmAppBar(BuildContext context, String title, {String? subtitle, List<Widget>? actions}) {
  final canPop = Navigator.of(context).canPop();
  return AppBar(
    automaticallyImplyLeading: false,
    titleSpacing: canPop ? 4 : 20,
    leading: canPop ? const BmBackButton() : null,
    title: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
      Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
      if (subtitle != null)
        Text(subtitle,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Theme.of(context).hintColor)),
    ]),
    actions: actions,
  );
}

/// Round back button (also used floating over full-screen maps).
class BmBackButton extends StatelessWidget {
  const BmBackButton({super.key, this.onMap = false});

  /// Dark filled circle for use on top of a map.
  final bool onMap;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final bg = onMap ? BrandColors.ink : (dark ? BrandColors.ink3 : const Color(0xFFE9EDF4));
    final fg = onMap || dark ? Colors.white : BrandColors.ink;
    return Padding(
      padding: const EdgeInsets.all(8),
      child: Material(
        color: bg,
        shape: const CircleBorder(),
        elevation: onMap ? 4 : 0,
        child: IconButton(
          tooltip: 'Back',
          icon: Icon(Icons.arrow_back_rounded, color: fg),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
      ),
    );
  }
}
