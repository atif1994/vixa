import 'package:flutter/material.dart';

import '../models/models.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import 'login_screen.dart';
import 'products_screen.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _api = ApiService();
  final _firstName = TextEditingController();
  final _lastName = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  final _orgName = TextEditingController();
  final _siteName = TextEditingController();
  List<Product> _products = [];
  String? _productId;
  bool _loading = false;
  String? _error;
  String? _status;

  @override
  void initState() {
    super.initState();
    _loadProducts();
  }

  Future<void> _loadProducts() async {
    try {
      final products = await _api.getProducts();
      setState(() => _products = products.where((p) => !p.isBase).toList());
    } catch (_) {}
  }

  Future<void> _submit() async {
    if (_productId == null) {
      setState(() => _error = 'Please select a product');
      return;
    }
    setState(() { _loading = true; _error = null; _status = 'Running onboarding saga...'; });
    try {
      final result = await _api.startOnboarding({
        'email': _email.text.trim(),
        'password': _password.text,
        'first_name': _firstName.text.trim(),
        'last_name': _lastName.text.trim(),
        if (_phone.text.trim().isNotEmpty) 'phone': _phone.text.trim(),
        'org_name': _orgName.text.trim(),
        'site_name': _siteName.text.trim(),
        'product_id': _productId,
        'payment_method_id': 'pm_card_mock',
      });

      if (result.status == 'completed') {
        setState(() => _status = 'Complete! Signing in...');
        final tokens = await _api.login(_email.text.trim(), _password.text);
        if (!tokens.mfaRequired) {
          await _api.storage.saveTokens(tokens.accessToken, tokens.refreshToken);
          if (result.userId != null) await _api.storage.saveUserId(result.userId!);
          if (!mounted) return;
          Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const ProductsScreen()));
        } else {
          if (!mounted) return;
          Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const LoginScreen()));
        }
      } else if (result.status == 'failed') {
        setState(() {
          _error = result.errorMessage ?? 'Onboarding failed';
          _status = null;
        });
      } else {
        setState(() => _status = '${result.status}: ${result.currentStep}');
      }
    } catch (e) {
      setState(() { _error = e.toString(); _status = null; });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Full Onboarding')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            if (_error != null) _msg(_error!, AppTheme.error),
            if (_status != null) _msg(_status!, AppTheme.success),
            _field(_firstName, 'First Name'),
            _field(_lastName, 'Last Name'),
            _field(_email, 'Email', type: TextInputType.emailAddress),
            _field(_phone, 'Phone (SMS OTP)'),
            _field(_password, 'Password', obscure: true),
            _field(_orgName, 'Organisation Name'),
            _field(_siteName, 'Site Name'),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              initialValue: _productId,
              decoration: const InputDecoration(labelText: 'Product'),
              dropdownColor: AppTheme.surface,
              items: _products
                  .map((p) => DropdownMenuItem(value: p.id, child: Text('${p.name} — ${p.formattedPrice}')))
                  .toList(),
              onChanged: (v) => setState(() => _productId = v),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _loading ? null : _submit,
              child: Text(_loading ? 'Processing...' : 'Start Onboarding'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(TextEditingController c, String label, {TextInputType? type, bool obscure = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: c,
        decoration: InputDecoration(labelText: label),
        keyboardType: type,
        obscureText: obscure,
      ),
    );
  }

  Widget _msg(String text, Color color) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        margin: const EdgeInsets.only(bottom: 16),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          border: Border.all(color: color),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(text, style: TextStyle(color: color)),
      );
}
