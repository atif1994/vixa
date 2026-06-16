import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import '../models/models.dart';
import 'auth_storage.dart';

class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  @override
  String toString() => message;
}

class ApiService {
  ApiService({AuthStorage? storage}) : _storage = storage ?? AuthStorage();

  final AuthStorage _storage;

  Future<Map<String, String>> _headers({bool auth = true}) async {
    final headers = {'Content-Type': 'application/json'};
    if (auth) {
      final token = await _storage.getAccessToken();
      if (token != null) headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  Future<http.Response> _request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    bool auth = true,
    bool retry = true,
  }) async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}$path');
    final headers = await _headers(auth: auth);

    http.Response response;
    switch (method) {
      case 'GET':
        response = await http.get(uri, headers: headers);
        break;
      case 'POST':
        response = await http.post(uri, headers: headers, body: body != null ? jsonEncode(body) : null);
        break;
      default:
        throw ApiException('Unsupported method');
    }

    if (response.statusCode == 401 && auth && retry && path != '/api/auth/refresh') {
      final refreshed = await _refreshToken();
      if (refreshed) {
        return _request(method, path, body: body, auth: auth, retry: false);
      }
    }
    return response;
  }

  Future<bool> _refreshToken() async {
    final refresh = await _storage.getRefreshToken();
    if (refresh == null) return false;
    final response = await http.post(
      Uri.parse('${AppConfig.apiBaseUrl}/api/auth/refresh'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'refresh_token': refresh}),
    );
    if (response.statusCode != 200) return false;
    final tokens = TokenResponse.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
    await _storage.saveTokens(tokens.accessToken, tokens.refreshToken);
    return true;
  }

  dynamic _parseResponse(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty) return null;
      return jsonDecode(response.body);
    }
    try {
      final err = jsonDecode(response.body) as Map<String, dynamic>;
      throw ApiException(err['detail']?.toString() ?? 'Request failed');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException('Request failed (${response.statusCode})');
    }
  }

  Future<User> register({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    String? phone,
  }) async {
    final response = await _request('POST', '/api/auth/register', auth: false, body: {
      'email': email,
      'password': password,
      'first_name': firstName,
      'last_name': lastName,
      if (phone != null && phone.isNotEmpty) 'phone': phone,
      'recaptcha_token': AppConfig.recaptchaToken,
    });
    return User.fromJson(_parseResponse(response) as Map<String, dynamic>);
  }

  Future<TokenResponse> login(String email, String password) async {
    final response = await _request('POST', '/api/auth/login', auth: false, body: {
      'email': email,
      'password': password,
      'recaptcha_token': AppConfig.recaptchaToken,
    });
    return TokenResponse.fromJson(_parseResponse(response) as Map<String, dynamic>);
  }

  Future<TokenResponse> verifyMfa(String sessionId, String code) async {
    final response = await _request('POST', '/api/auth/mfa/verify', auth: false, body: {
      'mfa_session_id': sessionId,
      'code': code,
    });
    return TokenResponse.fromJson(_parseResponse(response) as Map<String, dynamic>);
  }

  Future<List<Product>> getProducts({String? userId, bool entitledOnly = false}) async {
    final path = entitledOnly && userId != null
        ? '/api/licensing/products/entitled?user_id=$userId'
        : '/api/licensing/products${userId != null ? '?user_id=$userId' : ''}';
    final response = await _request('GET', path, auth: entitledOnly);
    final list = _parseResponse(response) as List<dynamic>;
    return list.map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<User> getUser(String userId) async {
    final response = await _request('GET', '/api/auth/users/$userId');
    return User.fromJson(_parseResponse(response) as Map<String, dynamic>);
  }

  Future<OnboardingStatus> startOnboarding(Map<String, dynamic> data) async {
    final response = await _request('POST', '/api/onboarding/start', auth: false, body: data);
    return OnboardingStatus.fromJson(_parseResponse(response) as Map<String, dynamic>);
  }

  Future<User> enableMfa(String userId) async {
    final response = await _request('POST', '/api/auth/users/$userId/mfa/enable', body: {});
    return User.fromJson(_parseResponse(response) as Map<String, dynamic>);
  }

  Future<User> suspendAccount(String userId, {String? reason}) async {
    final response = await _request('POST', '/api/auth/users/$userId/suspend', body: {'reason': reason});
    return User.fromJson(_parseResponse(response) as Map<String, dynamic>);
  }

  Future<User> closeAccount(String userId, {String? reason}) async {
    final response = await _request('POST', '/api/auth/users/$userId/close', body: {'reason': reason});
    return User.fromJson(_parseResponse(response) as Map<String, dynamic>);
  }

  Future<bool> isLoggedIn() async => (await _storage.getAccessToken()) != null;

  Future<void> logout() => _storage.clear();

  AuthStorage get storage => _storage;
}
