import { InternalPageShell } from "@/components/internal-page-shell";
import { PaymentClient } from "@/app/orders/payment/payment-client";
import { getOrderById, orders } from "@/lib/orders-data";
import { getPricingContext } from "@/lib/pricing";

export default async function OrderPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const pricing = await getPricingContext();
  const resolvedSearchParams = await searchParams;
  const order = getOrderById(resolvedSearchParams.orderId) ?? orders[0];

  return (
    <InternalPageShell pricing={pricing}>
      <PaymentClient
        order={{
          id: order.id,
          title: order.title,
          seller: order.seller,
          total: order.total,
          image: order.image,
        }}
      />
    </InternalPageShell>
  );
}