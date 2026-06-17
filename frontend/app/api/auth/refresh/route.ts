import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { attachAuthCookies, REFRESH_COOKIE } from "@/lib/auth-cookies";
import { gatewayUrl } from "@/lib/gateway";
import type { TokenResponse } from "@/lib/types";

export async function POST() {
  const refreshToken = cookies().get(REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    return NextResponse.json({ detail: "No refresh token" }, { status: 401 });
  }

  const res = await fetch(gatewayUrl("/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });

  if (!res.ok) {
    const response = NextResponse.json({ detail: "Refresh failed" }, { status: 401 });
    return response;
  }

  const tokens: TokenResponse = await res.json();
  const response = NextResponse.json({ ok: true });
  return attachAuthCookies(response, tokens);
}
