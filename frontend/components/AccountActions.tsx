"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import type { User } from "@/lib/types";

export function AccountActions({ user }: { user: User }) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(user);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const act = async (action: "mfa" | "suspend" | "close") => {
    setError("");
    setMessage("");
    try {
      if (action === "mfa") {
        const updated = await apiClient.enableMfa(currentUser.id);
        setCurrentUser(updated);
        setMessage("MFA enabled. Next login will require a verification code.");
      } else if (action === "suspend") {
        await apiClient.suspendAccount(currentUser.id, "User requested suspension");
        setMessage("Account suspended.");
        await apiClient.logout();
        router.push("/login");
      } else {
        await apiClient.closeAccount(currentUser.id, "User requested closure");
        setMessage("Account closed.");
        await apiClient.logout();
        router.push("/login");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  };

  return (
    <>
      {error && <div className="error">{error}</div>}
      {message && <div className="success">{message}</div>}
      <p>
        <strong>Email:</strong> {currentUser.email}
      </p>
      <p>
        <strong>Status:</strong> {currentUser.status}
      </p>
      <p>
        <strong>MFA:</strong> {currentUser.mfa_enabled ? "Enabled" : "Disabled"}
      </p>
      <p>
        <strong>Digital ID:</strong> {currentUser.digital_identity_id}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1.5rem" }}>
        {!currentUser.mfa_enabled && (
          <button className="btn" onClick={() => act("mfa")}>
            Enable MFA
          </button>
        )}
        <button className="btn" style={{ background: "#b45309" }} onClick={() => act("suspend")}>
          Suspend Account
        </button>
        <button className="btn" style={{ background: "var(--error)" }} onClick={() => act("close")}>
          Close Account
        </button>
      </div>
    </>
  );
}
