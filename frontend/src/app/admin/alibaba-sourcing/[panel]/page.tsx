import { notFound } from "next/navigation";

import { AdminAlibabaImportCatalogClient } from "@/components/admin-alibaba-import-catalog-client";
import { AdminAlibabaOperationsClient } from "@/components/admin-alibaba-operations-client";
import { AdminSourcingDashboardClient } from "@/components/admin-sourcing-dashboard-client";
import { AdminSourcingProviderNotice } from "@/components/admin-sourcing-provider-notice";
import { API_URL, buildApiUrl } from "@/lib/api";
import { ALIBABA_PANEL_SLUGS, normalizePanelSlug } from "@/lib/alibaba-operations";
import { getAlibabaOperationsDashboardData } from "@/lib/alibaba-operations-service";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";
import { getSourcingDashboardData } from "@/lib/sourcing-service";

function buildFallbackDashboard(panel: string, detail?: string) {
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
      issue: detail ?? "Le backend admin sourcing est indisponible pour le moment.",
    },
    stats: {
      importedCount: 0,
      publishedCount: 0,
      pendingPayments: 0,
      paidOrders: 0,
    },
  };
}

function normalizeDashboardPayload(panel: string, payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return buildFallbackDashboard(panel, "La reponse dashboard sourcing recue est incomplete ou invalide.");
  }

  const candidate = payload as Record<string, unknown>;
  const storage = candidate.storage && typeof candidate.storage === "object" ? candidate.storage as Record<string, unknown> : {};
  const stats = candidate.stats && typeof candidate.stats === "object" ? candidate.stats as Record<string, unknown> : {};

  return {
    panel: normalizePanelSlug(typeof candidate.panel === "string" ? candidate.panel : panel),
    mappings: Array.isArray(candidate.mappings) ? candidate.mappings : [],
    importJobs: Array.isArray(candidate.importJobs) ? candidate.importJobs : [],
    importedProducts: Array.isArray(candidate.importedProducts) ? candidate.importedProducts : [],
    purchaseOrders: Array.isArray(candidate.purchaseOrders) ? candidate.purchaseOrders : [],
    supplierAccounts: Array.isArray(candidate.supplierAccounts) ? candidate.supplierAccounts : [],
    countries: Array.isArray(candidate.countries) ? candidate.countries : [],
    addresses: Array.isArray(candidate.addresses) ? candidate.addresses : [],
    receptions: Array.isArray(candidate.receptions) ? candidate.receptions : [],
    storage: {
      persistentAvailable: storage.persistentAvailable === true,
      persistentRequired: storage.persistentRequired !== false,
      issue: typeof storage.issue === "string" ? storage.issue : null,
    },
    stats: {
      importedCount: typeof stats.importedCount === "number" && Number.isFinite(stats.importedCount) ? stats.importedCount : 0,
      publishedCount: typeof stats.publishedCount === "number" && Number.isFinite(stats.publishedCount) ? stats.publishedCount : 0,
      pendingPayments: typeof stats.pendingPayments === "number" && Number.isFinite(stats.pendingPayments) ? stats.pendingPayments : 0,
      paidOrders: typeof stats.paidOrders === "number" && Number.isFinite(stats.paidOrders) ? stats.paidOrders : 0,
    },
  };
}

async function getAlibabaDashboardData(panel: string) {
  if (!API_URL) {
    return getAlibabaOperationsDashboardData(panel);
  }

  try {
    const response = await fetch(buildApiUrl("/api/admin/alibaba/dashboard", { panel }), {
      headers: await buildServerForwardHeaders({ accept: "application/json" }, { includeAdminApiToken: true }),
      cache: "no-store",
    });

    if (response.ok) {
      return normalizeDashboardPayload(panel, await response.json().catch(() => null));
    }

    return buildFallbackDashboard(panel, `La route dashboard sourcing a renvoye HTTP ${response.status}.`);
  } catch {
    return buildFallbackDashboard(panel, "Le backend externe est injoignable.");
  }
}

export default async function AdminAlibabaSourcingPanelPage({
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
    return (
      <>
        <AdminSourcingProviderNotice provider="alibaba" />
        <AdminSourcingDashboardClient initialDashboard={dashboard} />
      </>
    );
  }

  const dashboard = await getAlibabaDashboardData(normalizedPanel);
  if (normalizedPanel === "import-catalog") {
    return (
      <>
        <AdminSourcingProviderNotice provider="alibaba" />
        <AdminAlibabaImportCatalogClient initialDashboard={dashboard} adminApiBasePath="/api/admin/alibaba" />
      </>
    );
  }

  return (
    <>
      <AdminSourcingProviderNotice provider="alibaba" />
      <AdminAlibabaOperationsClient initialDashboard={dashboard} adminBasePath="/admin/alibaba-sourcing" adminApiBasePath="/api/admin/alibaba" />
    </>
  );
}
