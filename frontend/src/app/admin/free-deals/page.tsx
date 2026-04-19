import { AdminFreeDealsClient } from "@/components/admin-free-deals-client";
import { API_URL } from "@/lib/api";
import { getAlibabaImportedProducts } from "@/lib/alibaba-operations-store";
import { getCatalogProducts } from "@/lib/catalog-service";
import type { FreeDealConfig } from "@/lib/free-deal-store";
import { getFreeDealAdminSummary } from "@/lib/free-deal-store";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";

type FreeDealAdminSummary = Awaited<ReturnType<typeof getFreeDealAdminSummary>>;

async function getRemoteFreeDealConfig() {
  if (!API_URL) {
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/api/admin/free-deals`, {
      headers: await buildServerForwardHeaders({
        accept: "application/json",
      }, {
        includeAdminApiToken: true,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null) as { config?: FreeDealConfig } | null;
    return payload?.config ?? null;
  } catch {
    return null;
  }
}

async function getFreeDealAdminPageSummary(): Promise<FreeDealAdminSummary> {
  const [localSummary, remoteConfig] = await Promise.all([
    getFreeDealAdminSummary(),
    getRemoteFreeDealConfig(),
  ]);

  return remoteConfig ? { ...localSummary, config: remoteConfig } : localSummary;
}

export default async function AdminFreeDealsPage() {
  const [summary, products, importedProducts] = await Promise.all([
    getFreeDealAdminPageSummary(),
    getCatalogProducts(),
    getAlibabaImportedProducts(),
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
        image: product.image,
      }))}
      importedOptions={importedProducts.map((product) => ({
        id: product.id,
        slug: product.slug,
        title: product.shortTitle,
        minUsd: product.minUsd,
        supplierName: product.supplierName,
        image: product.image,
        publishedToSite: product.publishedToSite,
        query: product.query,
      }))}
    />
  );
}
