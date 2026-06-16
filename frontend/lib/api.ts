const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return null;
  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) return null;
  const tokens: TokenResponse = await res.json();
  saveTokens(tokens);
  return tokens.access_token;
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && retry && path !== "/api/auth/refresh") {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(`${API_URL}${path}`, { ...options, headers });
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail) || "Request failed");
  }
  return res.json();
}

export const api = {
  register: (data: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
    recaptcha_token?: string;
  }) => request<User>("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),

  login: (email: string, password: string, recaptcha_token?: string) =>
    request<TokenResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, recaptcha_token }),
    }),

  verifyMfa: (mfa_session_id: string, code: string) =>
    request<TokenResponse>("/api/auth/mfa/verify", {
      method: "POST",
      body: JSON.stringify({ mfa_session_id, code }),
    }),

  refresh: (refresh_token: string) =>
    request<TokenResponse>("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token }),
    }),

  getProducts: (userId?: string) =>
    request<Product[]>(`/api/licensing/products${userId ? `?user_id=${userId}` : ""}`),

  getEntitledProducts: (userId: string) =>
    request<Product[]>(`/api/licensing/products/entitled?user_id=${userId}`),

  getUser: (userId: string) => request<User>(`/api/auth/users/${userId}`),

  startOnboarding: (data: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
    org_name: string;
    country?: string;
    city?: string;
    address?: string;
    postcode?: string;
    telephone?: string;
    directors?: string[];
    site_name: string;
    site_location?: string;
    site_managers?: string[];
    product_id: string;
    payment_method_id?: string;
  }) =>
    request<OnboardingStatus>("/api/onboarding/start", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getOnboardingStatus: (sagaId: string) =>
    request<OnboardingStatus>(`/api/onboarding/status/${sagaId}`),

  sendOtp: (channel: "email" | "sms", target: string, user_id?: string) =>
    request<{ message: string; dev_code?: string }>("/api/verification/otp/send", {
      method: "POST",
      body: JSON.stringify({ channel, target, user_id }),
    }),

  enableMfa: (userId: string) =>
    request<User>(`/api/auth/users/${userId}/mfa/enable`, { method: "POST", body: "{}" }),

  suspendAccount: (userId: string, reason?: string) =>
    request<User>(`/api/auth/users/${userId}/suspend`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  closeAccount: (userId: string, reason?: string) =>
    request<User>(`/api/auth/users/${userId}/close`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  getServiceHealth: () =>
    request<{ total: number; healthy: number; services: Array<{ name: string; status: string }> }>(
      "/api/observability/metrics/services"
    ),

  getRecentAuditLogs: (limit = 50) =>
    request<{ count: number; logs: Array<{ id: string; event_type: string; actor_id: string | null; created_at: string }> }>(
      `/api/observability/audit/recent?limit=${limit}`
    ),
};

export function saveTokens(tokens: TokenResponse) {
  localStorage.setItem("access_token", tokens.access_token);
  localStorage.setItem("refresh_token", tokens.refresh_token);
}

export function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user_id");
}

export function getUserIdFromToken(): string | null {
  const token = localStorage.getItem("access_token");
  if (!token) return localStorage.getItem("user_id");
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub;
  } catch {
    return localStorage.getItem("user_id");
  }
}

export function getEntitlementsFromToken(): string[] {
  const token = localStorage.getItem("access_token");
  if (!token) return [];
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.entitlements || [];
  } catch {
    return [];
  }
}

export function getRecaptchaToken(): string {
  return process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.startsWith("mock")
    ? "mock_recaptcha_token"
    : "mock_recaptcha_token";
}
