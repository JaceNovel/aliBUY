import "server-only";

import { API_URL, buildApiUrl, type ApiOrder } from "@/lib/api";
import { getBackendAccessTokenFromCookies } from "@/lib/backend-access-token";
import type { AuthenticatedUser } from "@/lib/user-auth";
import { type OrderRecord, type OrderStatus, type OrderTabKey } from "@/lib/order-utils";
import { ensureOrderSupportConversation } from "@/lib/customer-data-store";
import { formatFcfa, getSourcingAlibabaPostPaymentAutomationState, getSourcingOrderMeta, type SourcingOrder } from "@/lib/alibaba-sourcing";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";
import { SITE_URL } from "@/lib/site-config";
import { getUserSourcingOrders } from "@/lib/sourcing-store";

const countryLabels: Record<string, string> = {
  CI: "Cote d'Ivoire",
  CN: "Hub AfriPay",
  FR: "France",
  GH: "Ghana",
  TG: "Togo",
};

function normalizeEmail(value?: string) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function hasExternalOrdersApi() {
  if (!API_URL) {
    return false;
  }

  try {
    return new URL(API_URL).host !== new URL(SITE_URL).host;
  } catch {
    return false;
  }
}

async function fetchUserOrderRecordsFromApi() {
  const backendAccessToken = await getBackendAccessTokenFromCookies();
  if (!backendAccessToken) {
    return null;
  }

  const response = await fetch(buildApiUrl("/api/orders"), {
    headers: await buildServerForwardHeaders({
      accept: "application/json",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json().catch(() => null) as { orders?: unknown[] } | null;
  return Array.isArray(payload?.orders) ? payload.orders : null;
}

type RemoteOrderRecord = ApiOrder & {
  countryCode?: string;
  status?: string;
};

function isOrderRecord(value: unknown): value is OrderRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<OrderRecord>;
  return typeof candidate.id === "string"
    && typeof candidate.orderNumber === "string"
    && typeof candidate.dateLabel === "string"
    && typeof candidate.status === "string"
    && typeof candidate.variant === "string"
    && Boolean(candidate.logistics && typeof candidate.logistics === "object");
}

function resolveThirdPartyCartNotice(order: SourcingOrder, user: AuthenticatedUser) {
  const meta = getSourcingOrderMeta(order);
  if (!meta.paymentContext?.createdFromSharedCart) {
    return undefined;
  }

  const userEmail = normalizeEmail(user.email);
  const ownerUserId = meta.sharedCart?.ownerUserId?.trim();
  const ownerEmail = normalizeEmail(meta.sharedCart?.ownerEmail);
  const payerUserId = meta.paymentContext?.payerUserId?.trim();
  const payerEmail = normalizeEmail(meta.paymentContext?.payerEmail);
  const viewerIsOwner = ownerUserId === user.id || ownerEmail === userEmail;
  const viewerIsPayer = payerUserId === user.id || payerEmail === userEmail || order.userId === user.id || normalizeEmail(order.customerEmail) === userEmail;

  if (viewerIsOwner && !viewerIsPayer) {
    return "Commande payée par un ami";
  }

  if (viewerIsPayer) {
    return "Commande Tiers";
  }

  return "Commande Tiers";
}

function resolveStatus(order: SourcingOrder): OrderStatus {
  if (order.paymentStatus === "paid") {
    if (order.status === "delivered_to_agent" || order.status === "completed") {
      return "Commande Livree";
    }

    return "Livraison en attente";
  }

  if (order.paymentStatus === "initialized" || order.paymentStatus === "pending") {
    return "Paiement en attente";
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
  const safeDate = Number.isNaN(date.getTime()) ? new Date(0) : date;

  return {
    dateLabel: new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(safeDate),
    dateValue: safeDate.toISOString().slice(0, 10),
    timeValue: new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }).format(safeDate),
  };
}

function resolveRemoteOrderStatus(order: RemoteOrderRecord): OrderStatus {
  if (order.paymentStatus === "paid") {
    if (order.status === "delivered_to_agent" || order.status === "completed" || order.status === "delivered") {
      return "Commande Livree";
    }

    return "Livraison en attente";
  }

  if (order.paymentStatus === "initialized" || order.paymentStatus === "pending") {
    return "Paiement en attente";
  }

  return "Paiement en attente";
}

function buildRemoteVariant(order: RemoteOrderRecord) {
  return (order.items ?? []).map((item) => {
    const title = item.title || item.productName || "Produit";
    const quantity = Math.max(1, Number(item.quantity ?? 1));
    return `${quantity} x ${title}`;
  }).join(" • ");
}

function buildRemoteLogistics(order: RemoteOrderRecord, status: OrderStatus): OrderRecord["logistics"] {
  const destination = countryLabels[(order.countryCode ?? "").toUpperCase()] ?? order.countryCode ?? "Destination client";
  const corridorLabel = order.shippingMethod === "sea"
    ? `Hub AfriPay -> ${destination}`
    : order.shippingMethod === "freight"
      ? `Fret local -> ${destination}`
      : `Paiement -> ${destination}`;
  const transitMode = status === "Paiement en attente"
    ? "Paiement en attente avant lancement logistique"
    : order.shippingMethod === "sea"
      ? "Groupage maritime puis livraison finale"
      : order.shippingMethod === "freight"
        ? "Acheminement fret et remise locale"
        : "Expedition standard vers votre destination";
  const lastUpdate = status === "Paiement en attente"
    ? "Commande créée. Le paiement doit être finalisé pour poursuivre."
    : status === "Expedition en attente"
      ? "Paiement reçu ou initialisé. Préparation logistique en cours."
      : status === "Livraison en attente"
        ? "Votre commande est en transit."
        : "Commande livrée et archivée.";

  return {
    agentName: order.shippingMethod === "sea"
      ? "Equipe logistique maritime"
      : order.shippingMethod === "freight"
        ? "Equipe logistique AfriPay"
        : "Equipe livraison",
    corridorLabel,
    destinationCountry: destination,
    transitMode,
    merchantPickupCompleted: order.paymentStatus === "paid",
    trackingCode: buildTrackingNumber({ id: order.id, orderNumber: order.orderNumber }),
    lastUpdate,
  };
}

function buildVariant(order: SourcingOrder) {
  return order.items.map((item) => {
    const hasEmbeddedSelection = item.selectionLabel ? item.title.includes(item.selectionLabel) : false;
    const displayTitle = item.selectionLabel && !hasEmbeddedSelection
      ? `${item.title} · ${item.selectionLabel}`
      : item.title;

    return `${item.quantity} x ${displayTitle}`;
  }).join(" • ");
}

function buildTrackingNumber(order: Pick<OrderRecord, "id" | "orderNumber">) {
  const base = order.orderNumber.replace(/[^A-Z0-9]+/gi, "").slice(-10);
  return `AFP-${base}`;
}

function toSortableTimestamp(value?: string) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function formatTrackingEventTime(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("fr-FR");
}

function sortSupplierTrackingEvents(events: NonNullable<NonNullable<OrderRecord["logistics"]["supplierTracking"]>["events"]>) {
  return [...events].sort((left, right) => {
    const diff = toSortableTimestamp(right.eventTime) - toSortableTimestamp(left.eventTime);
    if (diff !== 0) {
      return diff;
    }

    return (right.eventName || right.eventCode || "").localeCompare(left.eventName || left.eventCode || "");
  });
}

function buildSupplierTracking(order: SourcingOrder): OrderRecord["logistics"]["supplierTracking"] | undefined {
  const automation = getSourcingAlibabaPostPaymentAutomationState(order);
  if (!automation) {
    return undefined;
  }

  const trade = automation.trades.find((entry) => entry.tracking.some((tracking) => Boolean(tracking.trackingNumber) || tracking.eventList.length > 0 || Boolean(tracking.carrier) || Boolean(tracking.trackingUrl)));
  if (!trade) {
    return undefined;
  }

  const primaryTracking = trade.tracking.find((entry) => Boolean(entry.trackingNumber) || entry.eventList.length > 0) ?? trade.tracking[0];
  if (!primaryTracking) {
    return undefined;
  }

  const events = sortSupplierTrackingEvents(primaryTracking.eventList.map((entry) => ({ ...entry })));

  return {
    source: "aliexpress",
    tradeId: trade.tradeId,
    carrier: primaryTracking.carrier,
    trackingNumber: primaryTracking.trackingNumber,
    trackingUrl: primaryTracking.trackingUrl,
    currentEventCode: events[0]?.eventCode ?? primaryTracking.currentEventCode,
    syncedAt: trade.trackingCheckedAt,
    paymentStatus: trade.paymentResultStatus,
    events,
  };
}

function buildSupplierTrackingUpdate(supplierTracking?: OrderRecord["logistics"]["supplierTracking"]) {
  if (!supplierTracking) {
    return null;
  }

  const latestEvent = supplierTracking.events[0];
  if (latestEvent) {
    const parts = [
      latestEvent.eventName || latestEvent.eventCode,
      latestEvent.eventLocation,
      formatTrackingEventTime(latestEvent.eventTime),
    ].filter((entry): entry is string => Boolean(entry));

    if (parts.length > 0) {
      return parts.join(" · ");
    }
  }

  if (supplierTracking.trackingNumber) {
    return supplierTracking.carrier
      ? `Suivi AliExpress actif via ${supplierTracking.carrier} · ${supplierTracking.trackingNumber}`
      : `Suivi AliExpress actif · ${supplierTracking.trackingNumber}`;
  }

  return null;
}

function buildLogistics(order: SourcingOrder, status: OrderStatus) {
  const meta = getSourcingOrderMeta(order);
  const workflow = meta.workflow;
  const profile = meta.deliveryProfile;
  const manualFulfillment = meta.manualFulfillment;
  const usesInternalReceptionAddress = profile?.usesInternalReceptionAddress === true;
  const hasDirectSupplierTracking = !usesInternalReceptionAddress && workflow?.routeType !== "customer-forwarder";
  const supplierTracking = hasDirectSupplierTracking ? buildSupplierTracking(order) : undefined;
  const supplierTrackingUpdate = buildSupplierTrackingUpdate(supplierTracking);
  const forwarderHubLabel = profile?.forwarder?.hub === "china" || order.countryCode === "CN"
    ? "Hub AfriPay"
    : profile?.forwarder?.hub === "lome"
      ? "Lomé"
      : undefined;
  const destination = countryLabels[order.countryCode] ?? order.countryCode;
  const corridorLabel = workflow?.routeType === "customer-forwarder"
    ? `Depart -> votre agent ${forwarderHubLabel ?? destination}`
    : usesInternalReceptionAddress
      ? `Hub AfriPay -> ${destination}`
      : `AliExpress -> ${destination}`;
  const transitMode = workflow?.routeType === "customer-forwarder"
    ? `Acheminement vers votre agent ${forwarderHubLabel ?? destination}`
    : !usesInternalReceptionAddress
      ? "Livraison directe AliExpress vers votre adresse"
    : order.shippingMethod === "sea"
      ? "Groupage mer, dedouanement puis livraison finale"
      : order.shippingMethod === "freight"
        ? "Fret local AfriPay vers hub interne"
      : "Acheminement express et remise locale";
  const lastUpdate =
    status === "Paiement en attente"
      ? "Paiement en attente de validation avant lancement logistique."
      : status === "Expedition en attente"
        ? !usesInternalReceptionAddress && workflow?.routeType !== "customer-forwarder"
          ? supplierTrackingUpdate ?? "Commande confirmee. La preparation d'expedition vers votre adresse est en cours."
          : "Commande confirmee. Le dossier est en preparation logistique."
        : workflow?.routeType === "customer-forwarder" && order.status === "delivered_to_agent"
          ? "Le colis a ete remis a votre agent. La commande est cloturee avec preuve de remise."
          : order.status === "relay_ready" && workflow?.relayPointAddress
            ? `Votre colis est disponible au point relais ${workflow.relayPointAddress}.`
            : status === "Livraison en attente"
              ? supplierTrackingUpdate ?? "Le transport est en cours. La remise finale est en attente de confirmation."
              : "Commande remise et archivee dans votre historique.";
  const effectiveLastUpdate = manualFulfillment?.enabled && manualFulfillment.checkpointNote
    ? manualFulfillment.checkpointNote
    : supplierTrackingUpdate ?? lastUpdate;

  return {
    agentName: workflow?.routeType === "customer-forwarder"
      ? `Agent client ${forwarderHubLabel ?? destination}`
      : !usesInternalReceptionAddress
        ? "Livraison directe AliExpress"
      : order.shippingMethod === "sea"
        ? "Equipe logistique maritime"
        : order.shippingMethod === "freight"
          ? "Equipe logistique AfriPay"
        : "Equipe logistique express",
    corridorLabel,
    destinationCountry: destination,
    transitMode,
    merchantPickupCompleted: order.paymentStatus === "paid",
    trackingCode: buildTrackingNumber({ id: order.id, orderNumber: order.orderNumber }),
    lastUpdate: effectiveLastUpdate,
    deliveryRouteType: workflow?.routeType,
    relayPointAddress: workflow?.relayPointAddress,
    relayPointLabel: workflow?.relayPointLabel,
    availableForPickupAt: workflow?.availableForPickupAt,
    deliveredToAgentAt: workflow?.deliveredToAgentAt,
    forwarderHubLabel,
    manualFulfillmentEnabled: manualFulfillment?.enabled,
    manualFulfillmentStatusLabel: manualFulfillment?.statusLabel,
    manualFulfillmentCheckpointLabel: manualFulfillment?.checkpointLabel,
    manualFulfillmentCheckpointNote: manualFulfillment?.checkpointNote,
    manualFulfillmentAgentName: manualFulfillment?.agentName,
    manualFulfillmentAgentPhone: manualFulfillment?.agentPhone,
    manualFulfillmentEtaLabel: manualFulfillment?.etaLabel,
    manualFulfillmentUpdatedAt: manualFulfillment?.lastUpdatedAt,
    supplierTracking,
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
    thirdPartyCartNotice: resolveThirdPartyCartNotice(order, user),
    seller: "AfriPay sourcing",
    title: firstItem?.title ?? `Commande ${order.orderNumber}`,
    variant: buildVariant(order),
    image: firstItem?.image || "/globe.svg",
    paymentCheckoutUrl: order.monerooCheckoutUrl,
    status,
    tab: resolveTab(status),
    supportConversationId: conversation.id,
    logistics: buildLogistics(order, status),
  };
}

async function mapRemoteOrderRecord(order: RemoteOrderRecord, user: AuthenticatedUser): Promise<OrderRecord> {
  const status = resolveRemoteOrderStatus(order);
  const dates = formatOrderDate(order.createdAt);
  const firstItem = order.items?.[0];
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
    total: formatFcfa(order.totalPriceFcfa ?? 0),
    promoCode: order.meta?.promo?.code,
    promoDiscountLabel: typeof order.meta?.promo?.discountFcfa === "number" ? formatFcfa(order.meta.promo.discountFcfa) : undefined,
    seller: "AfriPay",
    title: firstItem?.title || firstItem?.productName || `Commande ${order.orderNumber}`,
    variant: buildRemoteVariant(order),
    image: firstItem?.image || "/globe.svg",
    paymentCheckoutUrl: order.paymentCheckoutUrl || order.monerooCheckoutUrl,
    status,
    tab: resolveTab(status),
    supportConversationId: conversation.id,
    logistics: buildRemoteLogistics(order, status),
  };
}

export async function getUserOrderRecords(user: AuthenticatedUser, options?: { preferProxy?: boolean }) {
  if (options?.preferProxy !== false && hasExternalOrdersApi()) {
    try {
      const proxiedOrders = await fetchUserOrderRecordsFromApi();
      if (proxiedOrders) {
        if (proxiedOrders.every((order) => isOrderRecord(order))) {
          return proxiedOrders;
        }

        const mappedOrders = await Promise.all(proxiedOrders.map((order) => mapRemoteOrderRecord(order as RemoteOrderRecord, user)));
        return mappedOrders;
      }
    } catch {
      // Fall back to the local store when the backend API is unreachable.
    }
  }

  const orders: Awaited<ReturnType<typeof getUserSourcingOrders>> = await getUserSourcingOrders({ userId: user.id, email: user.email });
  const records: OrderRecord[] = await Promise.all(orders.map((order: SourcingOrder) => mapOrderRecord(order, user)));
  return records.sort((left: OrderRecord, right: OrderRecord) => right.dateValue.localeCompare(left.dateValue) || right.timeValue.localeCompare(left.timeValue));
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

