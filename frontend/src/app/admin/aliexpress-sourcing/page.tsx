import { AdminAlibabaOperationsClient } from "@/components/admin-alibaba-operations-client";
import { getAlibabaOperationsDashboardData } from "@/lib/alibaba-operations-service";

export default async function AdminAlibabaSourcingPage() {
  const dashboard = await getAlibabaOperationsDashboardData("dashboard");

  return <AdminAlibabaOperationsClient initialDashboard={dashboard} />;
}