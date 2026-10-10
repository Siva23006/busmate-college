import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../providers/session_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';
import '../widgets/password_dialogs.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _id = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  bool _hide = true;
  String? _error;

  Future<void> _submit() async {
    if (_id.text.trim().isEmpty || _password.text.isEmpty) {
      setState(() => _error = 'Enter your Student ID and password.');
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<SessionProvider>().login(_id.text, _password.text);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _id.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final message = context.watch<SessionProvider>().message;
    final pal = Palette.of(context);
    final error = _error ?? message;

    return Scaffold(
      bottomNavigationBar: const SafeArea(
        top: false,
        child: Padding(padding: EdgeInsets.fromLTRB(16, 8, 16, 14), child: CreditFooter()),
      ),
      body: Stack(children: [
        // Abstract route lines across the top.
        const Positioned(left: 0, right: 0, top: 0, height: 260, child: RouteLines()),
        SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 440),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  const FadeSlideIn(child: Center(child: BrandTile(size: 56))),
                  const SizedBox(height: 18),
                  FadeSlideIn(
                    index: 1,
                    child: Column(children: [
                      Text('Welcome to BusMate', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: pal.text)),
                      const SizedBox(height: 4),
                      Text('Sign in to track your college bus live',
                          textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: pal.muted)),
                    ]),
                  ),
                  const SizedBox(height: 24),
                  FadeSlideIn(
                    index: 2,
                    child: BmCard(
                      radius: Ui.radiusLarge,
                      padding: const EdgeInsets.fromLTRB(18, 20, 18, 18),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                        const SectionLabel('Student login', padding: EdgeInsets.fromLTRB(2, 0, 2, 14)),
                        AnimatedSize(
                          duration: const Duration(milliseconds: 220),
                          curve: Curves.easeOut,
                          child: error == null
                              ? const SizedBox(width: double.infinity)
                              : Padding(padding: const EdgeInsets.only(bottom: 14), child: ErrorBanner(error)),
                        ),
                        TextField(
                          controller: _id,
                          textInputAction: TextInputAction.next,
                          keyboardType: TextInputType.emailAddress,
                          autocorrect: false,
                          style: TextStyle(fontSize: 14.5, color: pal.text),
                          decoration: const InputDecoration(
                            labelText: 'Student ID or email',
                            prefixIcon: Icon(Icons.badge_outlined, size: 20),
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _password,
                          obscureText: _hide,
                          style: TextStyle(fontSize: 14.5, color: pal.text),
                          onSubmitted: (_) => _submit(),
                          decoration: InputDecoration(
                            labelText: 'Password',
                            prefixIcon: const Icon(Icons.lock_outline_rounded, size: 20),
                            suffixIcon: IconButton(
                              iconSize: 20,
                              tooltip: _hide ? 'Show password' : 'Hide password',
                              icon: Icon(_hide ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                              onPressed: () => setState(() => _hide = !_hide),
                            ),
                          ),
                        ),
                        const SizedBox(height: 20),
                        FilledButton(
                          onPressed: _busy ? null : _submit,
                          child: AnimatedSwitcher(
                            duration: const Duration(milliseconds: 200),
                            child: _busy
                                ? const SizedBox(
                                    key: ValueKey('busy'), width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4))
                                : const Row(key: ValueKey('idle'), mainAxisSize: MainAxisSize.min, children: [
                                    Text('Sign in'),
                                    SizedBox(width: 8),
                                    Icon(Icons.arrow_forward_rounded, size: 18),
                                  ]),
                          ),
                        ),
                        const SizedBox(height: 6),
                        TextButton(
                          onPressed: () => showForgotPasswordDialog(context, context.read<SessionProvider>().api, initialId: _id.text.trim()),
                          child: const Text('Forgot password?'),
                        ),
                      ]),
                    ),
                  ),
                  const SizedBox(height: 16),
                  FadeSlideIn(
                    index: 3,
                    child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Icon(Icons.info_outline_rounded, size: 14, color: pal.muted),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text('Use the ID given by your transport office.',
                            style: TextStyle(fontSize: 12, color: pal.muted)),
                      ),
                    ]),
                  ),
                ]),
              ),
            ),
          ),
        ),
      ]),
    );
  }
}
