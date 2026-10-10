import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../providers/trip_provider.dart';
import '../theme/app_theme.dart';
import 'common.dart';

/// SOS and "message students" actions for the driver.
///
/// Battery: everything here is static. The only animation is the HoldButton fill, which runs
/// only while the driver's finger is down.

const String sosSentText = 'SOS sent. The transport office has been alerted.';

/// Opens the SOS sheet. Sending needs a press-and-hold inside the sheet, so a stray tap on the
/// round SOS button never alerts anyone. [busId] is used when no trip is running.
Future<void> showSosSheet(BuildContext context, {int? busId}) async {
  final trips = context.read<TripProvider>();
  final messenger = ScaffoldMessenger.of(context);
  final sent = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => _SosSheet(trips: trips, busId: busId),
  );
  if (sent == true) {
    messenger.showSnackBar(const SnackBar(content: Text(sosSentText), backgroundColor: BrandColors.green));
  }
}

/// Opens the "message students" sheet (traffic / breakdown / running late). Needs a running trip.
Future<void> showDelaySheet(BuildContext context) async {
  final trips = context.read<TripProvider>();
  final messenger = ScaffoldMessenger.of(context);
  final sent = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => _DelaySheet(trips: trips),
  );
  if (sent == true) {
    messenger.showSnackBar(const SnackBar(content: Text('Sent to students'), backgroundColor: BrandColors.green));
  }
}

/// Round red "SOS" button. A tap only opens the SOS sheet (sending needs a hold there).
class SosButton extends StatelessWidget {
  const SosButton({super.key, this.size = 56, this.busId});
  final double size;

  /// Bus to report when no trip is running (home screen).
  final int? busId;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: 'Emergency SOS',
      child: Material(
        color: BrandColors.red,
        shape: const CircleBorder(side: BorderSide(color: Colors.white, width: 2)),
        elevation: 4,
        shadowColor: Colors.black45,
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: () => showSosSheet(context, busId: busId),
          child: SizedBox(
            width: size,
            height: size,
            child: Center(
              child: Text(
                'SOS',
                style: TextStyle(color: Colors.white, fontSize: size * 0.3, fontWeight: FontWeight.w900, letterSpacing: 0.5),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Padding that keeps the sheet above the keyboard.
EdgeInsets _sheetPadding(BuildContext context) =>
    EdgeInsets.fromLTRB(Ui.pad, 0, Ui.pad, Ui.pad + MediaQuery.viewInsetsOf(context).bottom);

// ============================================================================
// SOS
// ============================================================================

class _SosSheet extends StatefulWidget {
  const _SosSheet({required this.trips, this.busId});
  final TripProvider trips;
  final int? busId;

  @override
  State<_SosSheet> createState() => _SosSheetState();
}

class _SosSheetState extends State<_SosSheet> {
  static const _reasons = ['Accident', 'Medical', 'Breakdown', 'Other'];
  final _note = TextEditingController();
  String? _reason;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final text = _note.text.trim();
    final reason = _reason;
    final note = reason == null ? text : (text.isEmpty ? reason : '$reason: $text');
    try {
      await widget.trips.sendSos(note: note.isEmpty ? null : note, busId: widget.busId);
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not send SOS. Check your internet and try again, or call the transport office.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hint = context.hint;
    return SingleChildScrollView(
      padding: _sheetPadding(context),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          const IconTile(icon: Icons.warning_amber_rounded, color: BrandColors.red, size: 44, solid: true),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Emergency SOS', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
              const SizedBox(height: 2),
              Text('Alerts the transport office with your bus and location.', style: TextStyle(fontSize: 13, color: hint)),
            ]),
          ),
        ]),
        const SizedBox(height: 16),
        const SectionLabel('What happened? (optional)'),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final r in _reasons)
            ChoiceChip(
              label: Text(r, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
              selected: _reason == r,
              showCheckmark: false,
              selectedColor: BrandColors.red.withValues(alpha: 0.22),
              materialTapTargetSize: MaterialTapTargetSize.padded,
              onSelected: _busy ? null : (on) => setState(() => _reason = on ? r : null),
            ),
        ]),
        const SizedBox(height: 12),
        TextField(
          controller: _note,
          enabled: !_busy,
          maxLines: 2,
          maxLength: 200,
          textCapitalization: TextCapitalization.sentences,
          decoration: const InputDecoration(labelText: 'Note (optional)', hintText: 'e.g. near the main junction'),
        ),
        if (_error != null) ...[const SizedBox(height: 4), ErrorBanner(_error!), const SizedBox(height: 8)],
        const SizedBox(height: 8),
        HoldButton(
          label: 'HOLD TO SEND SOS',
          icon: Icons.warning_amber_rounded,
          busy: _busy,
          hold: const Duration(milliseconds: 1500),
          onConfirmed: _send,
        ),
        const SizedBox(height: 6),
        Text('Press and hold for 1.5 seconds to send.', textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: hint)),
        const SizedBox(height: 4),
        TextButton(onPressed: _busy ? null : () => Navigator.of(context).pop(false), child: const Text('Cancel')),
      ]),
    );
  }
}

