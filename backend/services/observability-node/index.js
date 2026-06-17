import express from "express";
import pg from "pg";

const app = express();
const PORT = process.env.PORT || 8008;

const SERVICES = [
  { name: "gateway", url: process.env.GATEWAY_URL || "http://localhost:8000/health" },
  { name: "auth", url: process.env.AUTH_SERVICE_URL ? `${process.env.AUTH_SERVICE_URL}/health` : "http://localhost:8001/health" },
  { name: "onboarding", url: process.env.ONBOARDING_SERVICE_URL ? `${process.env.ONBOARDING_SERVICE_URL}/health` : "http://localhost:8002/health" },
  { name: "org-site", url: process.env.ORG_SITE_SERVICE_URL ? `${process.env.ORG_SITE_SERVICE_URL}/health` : "http://localhost:8003/health" },
  { name: "verification", url: process.env.VERIFICATION_SERVICE_URL ? `${process.env.VERIFICATION_SERVICE_URL}/health` : "http://localhost:8004/health" },
  { name: "payments", url: process.env.PAYMENTS_SERVICE_URL ? `${process.env.PAYMENTS_SERVICE_URL}/health` : "http://localhost:8005/health" },
  { name: "licensing", url: process.env.LICENSING_SERVICE_URL ? `${process.env.LICENSING_SERVICE_URL}/health` : "http://localhost:8006/health" },
  { name: "acl", url: process.env.ACL_SERVICE_URL ? `${process.env.ACL_SERVICE_URL}/health` : "http://localhost:8007/health" },
];

async function checkHealth(service) {
  try {
    const res = await fetch(service.url, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    return { name: service.name, status: res.ok ? "healthy" : "unhealthy", detail: data };
  } catch (err) {
    return { name: service.name, status: "unreachable", error: err.message };
  }
}

app.get("/health", (_req, res) => {
  res.json({ status: "healthy", service: "observability-node" });
});

app.get("/metrics/services", async (_req, res) => {
  const results = await Promise.all(SERVICES.map(checkHealth));
  const healthy = results.filter((r) => r.status === "healthy").length;
  res.json({
    timestamp: new Date().toISOString(),
    total: results.length,
    healthy,
    services: results,
  });
});

app.get("/audit/recent", async (req, res) => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL?.replace("postgresql+asyncpg", "postgresql") || "postgresql://vixa:vixa_secret@localhost:5432/vixa_ciam" });
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  try {
    const result = await pool.query(
      "SELECT id, event_type, actor_id, resource_type, resource_id, checksum, created_at FROM audit.audit_logs ORDER BY created_at DESC LIMIT $1",
      [limit]
    );
    res.json({ count: result.rows.length, logs: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await pool.end();
  }
});

app.listen(PORT, () => {
  console.log(`ViXa Observability (Node.js) listening on :${PORT}`);
});
