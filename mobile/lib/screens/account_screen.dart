import 'package:flutter/material.dart';

import '../models/models.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import 'home_screen.dart';

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  final _api = ApiService();
  User? _user;
  bool _loading = true;
  String? _message;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final userId = await _api.storage.resolveUserId();
      if (userId == null) throw ApiException('Not logged in');
      final user = await _api.getUser(userId);
      setState(() => _user = user);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _action(String type) async {
    if (_user == null) return;
    setState(() { _message = null; _error = null; });
    try {
      if (type == 'mfa') {
        final updated = await _api.enableMfa(_user!.id);
        setState(() { _user = updated; _message = 'MFA enabled'; });
      } else if (type == 'suspend') {
        await _api.suspendAccount(_user!.id, reason: 'User requested');
        await _api.logout();
        if (!mounted) return;
        Navigator.pushAndRemoveUntil(context, MaterialPageRoute(builder: (_) => const HomeScreen()), (_) => false);
      } else if (type == 'close') {
        await _api.closeAccount(_user!.id, reason: 'User requested');
        await _api.logout();
        if (!mounted) return;
        Navigator.pushAndRemoveUntil(context, MaterialPageRoute(builder: (_) => const HomeScreen()), (_) => false);
      }
    } catch (e) {
      setState(() => _error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Account')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
          : Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_error != null) Text(_error!, style: const TextStyle(color: AppTheme.error)),
                  if (_message != null) Text(_message!, style: const TextStyle(color: AppTheme.success)),
                  if (_user != null) ...[
                    Text('Email: ${_user!.email}'),
                    Text('Status: ${_user!.status}'),
                    Text('MFA: ${_user!.mfaEnabled ? "Enabled" : "Disabled"}'),
                    Text('Digital ID: ${_user!.digitalIdentityId ?? "—"}'),
                    const SizedBox(height: 24),
                    if (!_user!.mfaEnabled)
                      ElevatedButton(onPressed: () => _action('mfa'), child: const Text('Enable MFA')),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFB45309)),
                      onPressed: () => _action('suspend'),
                      child: const Text('Suspend Account'),
                    ),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: AppTheme.error),
                      onPressed: () => _action('close'),
                      child: const Text('Close Account'),
                    ),
                  ],
                ],
              ),
            ),
    );
  }
}
