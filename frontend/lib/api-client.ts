import type { LoginResult, OnboardingStatus, Product, TokenResponse, User } from "./types";

async function parseError(res: Response): Promise<string> {
  const err = await res.json().catch(() => ({ detail: "Request failed" }));
  return typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail) || "Request failed";
}

async function bffFetch<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const res = await fetch(`/api/bff/${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    },
  });

  if (res.status === 401 && retry) {
    const refreshed = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
    if (refreshed.ok) {
      return bffFetch<T>(path, options, false);
    }
  }

  if (!res.ok) throw new Error(await parseError(res));
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function getRecaptchaToken(): string {
  return "mock_recaptcha_token";
}

export const apiClient = {
  register: (data: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
    recaptcha_token?: string;
  }) => bffFetch<User>("auth/register", { method: "POST", body: JSON.stringify(data) }),

  login: async (
    email: string,
    password: string,
    recaptcha_token?: string
  ): Promise<LoginResult & Partial<TokenResponse>> => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, recaptcha_token }),
    });
    if (!res.ok) throw new Error(await parseError(res));
    return res.json();
  },

  verifyMfa: async (mfa_session_id: string, code: string): Promise<LoginResult> => {
    const res = await fetch("/api/auth/mfa/verify", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mfa_session_id, code }),
    });
    if (!res.ok) throw new Error(await parseError(res));
    return res.json();
  },

  logout: async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  },

  getProducts: (userId?: string) =>
    bffFetch<Product[]>(`licensing/products${userId ? `?user_id=${userId}` : ""}`),

  getEntitledProducts: (userId: string) =>
    bffFetch<Product[]>(`licensing/products/entitled?user_id=${userId}`),

  getUser: (userId: string) => bffFetch<User>(`auth/users/${userId}`),

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
    bffFetch<OnboardingStatus>("onboarding/start", { method: "POST", body: JSON.stringify(data) }),

  enableMfa: (userId: string) =>
    bffFetch<User>(`auth/users/${userId}/mfa/enable`, { method: "POST", body: "{}" }),

  suspendAccount: (userId: string, reason?: string) =>
    bffFetch<User>(`auth/users/${userId}/suspend`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  closeAccount: (userId: string, reason?: string) =>
    bffFetch<User>(`auth/users/${userId}/close`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
};
