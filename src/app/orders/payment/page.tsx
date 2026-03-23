import { InternalPageShell } from "@/components/internal-page-shell";
import { PaymentClient } from "@/app/orders/payment/payment-client";
import { formatFcfa } from "@/lib/alibaba-sourcing";
import { getOrderById, orders } from "@/lib/orders-data";
import { getPricingContext } from "@/lib/pricing";
import { getSourcingOrderById } from "@/lib/sourcing-store";

export default async function OrderPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; paymentId?: string; paymentStatus?: string; status?: string }>;
}) {
  const pricing = await getPricingContext();
  const resolvedSearchParams = await searchParams;
  const sourcingOrder = resolvedSearchParams.orderId ? await getSourcingOrderById(resolvedSearchParams.orderId) : null;

  if (sourcingOrder) {
    const firstItem = sourcingOrder.items[0];

    return (
      <InternalPageShell pricing={pricing}>
        <PaymentClient
          order={{
            kind: "sourcing",
            id: sourcingOrder.id,
            orderNumber: sourcingOrder.orderNumber,
            title: firstItem?.title || `Commande sourcing ${sourcingOrder.orderNumber}`,
            seller: "AfriPay sourcing",
            total: formatFcfa(sourcingOrder.totalPriceFcfa),
            image: firstItem?.image || "/globe.svg",
            itemCount: sourcingOrder.items.length,
            shippingMethod: sourcingOrder.shippingMethod,
            paymentStatus: sourcingOrder.paymentStatus,
            monerooPaymentId: sourcingOrder.monerooPaymentId,
            monerooCheckoutUrl: sourcingOrder.monerooCheckoutUrl,
            monerooPaymentStatus: sourcingOrder.monerooPaymentStatus,
            paymentCurrency: sourcingOrder.paymentCurrency,
            returnPaymentId: resolvedSearchParams.paymentId,
            returnPaymentStatus: resolvedSearchParams.paymentStatus || resolvedSearchParams.status,
          }}
        />
      </InternalPageShell>
    );
  }

  const order = getOrderById(resolvedSearchParams.orderId) ?? orders[0];

  return (
    <InternalPageShell pricing={pricing}>
      <PaymentClient
        order={{
          kind: "legacy",
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