import { AdminOrdersPageClient } from "@/components/admin-orders-page-client";
import { getAdminOrders } from "@/lib/admin-data";
import { getPricingContext } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminOrdersPage() {
  const [pricing, orders] = await Promise.all([
    getPricingContext(),
    getAdminOrders(),
  ]);

  return <AdminOrdersPageClient orders={orders} locale={pricing.locale} />;
}