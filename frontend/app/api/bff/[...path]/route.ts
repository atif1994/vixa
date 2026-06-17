import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  attachAuthCookies,
} from "@/lib/auth-cookies";
import { gatewayUrl } from "@/lib/gateway";
import type { TokenResponse } from "@/lib/types";

async function refreshTokens(): Promise<TokenResponse | null> {
  const refreshToken = cookies().get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;

  const res = await fetch(gatewayUrl("/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });

  if (!res.ok) return null;
  return res.json();
}

async function proxy(request: NextRequest, path: string) {
  const accessToken = cookies().get(ACCESS_COOKIE)?.value;
  const headers: Record<string, string> = {};
  const contentType = request.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  let res = await fetch(gatewayUrl(`/${path}`), init);
  let refreshedTokens: TokenResponse | null = null;

  if (res.status === 401 && accessToken) {
    refreshedTokens = await refreshTokens();
    if (refreshedTokens) {
      headers.Authorization = `Bearer ${refreshedTokens.access_token}`;
      res = await fetch(gatewayUrl(`/${path}`), { ...init, headers });
    }
  }

  const body = await res.text();
  const response = new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") || "application/json" },
  });

  if (refreshedTokens) {
    attachAuthCookies(response, refreshedTokens);
  }

  return response;
}

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join("/") + (request.nextUrl.search || "");
  return proxy(request, path);
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path.join("/"));
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path.join("/"));
}

export async function PATCH(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path.join("/"));
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path.join("/"));
}
