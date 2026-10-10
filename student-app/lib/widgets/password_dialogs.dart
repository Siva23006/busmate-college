import 'package:flutter/material.dart';

import '../core/api_client.dart';

/// "Forgot password?" — the server asks Firebase to email a reset link to the account's email.
Future<void> showForgotPasswordDialog(BuildContext context, ApiClient api, {String initialId = ''}) {
  return showDialog<void>(context: context, builder: (_) => _ForgotDialog(api: api, initialId: initialId));
}

/// "Change password" for the logged-in user (needs the current password).
Future<void> showChangePasswordDialog(BuildContext context, ApiClient api) {
  return showDialog<void>(context: context, builder: (_) => _ChangeDialog(api: api));
}

class _ForgotDialog extends StatefulWidget {
  const _ForgotDialog({required this.api, required this.initialId});
  final ApiClient api;
  final String initialId;
  @override
  State<_ForgotDialog> createState() => _ForgotDialogState();
}

class _ForgotDialogState extends State<_ForgotDialog> {
  late final TextEditingController _id = TextEditingController(text: widget.initialId);
  bool _busy = false;
  String? _error;
  String? _done;

  @override
  void dispose() {
    _id.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final id = _id.text.trim();
    if (id.isEmpty) {
      setState(() => _error = 'Enter your ID or email.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final res = await widget.api.post('/auth/forgot-password', {'identifier': id});
      setState(() => _done = res['message'] as String? ?? 'If your account has an email, a reset link has been sent.');
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hint = Theme.of(context).hintColor;
    return AlertDialog(
      title: const Text('Forgot password?'),
      content: SizedBox(
        width: 360,
        child: _done != null
            ? Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Icon(Icons.mark_email_read_rounded, color: Color(0xFF16A34A), size: 40),
                const SizedBox(height: 12),
                Text(_done!, style: const TextStyle(fontSize: 14, height: 1.4)),
                const SizedBox(height: 10),
                Text('Open the link, set a new password, then log in here with your ID and the new password.',
                    style: TextStyle(fontSize: 12.5, color: hint, height: 1.4)),
              ])
            : Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Text('Enter your ID (or email). We will email a link to set a new password.',
                    style: TextStyle(fontSize: 13, color: hint, height: 1.4)),
                const SizedBox(height: 14),
                TextField(
                  controller: _id,
                  autofocus: widget.initialId.isEmpty,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => _busy ? null : _send(),
                  decoration: const InputDecoration(labelText: 'ID or email', prefixIcon: Icon(Icons.badge_outlined, size: 20)),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 10),
                  Text(_error!, style: const TextStyle(color: Color(0xFFDC2626), fontSize: 13)),
                ],
              ]),
      ),
      actions: _done != null
          ? [FilledButton(onPressed: () => Navigator.pop(context), child: const Text('OK'))]
          : [
              TextButton(onPressed: _busy ? null : () => Navigator.pop(context), child: const Text('Cancel')),
              FilledButton(
                onPressed: _busy ? null : _send,
                child: _busy
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.2))
                    : const Text('Send link'),
              ),
            ],
    );
  }
}

class _ChangeDialog extends StatefulWidget {
  const _ChangeDialog({required this.api});
  final ApiClient api;
  @override
  State<_ChangeDialog> createState() => _ChangeDialogState();
}

class _ChangeDialogState extends State<_ChangeDialog> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _hide = true;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_next.text.length < 8) {
      setState(() => _error = 'New password must be at least 8 characters.');
      return;
    }
    if (_next.text != _confirm.text) {
      setState(() => _error = 'The two new passwords do not match.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.api.put('/me/password', {'currentPassword': _current.text, 'newPassword': _next.text});
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Password changed.')));
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  InputDecoration _dec(String label) => InputDecoration(
        labelText: label,
        prefixIcon: const Icon(Icons.lock_outline_rounded, size: 20),
        suffixIcon: IconButton(
          iconSize: 20,
          tooltip: _hide ? 'Show' : 'Hide',
          icon: Icon(_hide ? Icons.visibility_outlined : Icons.visibility_off_outlined),
          onPressed: () => setState(() => _hide = !_hide),
        ),
      );

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Change password'),
      content: SizedBox(
        width: 360,
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            TextField(controller: _current, obscureText: _hide, decoration: _dec('Current password')),
            const SizedBox(height: 12),
            TextField(controller: _next, obscureText: _hide, decoration: _dec('New password (min 8)')),
            const SizedBox(height: 12),
            TextField(
              controller: _confirm,
              obscureText: _hide,
              onSubmitted: (_) => _busy ? null : _save(),
              decoration: _dec('Confirm new password'),
            ),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!, style: const TextStyle(color: Color(0xFFDC2626), fontSize: 13)),
            ],
          ]),
        ),
      ),
      actions: [
        TextButton(onPressed: _busy ? null : () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          onPressed: _busy ? null : _save,
          child: _busy
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.2))
              : const Text('Save'),
        ),
      ],
    );
  }
}
