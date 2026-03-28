import { notFound } from "next/navigation";

import { AdminSourcingDashboardClient } from "@/components/admin-sourcing-dashboard-client";
import { AdminAliExpressOperationsClient } from "@/components/admin-alibaba-operations-client";
import { ALIBABA_PANEL_SLUGS, normalizePanelSlug } from "@/lib/alibaba-operations";
import { getAlibabaOperationsDashboardData } from "@/lib/alibaba-operations-service";
import { getSourcingDashboardData } from "@/lib/sourcing-service";

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

  const dashboard = await getAlibabaOperationsDashboardData(normalizedPanel);
  return <AdminAliExpressOperationsClient initialDashboard={dashboard} />;
}
