import { AdminAliExpressOperationsClient } from "@/components/admin-alibaba-operations-client";
import { getAlibabaOperationsDashboardData } from "@/lib/alibaba-operations-service";

export default async function AdminAliExpressSourcingPage() {
  const dashboard = await getAlibabaOperationsDashboardData("dashboard");

  return <AdminAliExpressOperationsClient initialDashboard={dashboard} />;
}