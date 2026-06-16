import 'package:flutter/material.dart';

import '../services/api_service.dart';
import '../theme/app_theme.dart';
import 'products_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _api = ApiService();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _mfaCode = TextEditingController();
  String? _mfaSessionId;
  bool _loading = false;
  String? _error;

  Future<void> _submit() async {
    setState(() { _loading = true; _error = null; });
    try {
      if (_mfaSessionId != null) {
        final tokens = await _api.verifyMfa(_mfaSessionId!, _mfaCode.text.trim());
        await _api.storage.saveTokens(tokens.accessToken, tokens.refreshToken);
        if (!mounted) return;
        Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const ProductsScreen()));
        return;
      }
      final tokens = await _api.login(_email.text.trim(), _password.text);
      if (tokens.mfaRequired && tokens.mfaSessionId != null) {
        setState(() => _mfaSessionId = tokens.mfaSessionId);
      } else {
        await _api.storage.saveTokens(tokens.accessToken, tokens.refreshToken);
        if (!mounted) return;
        Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const ProductsScreen()));
      }
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_mfaSessionId != null ? 'MFA Verification' : 'Sign In')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            if (_error != null)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: AppTheme.error.withValues(alpha: 0.1),
                  border: Border.all(color: AppTheme.error),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(_error!, style: const TextStyle(color: AppTheme.error)),
              ),
            if (_mfaSessionId == null) ...[
              TextField(controller: _email, decoration: const InputDecoration(labelText: 'Email'), keyboardType: TextInputType.emailAddress),
              const SizedBox(height: 16),
              TextField(controller: _password, decoration: const InputDecoration(labelText: 'Password'), obscureText: true),
            ] else
              TextField(controller: _mfaCode, decoration: const InputDecoration(labelText: 'Verification Code'), keyboardType: TextInputType.number),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _loading ? null : _submit,
              child: Text(_loading ? 'Please wait...' : (_mfaSessionId != null ? 'Verify' : 'Sign In')),
            ),
          ],
        ),
      ),
    );
  }
}
