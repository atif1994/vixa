import { NextResponse } from "next/server";
import { attachAuthCookies } from "@/lib/auth-cookies";
import { gatewayUrl } from "@/lib/gateway";
import type { TokenResponse } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json();

  const res = await fetch(gatewayUrl("/auth/mfa/verify"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "MFA verification failed" }));
    return NextResponse.json(err, { status: res.status });
  }

  const tokens: TokenResponse = await res.json();
  const response = NextResponse.json({ ok: true, mfa_required: false });
  return attachAuthCookies(response, tokens);
}
