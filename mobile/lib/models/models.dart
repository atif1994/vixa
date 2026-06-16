class User {
  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final String? digitalIdentityId;
  final String status;
  final bool mfaEnabled;
  final bool emailVerified;
  final bool phoneVerified;

  User({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    this.digitalIdentityId,
    required this.status,
    required this.mfaEnabled,
    required this.emailVerified,
    required this.phoneVerified,
  });

  factory User.fromJson(Map<String, dynamic> json) => User(
        id: json['id'] as String,
        email: json['email'] as String,
        firstName: json['first_name'] as String,
        lastName: json['last_name'] as String,
        digitalIdentityId: json['digital_identity_id'] as String?,
        status: json['status'] as String,
        mfaEnabled: json['mfa_enabled'] as bool? ?? false,
        emailVerified: json['email_verified'] as bool? ?? false,
        phoneVerified: json['phone_verified'] as bool? ?? false,
      );
}

class TokenResponse {
  final String accessToken;
  final String refreshToken;
  final int expiresIn;
  final bool mfaRequired;
  final String? mfaSessionId;

  TokenResponse({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
    required this.mfaRequired,
    this.mfaSessionId,
  });

  factory TokenResponse.fromJson(Map<String, dynamic> json) => TokenResponse(
        accessToken: json['access_token'] as String? ?? '',
        refreshToken: json['refresh_token'] as String? ?? '',
        expiresIn: json['expires_in'] as int? ?? 0,
        mfaRequired: json['mfa_required'] as bool? ?? false,
        mfaSessionId: json['mfa_session_id'] as String?,
      );
}

class Product {
  final String id;
  final String name;
  final String slug;
  final String? description;
  final int priceCents;
  final String currency;
  final bool entitled;
  final bool isBase;

  Product({
    required this.id,
    required this.name,
    required this.slug,
    this.description,
    required this.priceCents,
    required this.currency,
    required this.entitled,
    this.isBase = false,
  });

  factory Product.fromJson(Map<String, dynamic> json) => Product(
        id: json['id'] as String,
        name: json['name'] as String,
        slug: json['slug'] as String,
        description: json['description'] as String?,
        priceCents: json['price_cents'] as int,
        currency: json['currency'] as String? ?? 'EUR',
        entitled: json['entitled'] as bool? ?? false,
        isBase: json['is_base'] as bool? ?? false,
      );

  String get formattedPrice =>
      isBase ? 'Included' : '€${(priceCents / 100).toStringAsFixed(2)}';
}

class OnboardingStatus {
  final String sagaId;
  final String status;
  final String currentStep;
  final List<String> stepsCompleted;
  final String? userId;
  final String? errorMessage;

  OnboardingStatus({
    required this.sagaId,
    required this.status,
    required this.currentStep,
    required this.stepsCompleted,
    this.userId,
    this.errorMessage,
  });

  factory OnboardingStatus.fromJson(Map<String, dynamic> json) => OnboardingStatus(
        sagaId: json['saga_id'] as String,
        status: json['status'] as String,
        currentStep: json['current_step'] as String,
        stepsCompleted: (json['steps_completed'] as List<dynamic>? ?? [])
            .map((e) => e.toString())
            .toList(),
        userId: json['user_id'] as String?,
        errorMessage: json['error_message'] as String?,
      );
}
