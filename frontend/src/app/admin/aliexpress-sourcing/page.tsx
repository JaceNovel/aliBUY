import { AdminAliExpressOperationsClient } from "@/components/admin-alibaba-operations-client";
import { buildApiUrl } from "@/lib/api";
import { getAlibabaOperationsDashboardData } from "@/lib/alibaba-operations-service";

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

export default async function AdminAliExpressSourcingPage() {
  const dashboard = await getAliExpressDashboardData("dashboard");

  return <AdminAliExpressOperationsClient initialDashboard={dashboard} />;
}