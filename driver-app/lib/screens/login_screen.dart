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
      setState(() => _error = 'Enter your Driver ID and password.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<SessionProvider>().login(_id.text, _password.text);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
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
    final hint = context.hint;
    return Scaffold(
      body: Stack(children: [
        // Abstract route lines across the top of the screen.
        Positioned(
          left: 0,
          right: 0,
          top: 0,
          height: 280,
          child: RoutePattern(color: BrandColors.amber.withValues(alpha: context.isDarkTheme ? 0.12 : 0.22)),
        ),
        SafeArea(
          child: Column(children: [
            Expanded(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 440),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      const FadeSlideIn(child: Brand(size: 0.9)),
                      const SizedBox(height: 36),
                      FadeSlideIn(
                        delay: const Duration(milliseconds: 120),
                        child: Card(
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(18, 20, 18, 18),
                            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                              const Text('Driver login', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                              const SizedBox(height: 2),
                              Text('Sign in with the ID given by your transport office.', style: TextStyle(fontSize: 12, color: hint)),
                              const SizedBox(height: 18),
                              if (_error != null || message != null) ...[ErrorBanner(_error ?? message!), const SizedBox(height: 14)],
                              TextField(
                                controller: _id,
                                textInputAction: TextInputAction.next,
                                style: const TextStyle(fontSize: 15),
                                decoration: const InputDecoration(labelText: 'Driver ID or email', prefixIcon: Icon(Icons.badge_outlined, size: 20)),
                              ),
                              const SizedBox(height: 12),
                              TextField(
                                controller: _password,
                                obscureText: _hide,
                                style: const TextStyle(fontSize: 15),
                                onSubmitted: (_) => _submit(),
                                decoration: InputDecoration(
                                  labelText: 'Password',
                                  prefixIcon: const Icon(Icons.lock_outline_rounded, size: 20),
                                  suffixIcon: IconButton(
                                    tooltip: _hide ? 'Show password' : 'Hide password',
                                    icon: Icon(_hide ? Icons.visibility_outlined : Icons.visibility_off_outlined, size: 20),
                                    onPressed: () => setState(() => _hide = !_hide),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 20),
                              FilledButton(
                                onPressed: _busy ? null : _submit,
                                child: _busy
                                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.5))
                                    : const Text('LOG IN'),
                              ),
                              const SizedBox(height: 6),
                              TextButton(
                                onPressed: () => showForgotPasswordDialog(context, context.read<SessionProvider>().api, initialId: _id.text.trim()),
                                child: const Text('Forgot password?'),
                              ),
                            ]),
                          ),
                        ),
                      ),
                    ]),
                  ),
                ),
              ),
            ),
            const Padding(padding: EdgeInsets.only(bottom: 14, top: 4), child: CreditFooter()),
          ]),
        ),
        const Positioned(top: 0, right: 4, child: SafeArea(child: ThemeToggleButton())),
      ]),
    );
  }
}
