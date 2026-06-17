import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountActions } from "@/components/AccountActions";
import { serverApi } from "@/lib/api-server";
import { getUserIdFromSession } from "@/lib/session";

export default async function AccountPage() {
  const userId = await getUserIdFromSession();
  if (!userId) redirect("/login");

  let user;
  try {
    user = await serverApi.getUser(userId);
  } catch {
    redirect("/login");
  }

  return (
    <div className="container" style={{ maxWidth: 520 }}>
      <div className="card">
        <div className="logo">Account Settings</div>
        <AccountActions user={user} />
        <p className="footer-link">
          <Link href="/products">Back to Products</Link>
        </p>
      </div>
    </div>
  );
}
