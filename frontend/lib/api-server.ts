import { cookies } from "next/headers";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "./auth-cookies";
import { gatewayUrl } from "./gateway";
import type {
  AuditLog,
  OnboardingStatus,
  Product,
  ServiceHealth,
  TokenResponse,
  User,
} from "./types";

async function refreshTokens(refreshToken: string): Promise<TokenResponse | null> {
  const res = await fetch(gatewayUrl("/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

async function gatewayFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const cookieStore = cookies();
  let accessToken = cookieStore.get(ACCESS_COOKIE)?.value;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res = await fetch(gatewayUrl(path), { ...options, headers, cache: "no-store" });

  if (res.status === 401 && path !== "/auth/refresh") {
    const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
    if (refreshToken) {
      const tokens = await refreshTokens(refreshToken);
      if (tokens) {
        headers.Authorization = `Bearer ${tokens.access_token}`;
        res = await fetch(gatewayUrl(path), { ...options, headers, cache: "no-store" });
      }
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(
      typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail) || "Request failed"
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const serverApi = {
  getProducts: (userId?: string) =>
    gatewayFetch<Product[]>(`/licensing/products${userId ? `?user_id=${userId}` : ""}`),

  getEntitledProducts: (userId: string) =>
    gatewayFetch<Product[]>(`/licensing/products/entitled?user_id=${userId}`),

  getUser: (userId: string) => gatewayFetch<User>(`/auth/users/${userId}`),

  getOnboardingStatus: (sagaId: string) =>
    gatewayFetch<OnboardingStatus>(`/onboarding/status/${sagaId}`),

  getServiceHealth: () => gatewayFetch<ServiceHealth>("/observability/metrics/services"),

  getRecentAuditLogs: (limit = 50) =>
    gatewayFetch<{ count: number; logs: AuditLog[] }>(
      `/observability/audit/recent?limit=${limit}`
    ),
};
