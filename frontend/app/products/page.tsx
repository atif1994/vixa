"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, clearTokens, getUserIdFromToken, Product } from "@/lib/api";

function productBadge(product: Product) {
  if (product.is_base && product.entitled) return { label: "Included", className: "badge-entitled" };
  if (product.entitled) return { label: "Entitled", className: "badge-entitled" };
  return { label: "Subscribe", className: "badge-available" };
}

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<"all" | "entitled">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const userId = getUserIdFromToken();
    if (!userId) {
      router.push("/login");
      return;
    }

    const load = async () => {
      try {
        const data =
          filter === "entitled"
            ? await api.getEntitledProducts(userId)
            : await api.getProducts(userId);
        setProducts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load products");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [filter, router]);

  const handleLogout = () => {
    clearTokens();
    router.push("/login");
  };

  const formatPrice = (product: Product) => {
    if (product.is_base) return "Included";
    return new Intl.NumberFormat("en-EU", {
      style: "currency",
      currency: product.currency,
    }).format(product.price_cents / 100);
  };

  return (
    <div>
      <nav className="nav">
        <span className="nav-brand">ViXa Platform</span>
        <div className="nav-links">
          <button
            onClick={() => { setLoading(true); setFilter("all"); }}
            style={{ background: "none", border: "none", color: filter === "all" ? "var(--primary)" : "var(--muted)", cursor: "pointer" }}
          >
            All Products
          </button>
          <button
            onClick={() => { setLoading(true); setFilter("entitled"); }}
            style={{ background: "none", border: "none", color: filter === "entitled" ? "var(--primary)" : "var(--muted)", cursor: "pointer" }}
          >
            My Products
          </button>
          <Link href="/account">Account</Link>
          <Link href="/observability">Observability</Link>
          <button onClick={handleLogout} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}>
            Logout
          </button>
        </div>
      </nav>

      <div style={{ padding: "2rem", maxWidth: 1200, margin: "0 auto" }}>
        <h1 style={{ marginBottom: "0.5rem" }}>
          {filter === "entitled" ? "Your Entitled Products" : "Products & Services"}
        </h1>
        <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>
          {filter === "entitled"
            ? "ViXa Platform is included for all customers; subscriptions unlock additional products."
            : "Entitled products are active — others show as upsell subscriptions."}
        </p>

        {error && <div className="error">{error}</div>}
        {loading && <p style={{ color: "var(--muted)" }}>Loading products...</p>}

        {!loading && products.length === 0 && (
          <div className="card" style={{ textAlign: "center" }}>
            <p>No products found.</p>
          </div>
        )}

        <div className="product-grid">
          {products.map((product) => {
            const badge = productBadge(product);
            return (
              <div key={product.id} className={`product-card ${product.entitled ? "entitled" : ""}`}>
                <span className={`badge ${badge.className}`}>{badge.label}</span>
                <h2 style={{ marginTop: "1rem" }}>{product.name}</h2>
                <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>{product.description}</p>
                <div className="price">{formatPrice(product)}</div>
                {!product.entitled && !product.is_base && (
                  <Link href="/onboarding" className="btn" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                    Subscribe
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
