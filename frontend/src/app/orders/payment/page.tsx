import { InternalPageShell } from "@/components/internal-page-shell";
import { PaymentClient } from "@/app/orders/payment/payment-client";
import { formatFcfa, getSourcingOrderMeta } from "@/lib/alibaba-sourcing";
import { getUserOrderRecordById } from "@/lib/order-service";
import { getPricingContext } from "@/lib/pricing";
import { getSourcingOrderById } from "@/lib/sourcing-store";
import { getCurrentUser } from "@/lib/user-auth";
import { redirect } from "next/navigation";

function normalizeEmail(value?: string) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function resolveThirdPartyCartNotice(userId: string, userEmail: string, sourcingOrder: Awaited<ReturnType<typeof getSourcingOrderById>>) {
  if (!sourcingOrder) {
    return undefined;
  }

  const meta = getSourcingOrderMeta(sourcingOrder);
  if (!meta.paymentContext?.createdFromSharedCart) {
    return undefined;
  }

  const normalizedUserEmail = normalizeEmail(userEmail);
  const ownerUserId = meta.sharedCart?.ownerUserId?.trim();
  const ownerEmail = normalizeEmail(meta.sharedCart?.ownerEmail);
  const payerUserId = meta.paymentContext?.payerUserId?.trim();
  const payerEmail = normalizeEmail(meta.paymentContext?.payerEmail);
  const viewerIsOwner = ownerUserId === userId || ownerEmail === normalizedUserEmail;
  const viewerIsPayer = payerUserId === userId || payerEmail === normalizedUserEmail || sourcingOrder.userId === userId || normalizeEmail(sourcingOrder.customerEmail) === normalizedUserEmail;

  if (viewerIsOwner && !viewerIsPayer) {
    return "Commande payée par un ami";
  }

  if (viewerIsPayer) {
    return "Commande Tiers";
  }

  return undefined;
}

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
    ? await getSourcingOrderById(resolvedSearchParams.orderId)
    : null;

  const meta = sourcingOrder ? getSourcingOrderMeta(sourcingOrder) : null;
  const viewerMatchesSharedCart = Boolean(
    sourcingOrder
    && meta
    && (
      meta.sharedCart?.ownerUserId === user.id
      || normalizeEmail(meta.sharedCart?.ownerEmail) === normalizeEmail(user.email)
      || meta.paymentContext?.payerUserId === user.id
      || normalizeEmail(meta.paymentContext?.payerEmail) === normalizeEmail(user.email)
    )
  );

  if (sourcingOrder && (sourcingOrder.userId === user.id || sourcingOrder.customerEmail.toLowerCase() === user.email.toLowerCase() || viewerMatchesSharedCart)) {
    const firstItem = sourcingOrder.items[0];
    const sourcingMeta = meta ?? {};

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
            promoCode: sourcingMeta.promo?.code,
            promoDiscountLabel: sourcingMeta.promo ? formatFcfa(sourcingMeta.promo.discountFcfa) : undefined,
            originalTotal: sourcingMeta.promo ? formatFcfa(sourcingMeta.promo.baseTotalFcfa) : undefined,
            thirdPartyCartCreatorName: sourcingMeta.paymentContext?.thirdPartyCreatorName,
            thirdPartyCartNotice: resolveThirdPartyCartNotice(user.id, user.email, sourcingOrder),
            returnPaymentId: resolvedSearchParams.paymentId,
            returnPaymentStatus: resolvedSearchParams.paymentStatus || resolvedSearchParams.status,
          }}
        />
      </InternalPageShell>
    );
  }

  const order = await getUserOrderRecordById(user, resolvedSearchParams.orderId);

  if (!order) {
    const ordersUrl = new URL("/orders", "https://afripay.local");
    if (resolvedSearchParams.orderId) {
      ordersUrl.searchParams.set("payment", "order_not_found");
      ordersUrl.searchParams.set("orderId", resolvedSearchParams.orderId);
    }
    redirect(`${ordersUrl.pathname}${ordersUrl.search}`);
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
