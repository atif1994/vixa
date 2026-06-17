export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  digital_identity_id: string | null;
  status: string;
  mfa_enabled: boolean;
  email_verified: boolean;
  phone_verified: boolean;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  mfa_required: boolean;
  mfa_session_id: string | null;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_cents: number;
  currency: string;
  entitled: boolean;
  is_base: boolean;
}

export interface OnboardingStatus {
  saga_id: string;
  correlation_id: string;
  status: string;
  current_step: string;
  steps_completed: string[];
  user_id: string | null;
  error_message: string | null;
}

export interface ServiceHealth {
  total: number;
  healthy: number;
  services: Array<{ name: string; status: string }>;
}

export interface AuditLog {
  id: string;
  event_type: string;
  actor_id: string | null;
  resource_type?: string | null;
  created_at: string;
}

export interface LoginResult {
  ok: boolean;
  mfa_required?: boolean;
  mfa_session_id?: string | null;
}
