"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RecaptchaBadge } from "@/components/RecaptchaBadge";
import { apiClient, getRecaptchaToken } from "@/lib/api-client";
import type { Product } from "@/lib/types";

export default function OnboardingPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    phone: "",
    org_name: "",
    country: "",
    city: "",
    address: "",
    postcode: "",
    telephone: "",
    directors: "",
    site_name: "",
    site_location: "",
    site_managers: "",
    product_id: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getProducts()
      .then((list) => setProducts(list.filter((p) => !p.is_base)))
      .catch(() => {});
  }, []);

  const parseList = (value: string) =>
    value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setStatus("Starting onboarding saga...");
    try {
      const result = await apiClient.startOnboarding({
        email: form.email,
        password: form.password,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone || undefined,
        org_name: form.org_name,
        country: form.country || undefined,
        city: form.city || undefined,
        address: form.address || undefined,
        postcode: form.postcode || undefined,
        telephone: form.telephone || undefined,
        directors: form.directors ? parseList(form.directors) : undefined,
        site_name: form.site_name,
        site_location: form.site_location || undefined,
        site_managers: form.site_managers ? parseList(form.site_managers) : undefined,
        product_id: form.product_id,
        payment_method_id: "pm_card_mock",
      });

      if (result.status === "completed" && result.user_id) {
        setStatus("Onboarding complete! Logging you in...");
        const loginResult = await apiClient.login(form.email, form.password, getRecaptchaToken());
        if (!loginResult.mfa_required) {
          router.push("/products");
          router.refresh();
        } else {
          router.push("/login");
        }
      } else if (result.status === "failed") {
        setError(result.error_message || "Onboarding failed");
        setStatus(null);
      } else {
        setStatus(`Status: ${result.status} — step: ${result.current_step}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onboarding failed");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 560 }}>
      <div className="card">
        <div className="logo">ViXa Onboarding</div>
        <p className="subtitle">Identity & org setup → verification → payment → activation</p>
        {error && <div className="error">{error}</div>}
        {status && <div className="success">{status}</div>}
        <form onSubmit={handleSubmit}>
          <h3 className="section-title">Identity</h3>
          <div className="form-group">
            <label>First Name</label>
            <input
              required
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Last Name</label>
            <input
              required
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Phone (SMS OTP)</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+31612345678"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <h3 className="section-title">Organisation Profile</h3>
          <div className="form-group">
            <label>Organisation Name</label>
            <input
              required
              value={form.org_name}
              onChange={(e) => setForm({ ...form, org_name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Country</label>
            <input
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              placeholder="Netherlands"
            />
          </div>
          <div className="form-group">
            <label>City</label>
            <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Address</label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Postcode</label>
            <input
              value={form.postcode}
              onChange={(e) => setForm({ ...form, postcode: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Telephone</label>
            <input
              value={form.telephone}
              onChange={(e) => setForm({ ...form, telephone: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Directors (comma-separated)</label>
            <input
              value={form.directors}
              onChange={(e) => setForm({ ...form, directors: e.target.value })}
              placeholder="Jane Doe, John Smith"
            />
          </div>

          <h3 className="section-title">Site</h3>
          <div className="form-group">
            <label>Site Name</label>
            <input
              required
              value={form.site_name}
              onChange={(e) => setForm({ ...form, site_name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Site Location</label>
            <input
              value={form.site_location}
              onChange={(e) => setForm({ ...form, site_location: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Site Managers (comma-separated)</label>
            <input
              value={form.site_managers}
              onChange={(e) => setForm({ ...form, site_managers: e.target.value })}
            />
          </div>

          <h3 className="section-title">Subscription</h3>
          <div className="form-group">
            <label>Subscription Product</label>
            <select
              required
              value={form.product_id}
              onChange={(e) => setForm({ ...form, product_id: e.target.value })}
              className="select"
            >
              <option value="">Select a subscription</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — €{(p.price_cents / 100).toFixed(2)}/mo
                </option>
              ))}
            </select>
          </div>
          <RecaptchaBadge />
          <button type="submit" className="btn" disabled={loading} style={{ marginTop: "1rem" }}>
            {loading ? "Processing..." : "Start Full Onboarding"}
          </button>
        </form>
        <p className="footer-link">
          <Link href="/register">Simple register</Link> · <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
