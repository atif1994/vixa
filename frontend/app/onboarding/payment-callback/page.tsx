import { Suspense } from "react";
import PaymentCallbackContent from "./PaymentCallbackContent";

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={<p className="container" style={{ color: "var(--muted)" }}>Loading...</p>}>
      <PaymentCallbackContent />
    </Suspense>
  );
}
