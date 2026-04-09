import { notFound } from "next/navigation";

import { AdminSourcingDashboardClient } from "@/components/admin-sourcing-dashboard-client";
import { AdminAliExpressImportCatalogClient } from "@/components/admin-aliexpress-import-catalog-client";
import { AdminAliExpressOperationsClient } from "@/components/admin-alibaba-operations-client";
import { API_URL, buildApiUrl } from "@/lib/api";
import { ALIBABA_PANEL_SLUGS, normalizePanelSlug } from "@/lib/alibaba-operations";
import { getAlibabaOperationsDashboardData } from "@/lib/alibaba-operations-service";
import { getSourcingDashboardData } from "@/lib/sourcing-service";

function buildRemoteDashboardUnavailableState(panel: string, detail?: string) {
  const target = API_URL || "backend externe configure";
  const issue = detail
    ? `Le frontend est configure pour utiliser ${target}, mais ${detail}. Les donnees AliExpress doivent venir du backend Laravel connecte a MySQL Hostinger; le fallback local du frontend est desactive pour eviter un faux stockage temporaire.`
    : `Le frontend est configure pour utiliser ${target}, mais la route admin AliExpress n'est pas disponible. Les donnees AliExpress doivent venir du backend Laravel connecte a MySQL Hostinger; le fallback local du frontend est desactive pour eviter un faux stockage temporaire.`;

  return {
    panel: normalizePanelSlug(panel),
    mappings: [],
    importJobs: [],
    importedProducts: [],
    purchaseOrders: [],
    supplierAccounts: [],
    countries: [],
    addresses: [],
    receptions: [],
    storage: {
      persistentAvailable: false,
      persistentRequired: true,
      issue,
    },
    stats: {
      importedCount: 0,
      publishedCount: 0,
      pendingPayments: 0,
      paidOrders: 0,
    },
  };
}

async function getAliExpressDashboardData(panel: string) {
  if (!API_URL) {
    return getAlibabaOperationsDashboardData(panel);
  }

  try {
    const response = await fetch(buildApiUrl("/api/admin/aliexpress/dashboard", { panel }), {
      cache: "no-store",
    });

    if (response.ok) {
      return await response.json();
    }

    return buildRemoteDashboardUnavailableState(panel, `la route /api/admin/aliexpress/dashboard a renvoye HTTP ${response.status}`);
  } catch {
    return buildRemoteDashboardUnavailableState(panel, "le backend externe est injoignable");
  }
}

export default async function AdminAliExpressSourcingPanelPage({
  params,
}: {
  params: Promise<{ panel: string }>;
}) {
  const { panel } = await params;
  const normalizedPanel = normalizePanelSlug(panel);

  if (panel !== normalizedPanel || !ALIBABA_PANEL_SLUGS.includes(normalizedPanel)) {
    notFound();
  }

  if (normalizedPanel === "sourcing-lots") {
    const dashboard = await getSourcingDashboardData();
    return <AdminSourcingDashboardClient initialDashboard={dashboard} />;
  }

  const dashboard = await getAliExpressDashboardData(normalizedPanel);
  if (normalizedPanel === "import-catalog") {
    return <AdminAliExpressImportCatalogClient initialDashboard={dashboard} />;
  }

  return <AdminAliExpressOperationsClient initialDashboard={dashboard} />;
}
