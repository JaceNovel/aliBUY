import "server-only";

import type { AuthenticatedUser } from "@/lib/user-auth";
import { type OrderRecord, type OrderStatus, type OrderTabKey } from "@/lib/order-utils";
import { ensureOrderSupportConversation } from "@/lib/customer-data-store";
import { formatFcfa, getSourcingOrderMeta, type SourcingOrder } from "@/lib/alibaba-sourcing";
import { getUserSourcingOrders } from "@/lib/sourcing-store";

const countryLabels: Record<string, string> = {
  CI: "Cote d'Ivoire",
  CN: "Chine",
  FR: "France",
  GH: "Ghana",
  TG: "Togo",
};

function resolveStatus(order: SourcingOrder): OrderStatus {
  if (order.paymentStatus === "paid") {
    if (order.status === "delivered_to_agent" || order.status === "completed") {
      return "Commande Livree";
    }

    return "Livraison en attente";
  }

  if (order.paymentStatus === "initialized" || order.paymentStatus === "pending") {
    return "Expedition en attente";
  }

  return "Paiement en attente";
}

function resolveTab(status: OrderStatus): OrderTabKey {
  if (status === "Paiement en attente") {
    return "payment-pending";
  }

  if (status === "Expedition en attente") {
    return "shipment-pending";
  }

  if (status === "Livraison en attente") {
    return "delivery-pending";
  }

  return "delivered";
}

function formatOrderDate(dateIso: string) {
  const date = new Date(dateIso);

  return {
    dateLabel: new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(date),
    dateValue: date.toISOString().slice(0, 10),
    timeValue: new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }).format(date),
  };
}

function buildVariant(order: SourcingOrder) {
  return order.items.map((item) => `${item.quantity} x ${item.title}`).join(" • ");
}

function buildTrackingNumber(order: Pick<OrderRecord, "id" | "orderNumber">) {
  const base = order.orderNumber.replace(/[^A-Z0-9]+/gi, "").slice(-10);
  return `AFP-${base}`;
}

function buildLogistics(order: SourcingOrder, status: OrderStatus) {
  const meta = getSourcingOrderMeta(order);
  const workflow = meta.workflow;
  const profile = meta.deliveryProfile;
  const forwarderHubLabel = profile?.forwarder?.hub === "china" || order.countryCode === "CN"
    ? "Chine"
    : profile?.forwarder?.hub === "lome"
      ? "Lomé"
      : undefined;
  const destination = countryLabels[order.countryCode] ?? order.countryCode;
  const corridorLabel = workflow?.routeType === "customer-forwarder"
    ? `Fournisseur -> votre agent ${forwarderHubLabel ?? destination}`
    : `Hub AfriPay -> ${destination}`;
  const transitMode = workflow?.routeType === "customer-forwarder"
    ? `Acheminement vers votre agent ${forwarderHubLabel ?? destination}`
    : order.shippingMethod === "sea"
      ? "Groupage mer, dedouanement puis livraison finale"
      : order.shippingMethod === "freight"
        ? "Fret local fournisseur vers hub interne"
      : "Acheminement express et remise locale";
  const lastUpdate =
    status === "Paiement en attente"
      ? "Paiement en attente de validation avant lancement logistique."
      : status === "Expedition en attente"
        ? "Commande confirmee. Le dossier est en preparation logistique."
        : workflow?.routeType === "customer-forwarder" && order.status === "delivered_to_agent"
          ? "Le colis a ete remis a votre agent. La commande est cloturee avec preuve de remise."
          : order.status === "relay_ready" && workflow?.relayPointAddress
            ? `Votre colis est disponible au point relais ${workflow.relayPointAddress}.`
            : status === "Livraison en attente"
              ? "Le transport est en cours. La remise finale est en attente de confirmation."
              : "Commande remise et archivee dans votre historique.";

  return {
    agentName: workflow?.routeType === "customer-forwarder"
      ? `Agent client ${forwarderHubLabel ?? destination}`
      : order.shippingMethod === "sea"
        ? "Equipe logistique maritime"
        : order.shippingMethod === "freight"
          ? "Equipe fret local Chine"
        : "Equipe logistique express",
    corridorLabel,
    destinationCountry: destination,
    transitMode,
    merchantPickupCompleted: order.paymentStatus !== "unpaid",
    trackingCode: buildTrackingNumber({ id: order.id, orderNumber: order.orderNumber }),
    lastUpdate,
    deliveryRouteType: workflow?.routeType,
    relayPointAddress: workflow?.relayPointAddress,
    relayPointLabel: workflow?.relayPointLabel,
    availableForPickupAt: workflow?.availableForPickupAt,
    deliveredToAgentAt: workflow?.deliveredToAgentAt,
    forwarderHubLabel,
    proofs: workflow?.proofs,
  };
}

async function mapOrderRecord(order: SourcingOrder, user: AuthenticatedUser): Promise<OrderRecord> {
  const status = resolveStatus(order);
  const firstItem = order.items[0];
  const dates = formatOrderDate(order.createdAt);
  const meta = getSourcingOrderMeta(order);
  const conversation = await ensureOrderSupportConversation({
    userId: user.id,
    userEmail: user.email,
    userDisplayName: user.displayName,
    orderId: order.id,
    orderLabel: order.orderNumber,
  });

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    dateLabel: dates.dateLabel,
    dateValue: dates.dateValue,
    timeValue: dates.timeValue,
    total: formatFcfa(order.totalPriceFcfa),
    promoCode: meta.promo?.code,
    promoDiscountLabel: meta.promo ? formatFcfa(meta.promo.discountFcfa) : undefined,
    thirdPartyCartNotice: meta.paymentContext?.createdFromSharedCart && meta.paymentContext.thirdPartyCreatorName
      ? `Commande issue d'un panier tiers cree par ${meta.paymentContext.thirdPartyCreatorName}`
      : undefined,
    seller: "AfriPay sourcing",
    title: firstItem?.title ?? `Commande ${order.orderNumber}`,
    variant: buildVariant(order),
    image: firstItem?.image || "/globe.svg",
    status,
    tab: resolveTab(status),
    supportConversationId: conversation.id,
    logistics: buildLogistics(order, status),
  };
}

export async function getUserOrderRecords(user: AuthenticatedUser) {
  const orders = await getUserSourcingOrders({ userId: user.id, email: user.email });
  const records = await Promise.all(orders.map((order) => mapOrderRecord(order, user)));
  return records.sort((left, right) => right.dateValue.localeCompare(left.dateValue) || right.timeValue.localeCompare(left.timeValue));
}

export async function getUserOrderRecordById(user: AuthenticatedUser, orderId?: string | null) {
  if (!orderId) {
    return null;
  }

  const orders = await getUserOrderRecords(user);
  return orders.find((order) => order.id === orderId) ?? null;
}

export async function getUserOrderRecordByTracking(user: AuthenticatedUser, tracking?: string | null) {
  if (!tracking) {
    return null;
  }

  const orders = await getUserOrderRecords(user);
  return orders.find((order) => buildTrackingNumber(order) === tracking) ?? null;
}

