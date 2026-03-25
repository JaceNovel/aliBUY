import { AdminFreeDealsClient } from "@/components/admin-free-deals-client";
import { getCatalogProducts } from "@/lib/catalog-service";
import { getFreeDealAdminSummary } from "@/lib/free-deal-store";

export default async function AdminFreeDealsPage() {
  const [summary, products] = await Promise.all([
    getFreeDealAdminSummary(),
    getCatalogProducts(),
  ]);

  return (
    <AdminFreeDealsClient
      initialConfig={summary.config}
      metrics={{
        totalClaims: summary.totalClaims,
        blockedClaims: summary.blockedClaims,
        unlockedClaims: summary.unlockedClaims,
        referralVisits: summary.referralVisits,
      }}
      productOptions={products.map((product) => ({
        slug: product.slug,
        title: product.shortTitle,
        minUsd: product.minUsd,
        supplierName: product.supplierName,
      }))}
    />
  );
}