// ============================================================================
// Message students (delay)
// ============================================================================

class _DelayKind {
  const _DelayKind(this.kind, this.emoji, this.title, this.subtitle, {this.defaultMinutes});
  final String kind;
  final String emoji;
  final String title;
  final String subtitle;

  /// null = no minutes pre-selected (the driver may still pick some).
  final int? defaultMinutes;
}

const _delayKinds = [
  _DelayKind('TRAFFIC', '🚦', 'Heavy traffic', 'Bus is slowed down by traffic', defaultMinutes: 10),
  _DelayKind('BREAKDOWN', '🔧', 'Breakdown', 'Bus has a problem (office is alerted too)'),
  _DelayKind('LATE', '⏰', 'Running late', 'Bus will reach stops later than usual', defaultMinutes: 10),
  _DelayKind('OTHER', '💬', 'Other message', 'Type your own message below'),
];

const _minuteChoices = [5, 10, 15, 20, 30];

class _DelaySheet extends StatefulWidget {
  const _DelaySheet({required this.trips});
  final TripProvider trips;

  @override
  State<_DelaySheet> createState() => _DelaySheetState();
}

class _DelaySheetState extends State<_DelaySheet> {
  final _note = TextEditingController();
  _DelayKind _kind = _delayKinds.first;
  int? _minutes = _delayKinds.first.defaultMinutes;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  void _pick(_DelayKind k) {
    if (_busy || identical(k, _kind)) return;
    setState(() {
      _kind = k;
      _minutes = k.defaultMinutes;
      _error = null;
    });
  }

  Future<void> _send() async {
    if (_busy) return;
    final note = _note.text.trim();
    if (_kind.kind == 'OTHER' && note.isEmpty) {
      setState(() => _error = 'Type a message for the students.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.trips.sendDelay(kind: _kind.kind, minutes: _kind.kind == 'OTHER' ? null : _minutes, note: note.isEmpty ? null : note);
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not send. Check your internet and try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hint = context.hint;
    final showMinutes = _kind.kind != 'OTHER';
    return SingleChildScrollView(
      padding: _sheetPadding(context),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Text('Message students', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
        const SizedBox(height: 2),
        Text('Students on this bus get a notification.', style: TextStyle(fontSize: 13, color: hint)),
        const SizedBox(height: 14),
        for (final k in _delayKinds) ...[
          _KindTile(kind: k, selected: identical(k, _kind), onTap: () => _pick(k)),
          const SizedBox(height: 8),
        ],
        if (showMinutes) ...[
          const SizedBox(height: 6),
          SectionLabel(_kind.kind == 'BREAKDOWN' ? 'Expected delay (optional)' : 'About how many minutes?'),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final m in _minuteChoices)
              ChoiceChip(
                label: Text('$m min', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                selected: _minutes == m,
                showCheckmark: false,
                selectedColor: BrandColors.amber.withValues(alpha: 0.3),
                materialTapTargetSize: MaterialTapTargetSize.padded,
                onSelected: _busy ? null : (on) => setState(() => _minutes = on ? m : null),
              ),
          ]),
        ],
        const SizedBox(height: 12),
        TextField(
          controller: _note,
          enabled: !_busy,
          maxLines: 2,
          maxLength: 200,
          textCapitalization: TextCapitalization.sentences,
          decoration: InputDecoration(
            labelText: _kind.kind == 'OTHER' ? 'Message' : 'Note (optional)',
            hintText: 'e.g. Waiting at the signal near the bridge',
          ),
        ),
        if (_error != null) ...[const SizedBox(height: 4), ErrorBanner(_error!), const SizedBox(height: 8)],
        const SizedBox(height: 8),
        FilledButton.icon(
          style: FilledButton.styleFrom(backgroundColor: BrandColors.amber, foregroundColor: BrandColors.ink),
          onPressed: _busy ? null : _send,
          icon: _busy
              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.5, color: BrandColors.ink))
              : const Icon(Icons.send_rounded, size: 22),
          label: const Text('Send to students'),
        ),
        const SizedBox(height: 4),
        TextButton(onPressed: _busy ? null : () => Navigator.of(context).pop(false), child: const Text('Cancel')),
      ]),
    );
  }
}

class _KindTile extends StatelessWidget {
  const _KindTile({required this.kind, required this.selected, required this.onTap});
  final _DelayKind kind;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? BrandColors.amber.withValues(alpha: context.isDarkTheme ? 0.18 : 0.22) : context.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: selected ? BrandColors.amber : context.outline, width: selected ? 2 : 1),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 64),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Row(children: [
              Text(kind.emoji, style: const TextStyle(fontSize: 26)),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                  Text(kind.title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 2),
                  Text(kind.subtitle, style: TextStyle(fontSize: 12.5, color: context.hint)),
                ]),
              ),
              if (selected) Icon(Icons.check_circle_rounded, color: context.amberText, size: 24),
            ]),
          ),
        ),
      ),
    );
  }
}
