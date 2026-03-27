import { InternalPageShell } from "@/components/internal-page-shell";
import { PaymentClient } from "@/app/orders/payment/payment-client";
import { formatFcfa } from "@/lib/alibaba-sourcing";
import { getOrderById } from "@/lib/api";
import { getUserOrderRecordById } from "@/lib/order-service";
import { getPricingContext } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/user-auth";
import { notFound, redirect } from "next/navigation";

export default async function OrderPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; paymentId?: string; paymentStatus?: string; status?: string }>;
}) {
  const pricing = await getPricingContext();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/orders/payment");
  }

  const resolvedSearchParams = await searchParams;
  const sourcingOrder = resolvedSearchParams.orderId
    ? await getOrderById(resolvedSearchParams.orderId).catch(() => null)
    : null;

  if (sourcingOrder && sourcingOrder.customerEmail.toLowerCase() === user.email.toLowerCase()) {
    const firstItem = sourcingOrder.items[0];

    return (
      <InternalPageShell pricing={pricing}>
        <PaymentClient
          order={{
            kind: "sourcing",
            id: sourcingOrder.id,
            orderNumber: sourcingOrder.orderNumber,
            title: firstItem?.title || firstItem?.productName || `Commande sourcing ${sourcingOrder.orderNumber}`,
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
            promoCode: sourcingOrder.meta?.promo?.code,
            promoDiscountLabel: sourcingOrder.meta?.promo ? formatFcfa(sourcingOrder.meta.promo.discountFcfa) : undefined,
            originalTotal: sourcingOrder.meta?.promo ? formatFcfa(sourcingOrder.meta.promo.baseTotalFcfa) : undefined,
            thirdPartyCartCreatorName: sourcingOrder.meta?.paymentContext?.thirdPartyCreatorName,
            thirdPartyCartNotice: sourcingOrder.meta?.paymentContext?.createdFromSharedCart && sourcingOrder.meta.paymentContext.thirdPartyCreatorName
              ? `Commande issue d'un panier tiers créé par ${sourcingOrder.meta.paymentContext.thirdPartyCreatorName}`
              : undefined,
            returnPaymentId: resolvedSearchParams.paymentId,
            returnPaymentStatus: resolvedSearchParams.paymentStatus || resolvedSearchParams.status,
          }}
        />
      </InternalPageShell>
    );
  }

  const order = await getUserOrderRecordById(user, resolvedSearchParams.orderId);

  if (!order) {
    notFound();
  }

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
