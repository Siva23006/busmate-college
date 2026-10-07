import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// One app bar style for every student screen.
/// Shows a clear round back button whenever the screen can go back.
PreferredSizeWidget bmAppBar(BuildContext context, String title, {String? subtitle, List<Widget>? actions}) {
  final canPop = Navigator.of(context).canPop();
  final pal = Palette.of(context);
  return AppBar(
    automaticallyImplyLeading: false,
    titleSpacing: canPop ? 4 : 20,
    leading: canPop ? const BmBackButton() : null,
    leadingWidth: 60,
    title: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
      Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700, color: pal.text)),
      if (subtitle != null)
        Padding(
          padding: const EdgeInsets.only(top: 1),
          child: Text(subtitle,
              maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w500, color: pal.muted)),
        ),
    ]),
    actions: actions == null ? null : [...actions, const SizedBox(width: 8)],
  );
}

/// Round back button (also used floating over full-screen maps).
class BmBackButton extends StatelessWidget {
  const BmBackButton({super.key, this.onMap = false});

  /// Floating style with a shadow for use on top of a map.
  final bool onMap;

  @override
  Widget build(BuildContext context) {
    final pal = Palette.of(context);
    return Padding(
      padding: const EdgeInsets.all(8),
      child: Center(
        widthFactor: 1,
        heightFactor: 1,
        child: DecoratedBox(
          decoration: BoxDecoration(shape: BoxShape.circle, boxShadow: onMap ? pal.floatShadow : null),
          child: Material(
            color: pal.card,
            shape: CircleBorder(side: BorderSide(color: pal.line)),
            clipBehavior: Clip.antiAlias,
            child: SizedBox(
              width: 42,
              height: 42,
              child: IconButton(
                tooltip: 'Back',
                padding: EdgeInsets.zero,
                iconSize: 20,
                icon: Icon(Icons.arrow_back_rounded, color: pal.text),
                onPressed: () => Navigator.of(context).maybePop(),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
