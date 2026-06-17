import { cookies } from "next/headers";
import { ACCESS_COOKIE } from "./auth-cookies";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export async function getAccessToken(): Promise<string | null> {
  return cookies().get(ACCESS_COOKIE)?.value ?? null;
}

export async function getUserIdFromSession(): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  return typeof payload?.sub === "string" ? payload.sub : null;
}

export async function getEntitlementsFromSession(): Promise<string[]> {
  const token = await getAccessToken();
  if (!token) return [];
  const payload = decodeJwtPayload(token);
  return Array.isArray(payload?.entitlements) ? (payload.entitlements as string[]) : [];
}
