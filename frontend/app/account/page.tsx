"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, clearTokens, getUserIdFromToken } from "@/lib/api";
import type { User } from "@/lib/api";

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const userId = getUserIdFromToken();
    if (!userId) {
      router.push("/login");
      return;
    }
    api.getUser(userId).then(setUser).catch(() => router.push("/login"));
  }, [router]);

  const act = async (action: "mfa" | "suspend" | "close") => {
    if (!user) return;
    setError("");
    setMessage("");
    try {
      if (action === "mfa") {
        const updated = await api.enableMfa(user.id);
        setUser(updated);
        setMessage("MFA enabled. Next login will require a verification code.");
      } else if (action === "suspend") {
        await api.suspendAccount(user.id, "User requested suspension");
        setMessage("Account suspended.");
        clearTokens();
      } else {
        await api.closeAccount(user.id, "User requested closure");
        setMessage("Account closed.");
        clearTokens();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  };

  if (!user) return <p className="container" style={{ color: "var(--muted)" }}>Loading...</p>;

  return (
    <div className="container" style={{ maxWidth: 520 }}>
      <div className="card">
        <div className="logo">Account Settings</div>
        {error && <div className="error">{error}</div>}
        {message && <div className="success">{message}</div>}
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Status:</strong> {user.status}</p>
        <p><strong>MFA:</strong> {user.mfa_enabled ? "Enabled" : "Disabled"}</p>
        <p><strong>Digital ID:</strong> {user.digital_identity_id}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1.5rem" }}>
          {!user.mfa_enabled && (
            <button className="btn" onClick={() => act("mfa")}>Enable MFA</button>
          )}
          <button className="btn" style={{ background: "#b45309" }} onClick={() => act("suspend")}>Suspend Account</button>
          <button className="btn" style={{ background: "var(--error)" }} onClick={() => act("close")}>Close Account</button>
        </div>
        <p className="footer-link"><Link href="/products">Back to Products</Link></p>
      </div>
    </div>
  );
}
