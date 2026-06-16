import 'dart:io';

class AppConfig {
  /// Override at build time: flutter run --dart-define=API_URL=http://192.168.1.10:8000
  static const String _dartDefineUrl = String.fromEnvironment('API_URL');

  static String get apiBaseUrl {
    if (_dartDefineUrl.isNotEmpty) return _dartDefineUrl;
    if (Platform.isAndroid) return 'http://10.0.2.2:8000';
    return 'http://127.0.0.1:8000';
  }

  static const String recaptchaToken = 'mock_recaptcha_token';
}
