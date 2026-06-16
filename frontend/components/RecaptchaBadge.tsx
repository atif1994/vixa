"use client";

export function RecaptchaBadge() {
  const isMock = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.startsWith("mock") ?? true;
  if (!isMock) {
    return null;
  }
  return (
    <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.5rem" }}>
      reCAPTCHA (mock mode) — verification bypassed in development
    </p>
  );
}
