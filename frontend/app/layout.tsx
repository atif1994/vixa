import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ViXa Platform",
  description: "Customer Identity & Access Management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
