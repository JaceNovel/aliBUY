import { notFound } from "next/navigation";

import { AdminAlibabaOperationsClient } from "@/components/admin-alibaba-operations-client";
import { ALIBABA_PANEL_SLUGS, normalizePanelSlug } from "@/lib/alibaba-operations";
import { getAlibabaOperationsDashboardData } from "@/lib/alibaba-operations-service";

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

  const dashboard = await getAlibabaOperationsDashboardData(normalizedPanel);
  return <AdminAlibabaOperationsClient initialDashboard={dashboard} />;
}
