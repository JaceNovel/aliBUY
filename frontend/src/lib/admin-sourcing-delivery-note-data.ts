import { createHash } from "node:crypto";

import { getSourcingOrderMeta, type SourcingDeliveryNoteExportRecord, type SourcingOrder } from "@/lib/alibaba-sourcing";
import { canonicalizeCountryCode } from "@/lib/country-utils";
import {
  AFRIPAY_COMPANY_NAME,
  AFRIPAY_COMPANY_PHONE,
  AFRIPAY_DEFAULT_COURIER_CHECKPOINT,
  getAfripayCourierFallbackName,
  getAfripayCourierFallbackPhone,
} from "@/lib/afripay-logistics";
import type { AdminOrderParcelItem, AdminOrderParcelSnapshot } from "@/lib/admin-order-parcel";

export type DeliveryNoteCustomsDetails = {
  natureLabel: string;
  documents: string[];
  declarationLabel: string;
};

const EUROPEAN_UNION_COUNTRY_CODES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT",
  "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

export function getDeliveryNoteCustomerAddressLines(order: SourcingOrder, parcelSnapshot: AdminOrderParcelSnapshot) {
  const fallbackLines = [
    order.addressLine1,
    order.addressLine2,
    [order.postalCode, order.city].filter(Boolean).join(" "),
    order.state,
    order.countryCode,
  ].filter(Boolean);

  return parcelSnapshot.routing.clientAddressLines.length > 0 ? parcelSnapshot.routing.clientAddressLines : fallbackLines;
}

export function isDeliveryNoteEuropeanUnion(order: Pick<SourcingOrder, "countryCode">) {
  return EUROPEAN_UNION_COUNTRY_CODES.has(canonicalizeCountryCode(order.countryCode, ""));
}

export function getDeliveryNoteTradeAreaLabel(order: Pick<SourcingOrder, "countryCode">) {
  return isDeliveryNoteEuropeanUnion(order) ? "Union europeenne" : "Hors Union europeenne";
}

export function getDeliveryNoteTradeAreaDescription(order: Pick<SourcingOrder, "countryCode">) {
  return isDeliveryNoteEuropeanUnion(order)
    ? "Livraison client en Union europeenne."
    : "Livraison client hors Union europeenne.";
}

export function getDeliveryNoteCourierContact(order: SourcingOrder) {
  const meta = getSourcingOrderMeta(order);
  const manualFulfillment = meta.manualFulfillment;

  return {
    courierName: getAfripayCourierFallbackName(manualFulfillment?.agentName),
    courierPhone: getAfripayCourierFallbackPhone(manualFulfillment?.agentPhone),
    courierCheckpoint: manualFulfillment?.checkpointLabel?.trim() || AFRIPAY_DEFAULT_COURIER_CHECKPOINT,
    courierEta: manualFulfillment?.etaLabel?.trim()
      || (order.shippingMethod === "air"
        ? "Distribution prioritaire apres reception locale"
        : order.shippingMethod === "sea"
          ? "Remise planifiee apres degroupage et depot local"
          : "Remise sur coordination logistique"),
  };
}

export function getDeliveryNoteVerificationPayload(order: SourcingOrder) {
  return [
    `order=${order.orderNumber}`,
    `id=${order.id}`,
    `customer=${order.customerName}`,
    `phone=${order.customerPhone}`,
    `total=${order.totalPriceFcfa}`,
    `issuedAt=${order.updatedAt || order.createdAt}`,
    `issuer=${AFRIPAY_COMPANY_NAME}`,
    `issuerPhone=${AFRIPAY_COMPANY_PHONE}`,
  ].join("\n");
}

export function getDeliveryNoteFingerprint(order: SourcingOrder) {
  const digest = createHash("sha256")
    .update(getDeliveryNoteVerificationPayload(order))
    .digest("hex")
    .toUpperCase();

  return `${digest.slice(0, 8)}-${digest.slice(8, 16)}-${digest.slice(16, 24)}-${digest.slice(24, 32)}`;
}

export function getDeliveryNoteDocumentNumber(order: SourcingOrder) {
  const year = new Date(order.createdAt || order.updatedAt || Date.now()).getFullYear();
  const digest = createHash("sha256")
    .update(`${order.id}:${order.orderNumber}:${order.createdAt}`)
    .digest("hex")
    .toUpperCase();

  return `BSD-${year}-${digest.slice(0, 8)}`;
}

export function getDeliveryNoteExportHistory(order: SourcingOrder): SourcingDeliveryNoteExportRecord[] {
  return getSourcingOrderMeta(order).deliveryNoteExports ?? [];
}

export function getDeliveryNoteCustomsDetails(item: AdminOrderParcelItem): DeliveryNoteCustomsDetails {
  const descriptionParts = [item.title, item.selectionLabel, item.packaging]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  const natureLabel = descriptionParts.join(" · ") || item.title;
  const documents = [
    "Facture commerciale / bon de sourcing",
    "Liste de colisage",
    item.sourceProductId ? `Reference marchandise: ${item.sourceProductId}` : "Declaration de valeur unitaire",
  ];

  const declarationLabel = item.overview[0]
    || item.specs[0]?.value
    || "Marchandise commerciale non dangereuse preparee pour remise client.";

  return {
    natureLabel,
    documents,
    declarationLabel,
  };
}