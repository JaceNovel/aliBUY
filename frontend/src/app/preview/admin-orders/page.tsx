import { AdminOrdersPageClient } from "@/components/admin-orders-page-client";
import { getAdminOrders } from "@/lib/admin-data";
import { getPricingContext } from "@/lib/pricing";
import { previewAdminOrderRecord } from "@/app/preview/admin-orders/preview-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminOrdersPreviewPage() {
  const [pricing, orders] = await Promise.all([
    getPricingContext(),
    getAdminOrders({ preferProxy: false }),
  ]);

  const sourceOrders = orders.length > 0 ? orders : [previewAdminOrderRecord];

  const previewOrders = sourceOrders.map((order) => ({
    ...order,
    href: `/preview/admin-orders/${encodeURIComponent(order.id)}`,
    parcelHref: `/preview/admin-orders/${encodeURIComponent(order.id)}`,
  }));

  return (
    <div className="space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      <div className="rounded-[18px] border border-[#d9e2f2] bg-[#f8fbff] px-4 py-3 text-[13px] font-medium text-[#36517a]">
        Prévisualisation locale de l&apos;interface admin commandes.
      </div>
      <AdminOrdersPageClient orders={previewOrders} locale={pricing.locale} />
    </div>
  );
}