"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, getRecaptchaToken, saveTokens } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaSessionId, setMfaSessionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const tokens = await api.login(email, password, getRecaptchaToken());
      if (tokens.mfa_required && tokens.mfa_session_id) {
        setMfaSessionId(tokens.mfa_session_id);
      } else {
        saveTokens(tokens);
        router.push("/products");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaSessionId) return;
    setError("");
    setLoading(true);
    try {
      const tokens = await api.verifyMfa(mfaSessionId, mfaCode);
      saveTokens(tokens);
      router.push("/products");
    } catch (err) {
      setError(err instanceof Error ? err.message : "MFA verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <div className="logo">ViXa</div>
        <p className="subtitle">{mfaSessionId ? "Enter MFA code" : "Sign in to your account"}</p>
        {error && <div className="error">{error}</div>}

        {mfaSessionId ? (
          <form onSubmit={handleMfa}>
            <div className="form-group">
              <label htmlFor="mfa">Verification Code</label>
              <input id="mfa" required maxLength={6} value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} placeholder="000000" />
            </div>
            <button type="submit" className="btn" disabled={loading}>
              {loading ? "Verifying..." : "Verify"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button type="submit" className="btn" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        )}

        <p className="footer-link">
          Don&apos;t have an account? <Link href="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}
