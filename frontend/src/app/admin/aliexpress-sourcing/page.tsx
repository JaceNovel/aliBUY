import { AdminAliExpressOperationsClient } from "@/components/admin-alibaba-operations-client";
import { API_URL, buildApiUrl } from "@/lib/api";
import { getAlibabaOperationsDashboardData } from "@/lib/alibaba-operations-service";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";

function buildRemoteDashboardUnavailableState(detail?: string) {
  const target = API_URL || "backend externe configure";
  const issue = detail
    ? `Le frontend est configure pour utiliser ${target}, mais ${detail}. Les donnees AliExpress doivent venir du backend Laravel connecte a MySQL Hostinger; le fallback local du frontend est desactive pour eviter un faux stockage temporaire.`
    : `Le frontend est configure pour utiliser ${target}, mais la route admin AliExpress n'est pas disponible. Les donnees AliExpress doivent venir du backend Laravel connecte a MySQL Hostinger; le fallback local du frontend est desactive pour eviter un faux stockage temporaire.`;

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
      headers: await buildServerForwardHeaders({
        accept: "application/json",
      }, {
        includeAdminApiToken: true,
      }),
      cache: "no-store",
    });

    if (response.ok) {
      return await response.json();
    }

    const payload = await response.json().catch(() => null) as { message?: unknown } | null;
    const remoteMessageText = typeof payload?.message === "string" && payload.message.trim().length > 0
      ? payload.message.trim()
      : "";
    const remoteMessage = remoteMessageText ? ` (${remoteMessageText})` : "";

    if (response.status === 401) {
      return buildRemoteDashboardUnavailableState(`la route /api/admin/aliexpress/dashboard a renvoye HTTP 401${remoteMessage}. Reconnectez-vous avec un compte admin via /home_jacen pour regenerer le token Laravel utilise par le frontend`);
    }

    return buildRemoteDashboardUnavailableState(`la route /api/admin/aliexpress/dashboard a renvoye HTTP ${response.status}${remoteMessage}`);
  } catch {
    return buildRemoteDashboardUnavailableState("le backend externe est injoignable");
  }
}

export default async function AdminAliExpressSourcingPage() {
  const dashboard = await getAliExpressDashboardData("dashboard");

  return <AdminAliExpressOperationsClient initialDashboard={dashboard} />;
}