export type OrderTabKey = "all" | "payment-pending" | "shipment-pending" | "delivery-pending" | "delivered";

export type OrderStatus =
  | "Paiement en attente"
  | "Expedition en attente"
  | "Livraison en attente"
  | "Commande Livree";

export type OrderRecord = {
  id: string;
  orderNumber: string;
  dateLabel: string;
  dateValue: string;
  timeValue: string;
  total: string;
  promoCode?: string;
  promoDiscountLabel?: string;
  thirdPartyCartNotice?: string;
  seller: string;
  title: string;
  variant: string;
  image: string;
  status: OrderStatus;
  tab: OrderTabKey;
  supportConversationId?: string;
  logistics: {
    agentName: string;
    corridorLabel: string;
    destinationCountry: string;
    transitMode: string;
    merchantPickupCompleted: boolean;
    trackingCode: string;
    lastUpdate: string;
    deliveryRouteType?: "afripay-final-mile" | "customer-forwarder";
    relayPointAddress?: string;
    relayPointLabel?: string;
    availableForPickupAt?: string;
    deliveredToAgentAt?: string;
    forwarderHubLabel?: string;
    proofs?: Array<{
      id: string;
      role: string;
      title: string;
      note?: string;
      mediaUrl?: string;
      actorLabel?: string;
      createdAt: string;
    }>;
  };
};

export const sidebarItems = [
  "Toutes les commandes",
  "Remboursements et apres-vente",
  "Avis",
  "Coupons et credits",
  "Informations fiscales",
];

function buildTrackingNumber(order: Pick<OrderRecord, "id" | "orderNumber">) {
  const base = order.orderNumber.replace(/[^A-Z0-9]+/gi, "").slice(-10);
  return `AFP-${base}`;
}

export function getOrderTrackingNumber(order: Pick<OrderRecord, "id" | "orderNumber">) {
  return buildTrackingNumber(order);
}

export function getOrderChatHref(order: Pick<OrderRecord, "supportConversationId">) {
  if (!order.supportConversationId) {
    return "/messages";
  }

  return `/messages?conversationId=${encodeURIComponent(order.supportConversationId)}`;
}

export function getOrderTrackingHref(order: Pick<OrderRecord, "id" | "orderNumber">) {
  return `/orders/tracking?orderId=${encodeURIComponent(order.id)}&tracking=${encodeURIComponent(buildTrackingNumber(order))}`;
}

export function getOrderPaymentHref(order: Pick<OrderRecord, "id">) {
  return `/orders/payment?orderId=${encodeURIComponent(order.id)}`;
}

export function getOrderConfirmReceiptHref(order: Pick<OrderRecord, "id">) {
  return `/orders/confirm-reception?orderId=${encodeURIComponent(order.id)}`;
}

export function getOrderDeliveryProofHref(order: Pick<OrderRecord, "id">) {
  return `/orders/delivery-proof?orderId=${encodeURIComponent(order.id)}`;
}

export function getOrderTabs(orders: OrderRecord[]) {
  const paymentPending = orders.filter((order) => order.tab === "payment-pending").length;
  const shipmentPending = orders.filter((order) => order.tab === "shipment-pending").length;
  const deliveryPending = orders.filter((order) => order.tab === "delivery-pending").length;
  const delivered = orders.filter((order) => order.tab === "delivered").length;

  return [
    { key: "all" as const, label: `Toutes les commandes (${orders.length})` },
    { key: "payment-pending" as const, label: `Paiements en attente (${paymentPending})` },
    { key: "shipment-pending" as const, label: `Expeditions en attente (${shipmentPending})` },
    { key: "delivery-pending" as const, label: `Livraisons en attente (${deliveryPending})` },
    { key: "delivered" as const, label: `Commandes livrees (${delivered})` },
  ];
}
