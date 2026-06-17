import { NextResponse } from "next/server";
import type { TokenResponse } from "./types";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

const BASE_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export function attachAuthCookies(response: NextResponse, tokens: TokenResponse): NextResponse {
  response.cookies.set(ACCESS_COOKIE, tokens.access_token, {
    ...BASE_COOKIE,
    maxAge: tokens.expires_in,
  });
  response.cookies.set(REFRESH_COOKIE, tokens.refresh_token, {
    ...BASE_COOKIE,
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

export function clearAuthCookies(response: NextResponse): NextResponse {
  response.cookies.set(ACCESS_COOKIE, "", { ...BASE_COOKIE, maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { ...BASE_COOKIE, maxAge: 0 });
  return response;
}
