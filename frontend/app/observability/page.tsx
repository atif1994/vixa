"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface ServiceHealth {
  name: string;
  status: string;
}

interface AuditLog {
  id: string;
  event_type: string;
  actor_id: string | null;
  resource_type: string | null;
  created_at: string;
}

export default function ObservabilityPage() {
  const [health, setHealth] = useState<{ total: number; healthy: number; services: ServiceHealth[] } | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setError("");
      try {
        const h = await api.getServiceHealth();
        setHealth(h);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load service health");
      }
      try {
        const a = await api.getRecentAuditLogs(30);
        setLogs(a.logs);
      } catch {
        // Audit log failure is non-fatal if health loaded
      }
    };
    load();
  }, []);

  return (
    <div>
      <nav className="nav">
        <span className="nav-brand">ViXa Observability</span>
        <div className="nav-links">
          <Link href="/products">Products</Link>
          <Link href="/account">Account</Link>
        </div>
      </nav>

      <div style={{ padding: "2rem", maxWidth: 1000, margin: "0 auto" }}>
        <h1>Platform Observability</h1>
        <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>
          Service health and recent audit events (MVP dashboard)
        </p>

        {error && <div className="error">{error}</div>}

        {health && (
          <div className="card" style={{ marginBottom: "2rem" }}>
            <h2 style={{ marginBottom: "1rem" }}>Service Health</h2>
            <p style={{ marginBottom: "1rem" }}>
              {health.healthy} / {health.total} services healthy
            </p>
            <div style={{ display: "grid", gap: "0.5rem" }}>
              {health.services.map((svc) => (
                <div
                  key={svc.name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "0.5rem 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span>{svc.name}</span>
                  <span style={{ color: svc.status === "healthy" ? "var(--success)" : "var(--error)" }}>
                    {svc.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <h2 style={{ marginBottom: "1rem" }}>Recent Audit Log</h2>
          {logs.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No audit events yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                  <th style={{ padding: "0.5rem 0" }}>Time</th>
                  <th>Event</th>
                  <th>Actor</th>
                  <th>Resource</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.5rem 0" }}>{new Date(log.created_at).toLocaleString()}</td>
                    <td>{log.event_type}</td>
                    <td>{log.actor_id || "—"}</td>
                    <td>{log.resource_type || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
