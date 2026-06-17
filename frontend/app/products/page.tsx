import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { ProductsGrid } from "@/components/ProductsGrid";
import { serverApi } from "@/lib/api-server";
import { getUserIdFromSession } from "@/lib/session";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const userId = await getUserIdFromSession();
  if (!userId) redirect("/login");

  const filter = searchParams.filter === "entitled" ? "entitled" : "all";

  let products;
  try {
    products =
      filter === "entitled"
        ? await serverApi.getEntitledProducts(userId)
        : await serverApi.getProducts(userId);
  } catch {
    redirect("/login");
  }

  return (
    <div>
      <AppNav />
      <ProductsGrid products={products} filter={filter} />
    </div>
  );
}
