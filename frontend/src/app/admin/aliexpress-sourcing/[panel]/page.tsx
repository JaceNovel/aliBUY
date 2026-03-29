import { notFound } from "next/navigation";

import { AdminSourcingDashboardClient } from "@/components/admin-sourcing-dashboard-client";
import { AdminAliExpressOperationsClient } from "@/components/admin-alibaba-operations-client";
import { buildApiUrl } from "@/lib/api";
import { ALIBABA_PANEL_SLUGS, normalizePanelSlug } from "@/lib/alibaba-operations";
import { getAlibabaOperationsDashboardData } from "@/lib/alibaba-operations-service";
import { getSourcingDashboardData } from "@/lib/sourcing-service";

async function getAliExpressDashboardData(panel: string) {
  try {
    const response = await fetch(buildApiUrl("/api/admin/aliexpress/dashboard", { panel }), {
      cache: "no-store",
    });

    if (response.ok) {
      return await response.json();
    }
  } catch {
    // Fall back to the local store when the backend API is unreachable.
  }

  return getAlibabaOperationsDashboardData(panel);
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
  return <AdminAliExpressOperationsClient initialDashboard={dashboard} />;
}
