import { AdminAlibabaOperationsClient } from "@/components/admin-alibaba-operations-client";
import { AdminSourcingProviderNotice } from "@/components/admin-sourcing-provider-notice";
import { API_URL, buildApiUrl } from "@/lib/api";
import { getAlibabaOperationsDashboardData } from "@/lib/alibaba-operations-service";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";

function buildFallbackDashboard(detail?: string) {
  return {
    panel: "dashboard" as const,
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

function normalizeDashboardPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return buildFallbackDashboard("La reponse dashboard sourcing recue est incomplete ou invalide.");
  }

  const candidate = payload as Record<string, unknown>;
  const storage = candidate.storage && typeof candidate.storage === "object" ? candidate.storage as Record<string, unknown> : {};
  const stats = candidate.stats && typeof candidate.stats === "object" ? candidate.stats as Record<string, unknown> : {};

  return {
    panel: "dashboard" as const,
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

async function getAlibabaDashboardData() {
  if (!API_URL) {
    return getAlibabaOperationsDashboardData("dashboard");
  }

  try {
    const response = await fetch(buildApiUrl("/api/admin/alibaba/dashboard", { panel: "dashboard" }), {
      headers: await buildServerForwardHeaders({ accept: "application/json" }, { includeAdminApiToken: true }),
      cache: "no-store",
    });

    if (response.ok) {
      return normalizeDashboardPayload(await response.json().catch(() => null));
    }

    return buildFallbackDashboard(`La route dashboard sourcing a renvoye HTTP ${response.status}.`);
  } catch {
    return buildFallbackDashboard("Le backend externe est injoignable.");
  }
}

export default async function AdminAlibabaSourcingPage() {
  const dashboard = await getAlibabaDashboardData();

  return (
    <>
      <AdminSourcingProviderNotice provider="alibaba" />
      <AdminAlibabaOperationsClient initialDashboard={dashboard} adminBasePath="/admin/alibaba-sourcing" adminApiBasePath="/api/admin/alibaba" />
    </>
  );
}
