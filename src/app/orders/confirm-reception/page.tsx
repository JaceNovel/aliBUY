import { InternalPageShell } from "@/components/internal-page-shell";
import { ConfirmReceptionClient } from "@/app/orders/confirm-reception/confirm-reception-client";
import { getOrderById, orders } from "@/lib/orders-data";
import { getPricingContext } from "@/lib/pricing";

export default async function ConfirmReceptionPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const pricing = await getPricingContext();
  const resolvedSearchParams = await searchParams;
  const order = getOrderById(resolvedSearchParams.orderId) ?? orders[0];

  return (
    <InternalPageShell pricing={pricing}>
      <ConfirmReceptionClient
        order={{
          id: order.id,
          title: order.title,
          total: order.total,
          image: order.image,
          seller: order.seller,
        }}
      />
    </InternalPageShell>
  );
}