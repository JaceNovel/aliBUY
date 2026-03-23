import { AdminSourcingDashboardClient } from "@/components/admin-sourcing-dashboard-client";
import { getSourcingDashboardData } from "@/lib/sourcing-service";

export default async function AdminAlibabaSourcingPage() {
  const dashboard = await getSourcingDashboardData();

  return <AdminSourcingDashboardClient initialDashboard={dashboard} />;
}