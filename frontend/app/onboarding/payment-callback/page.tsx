"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function PaymentCallbackPage() {
  const params = useSearchParams();
  const [message, setMessage] = useState("Processing 3D Secure verification...");

  useEffect(() => {
    const is3ds = params.get("3ds") === "true";
    if (is3ds) {
      setMessage("3D Secure verification complete (mock). Your card has been verified with a €1.00 hold.");
    } else {
      setMessage("Payment callback received.");
    }
  }, [params]);

  return (
    <div className="container">
      <div className="card">
        <div className="logo">ViXa</div>
        <p className="subtitle">Payment Verification</p>
        <div className="success">{message}</div>
        <Link href="/products" className="btn" style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: "1rem" }}>
          Continue to Products
        </Link>
      </div>
    </div>
  );
}
