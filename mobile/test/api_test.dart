import 'package:flutter_test/flutter_test.dart';
import 'package:vixa_mobile/config/app_config.dart';
import 'package:vixa_mobile/models/models.dart';

void main() {
  test('Product parses JSON', () {
    final product = Product.fromJson({
      'id': 'abc',
      'name': 'ViXa Core',
      'slug': 'vixa-core',
      'description': 'Core access',
      'price_cents': 2900,
      'currency': 'EUR',
      'entitled': true,
    });
    expect(product.name, 'ViXa Core');
    expect(product.formattedPrice, '€29.00');
    expect(product.entitled, isTrue);
  });

  test('TokenResponse parses MFA challenge', () {
    final token = TokenResponse.fromJson({
      'access_token': '',
      'refresh_token': '',
      'expires_in': 0,
      'mfa_required': true,
      'mfa_session_id': 'session-123',
    });
    expect(token.mfaRequired, isTrue);
    expect(token.mfaSessionId, 'session-123');
  });

  test('AppConfig has API base URL', () {
    expect(AppConfig.apiBaseUrl, isNotEmpty);
  });
}
