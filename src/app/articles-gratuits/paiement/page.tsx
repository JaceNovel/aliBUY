import { notFound } from "next/navigation";

import { PaymentClient } from "@/app/orders/payment/payment-client";
import { InternalPageShell } from "@/components/internal-page-shell";
import { formatFcfa, getSourcingOrderMeta } from "@/lib/alibaba-sourcing";
import { getPricingContext } from "@/lib/pricing";
import { getSourcingOrderById } from "@/lib/sourcing-store";

export default async function FreeDealPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; paymentId?: string; paymentStatus?: string; status?: string }>;
}) {
  const pricing = await getPricingContext();
  const resolvedSearchParams = await searchParams;
  const order = resolvedSearchParams.orderId ? await getSourcingOrderById(resolvedSearchParams.orderId) : null;

  if (!order) {
    notFound();
  }

  const meta = getSourcingOrderMeta(order);
  if (!meta.freeDeal) {
    notFound();
  }

  const firstItem = order.items[0];

  return (
    <InternalPageShell pricing={pricing}>
      <PaymentClient
        order={{
          kind: "sourcing",
          id: order.id,
          orderNumber: order.orderNumber,
          title: firstItem?.title || `Lot promo ${meta.freeDeal.itemLimit} articles`,
          seller: "AfriPay free deal",
          total: formatFcfa(order.totalPriceFcfa),
          image: firstItem?.image || "/globe.svg",
          itemCount: order.items.length,
          shippingMethod: order.shippingMethod,
          shippingLabel: "Lot promo acquisition",
          paymentStatus: order.paymentStatus,
          monerooPaymentId: order.monerooPaymentId,
          monerooCheckoutUrl: order.monerooCheckoutUrl,
          monerooPaymentStatus: order.monerooPaymentStatus,
          paymentCurrency: order.paymentCurrency,
          returnPaymentId: resolvedSearchParams.paymentId,
          returnPaymentStatus: resolvedSearchParams.paymentStatus || resolvedSearchParams.status,
          heading: "Finaliser l'offre articles gratuits",
          description: `Vous payez uniquement le forfait fixe de ${meta.freeDeal.fixedPriceFcfa ? formatFcfa(meta.freeDeal.fixedPriceFcfa) : formatFcfa(order.totalPriceFcfa)} pour ce lot. Une fois reglee, la page se bloque sur cet appareil jusqu'au prochain debloquage par partage.`,
          badgeLabel: "Offre acquisition",
          backHref: "/articles-gratuits",
          backLabel: "Retour a la page gratuite",
          allowPromoCode: false,
        }}
      />
    </InternalPageShell>
  );
}
