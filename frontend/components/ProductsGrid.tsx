import Link from "next/link";
import type { Product } from "@/lib/types";

function productBadge(product: Product) {
  if (product.is_base && product.entitled) return { label: "Included", className: "badge-included" };
  if (product.entitled) return { label: "Entitled", className: "badge-entitled" };
  return { label: "Upsell", className: "badge-upsell" };
}

function formatPrice(product: Product) {
  if (product.is_base) return "Included";
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: product.currency,
  }).format(product.price_cents / 100);
}

export function ProductsGrid({ products, filter }: { products: Product[]; filter: "all" | "entitled" }) {
  return (
    <div>
      <div style={{ padding: "2rem", maxWidth: 1200, margin: "0 auto" }}>
        <h1 style={{ marginBottom: "0.5rem" }}>
          {filter === "entitled" ? "Your Entitled Products" : "Products & Services"}
        </h1>
        <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
          {filter === "entitled"
            ? "ViXa Platform is included for all customers; subscriptions unlock additional products."
            : "The base platform is included — subscription products show as upsell or entitled."}
        </p>

        <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem" }}>
          <Link
            href="/products"
            style={{ color: filter === "all" ? "var(--primary)" : "var(--muted)", fontWeight: 600 }}
          >
            All Products
          </Link>
          <Link
            href="/products?filter=entitled"
            style={{ color: filter === "entitled" ? "var(--primary)" : "var(--muted)", fontWeight: 600 }}
          >
            My Products
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="card" style={{ textAlign: "center" }}>
            <p>No products found.</p>
          </div>
        ) : (
          <div className="product-grid" style={{ padding: 0 }}>
            {products.map((product) => {
              const badge = productBadge(product);
              return (
                <div key={product.id} className={`product-card ${product.entitled ? "entitled" : ""}`}>
                  <span className={`badge ${badge.className}`}>{badge.label}</span>
                  <h2 style={{ marginTop: "1rem" }}>{product.name}</h2>
                  <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>{product.description}</p>
                  <div className="price">{formatPrice(product)}</div>
                  {!product.entitled && !product.is_base && (
                    <Link
                      href="/onboarding"
                      className="btn"
                      style={{ display: "block", textAlign: "center", textDecoration: "none" }}
                    >
                      Subscribe
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
