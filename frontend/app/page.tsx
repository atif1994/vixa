import Link from "next/link";

export default function HomePage() {
  return (
    <div>
      <nav className="nav">
        <span className="nav-brand">ViXa Platform</span>
        <div className="nav-links">
          <Link href="/login">Login</Link>
          <Link href="/register">Register</Link>
          <Link href="/onboarding">Onboarding</Link>
          <Link href="/products">Products</Link>
        </div>
      </nav>
      <div className="container" style={{ maxWidth: 800, textAlign: "center", paddingTop: "4rem" }}>
        <h1 style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>ViXa CIAM Platform</h1>
        <p style={{ color: "var(--muted)", fontSize: "1.125rem", marginBottom: "2rem" }}>
          Identity-first onboarding for the Ost Infinity ecosystem
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
          <Link href="/register" className="btn" style={{ width: "auto", padding: "0.875rem 2rem", display: "inline-block" }}>
            Get Started
          </Link>
          <Link href="/login" className="btn" style={{ width: "auto", padding: "0.875rem 2rem", display: "inline-block", background: "var(--surface)", border: "1px solid var(--border)" }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
