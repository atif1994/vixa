export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function gatewayUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_URL}/api/v1${normalized}`;
}
