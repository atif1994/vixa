"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await apiClient.logout();
    router.push("/login");
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}
    >
      Logout
    </button>
  );
}

export function AppNav({ children }: { children?: React.ReactNode }) {
  return (
    <nav className="nav">
      <Link href="/" className="nav-brand">
        ViXa Platform
      </Link>
      <div className="nav-links">
        {children}
        <Link href="/products">Products</Link>
        <Link href="/account">Account</Link>
        <Link href="/observability">Observability</Link>
        <LogoutButton />
      </div>
    </nav>
  );
}
