import { canonicalizeCountryCode } from "@/lib/country-utils";
import { type ProductCatalogItem } from "@/lib/products-data";
import { resolveProductUnitPriceUsd } from "@/lib/product-variant-pricing";
import { COUNTRY_CONFIG, CURRENCY_CONFIG, type CountryCode, type CurrencyCode } from "@/lib/pricing-options";

export type MarginMode = "percent" | "fixed";
export type ShippingMethodKey = "air" | "sea" | "freight";
export type SourcingOrderStatus = "checkout_created" | "grouped_sea" | "ready_to_ship" | "submitted_to_supplier" | "air_batch_pending" | "sea_batch_pending" | "supplier_payment_requested" | "supplier_payment_failed" | "supplier_paid_partial" | "supplier_paid" | "shipment_triggered" | "in_transit_to_agent" | "delivered_to_agent" | "relay_ready" | "completed";
export type FreightStatus = "not_requested" | "skipped" | "verified" | "failed";
export type SupplierOrderStatus = "not_created" | "skipped" | "created" | "failed";
export type PaymentStatus = "unpaid" | "initialized" | "pending" | "paid" | "failed" | "cancelled";
export type SeaContainerStatus = "pending" | "ready_to_ship" | "shipped";
export type SourcingBatchMode = "air" | "sea";
export type SourcingAlibabaPaymentRollup = "not_started" | "pending" | "pay_url_available" | "partial" | "paid" | "failed";
export type VariantSelection = Record<string, string>;
export type SourcingDeliveryMode = "direct" | "forwarder";
export type SourcingForwarderHub = "china" | "lome";
export type SourcingDeliveryProofRole = "supplier_to_agent" | "agent_to_forwarder" | "arrival_scan" | "relay_release";

type StoredShippingPreference = {
  key: ShippingMethodKey;
  context: string;
};

export type SourcingSettings = {
  currencyCode: string;
  airRatePerKgFcfa: number;
  airEstimatedDays: string;
  seaRealCostPerCbmFcfa: number;
  seaSellRatePerCbmFcfa: number;
  seaEstimatedDays: string;
  freeAirThresholdFcfa: number;
  freeAirEnabled: boolean;
  airWeightThresholdKg: number;
  containerTargetCbm: number;
  defaultMarginMode: MarginMode;
  defaultMarginValue: number;
  updatedAt: string;
};

export type CartInputItem = {
  slug: string;
  quantity: number;
  selectedVariants?: VariantSelection;
};

export type CartComputedItem = {
  cartKey?: string;
  slug: string;
  title: string;
  quantity: number;
  selectedVariants?: VariantSelection;
  selectionLabel?: string;
  requiredVariantLabels?: string[];
  missingVariantLabels?: string[];
  variantSelectionComplete?: boolean;
  supplierSkuId?: string;
  supplierSkuCode?: string;
  weightKg: number;
  volumeCbm: number;
  supplierPriceFcfa: number;
  marginMode: MarginMode;
  marginValue: number;
  marginAmountFcfa: number;
  finalUnitPriceFcfa: number;
  finalLinePriceFcfa: number;
  image: string;
};

export type ShippingMethodQuote = {
  key: ShippingMethodKey;
  label: string;
  priceFcfa: number;
  deliveryWindow: string;
  isFree: boolean;
  tradeLabel: string;
  tradeDescriptor?: string;
  tradeRateFcfa?: number;
  tradeRateUnit?: string;
};

export type AlibabaSourcingQuote = {
  items: CartComputedItem[];
  cartProductsTotalFcfa: number;
  totalWeightKg: number;
  totalCbm: number;
  shippingOptions: ShippingMethodQuote[];
  recommendedMethod: ShippingMethodKey;
  freeAirRemainingFcfa: number;
  freeShippingMessage: string;
  containerProjection: {
    targetCbm: number;
    projectedCbm: number;
    projectedFillPercent: number;
  };
};

export type SourcingCheckoutAddress = {
  customerAddressId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  googleMapsUrl?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode?: string;
  countryCode: string;
};

export type SourcingForwarderAddress = {
  hub: SourcingForwarderHub;
  addressBlock: string;
  parcelMarking?: string;
};

export type SourcingDeliveryProfile = {
  mode: SourcingDeliveryMode;
  useExactPosition?: boolean;
  googleMapsUrl?: string;
  detectedCountryCode?: string;
  detectedCountryLabel?: string;
  detectedCity?: string;
  usesInternalReceptionAddress?: boolean;
  unsupportedCountry?: boolean;
  unsupportedMessage?: string;
  forwarder?: SourcingForwarderAddress;
};

export type SourcingDeliveryProof = {
  id: string;
  role: SourcingDeliveryProofRole;
  title: string;
  note?: string;
  mediaUrl?: string;
  actorLabel?: string;
  createdAt: string;
};

export type SourcingParcelPhoto = {
  id: string;
  url: string;
  label?: string;
  createdAt: string;
};

export type SourcingParcelMeta = {
  note?: string;
  photos: SourcingParcelPhoto[];
  updatedAt?: string;
};

export type SourcingManualFulfillmentMeta = {
  enabled: boolean;
  statusLabel?: string;
  checkpointLabel?: string;
  checkpointNote?: string;
  agentName?: string;
  agentPhone?: string;
  etaLabel?: string;
  lastUpdatedAt?: string;
};

export type SourcingDeliveryNoteExportRecord = {
  id: string;
  documentNumber: string;
  disposition: "inline" | "attachment";
  exportedAt: string;
  exportedByEmail?: string;
};

export type SourcingOrderWorkflow = {
  routeType: "afripay-final-mile" | "customer-forwarder";
  freeDeliveryEligible: boolean;
  supplierDeliveryAddressRole: "afripay-agent" | "forwarder";
  relayPointAddress?: string;
  relayPointLabel?: string;
  availableForPickupAt?: string;
  deliveredToAgentAt?: string;
  completedAt?: string;
  proofs: SourcingDeliveryProof[];
};

export type SourcingPromoAdjustment = {
  code: string;
  label: string;
  discountFcfa: number;
  baseTotalFcfa: number;
  finalTotalFcfa: number;
  appliedAt: string;
};

export type SourcingSharedCartContext = {
  token: string;
  ownerUserId: string;
  ownerEmail: string;
  ownerDisplayName: string;
  message?: string;
  importedAt: string;
};

export type SourcingPaymentContext = {
  payerUserId?: string;
  payerDisplayName: string;
  payerEmail: string;
  paymentMethod?: "card" | "mobile" | "pay_on_delivery";
  payOnDeliveryIdentityFirstName?: string;
  payOnDeliveryIdentityLastName?: string;
  createdFromSharedCart: boolean;
  thirdPartyCreatorName?: string;
  thirdPartyCreatorEmail?: string;
};

export type SourcingManyChatContext = {
  subscriberId: string;
  flowId?: string;
  paidTagId?: string;
  orderConfirmationSentAt?: string;
  lastFlowResponse?: unknown;
  cartReminderSentAt?: string;
  lastCartReminderResponse?: unknown;
  logisticsLastSentAt?: string;
  logisticsLastStatusSent?: string;
  lastLogisticsResponse?: unknown;
};

export type SourcingFreeDealMeta = {
  campaignKey: string;
  fixedPriceEur: number;
  fixedPriceFcfa: number;
  itemLimit: number;
  referralGoal: number;
  selectedProductSlugs: string[];
  deviceIdHash: string;
  ipHash?: string;
  userAgentHash?: string;
};

export type SourcingAlibabaTrackingSnapshot = {
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  currentEventCode?: string;
  eventList: Array<{
    eventCode?: string;
    eventLocation?: string;
    eventName?: string;
    eventTime?: string;
  }>;
  eventCount: number;
};

export type SourcingAlibabaTradeAutomationState = {
  tradeId: string;
  paymentRequestedAt?: string;
  paymentRequestStatus: "requested" | "skipped" | "failed";
  paymentRequestCode?: string;
  paymentRequestMessage?: string;
  payUrl?: string;
  paymentResultCheckedAt?: string;
  paymentResultStatus?: string;
  paymentResultCode?: string;
  paymentResultMessage?: string;
  trackingCheckedAt?: string;
  trackingStatus?: "success" | "failed";
  trackingCode?: string;
  trackingMessage?: string;
  tracking: SourcingAlibabaTrackingSnapshot[];
};

export type SourcingAlibabaPostPaymentAutomationState = {
  lastProcessedAt: string;
  lastTrigger: string;
  trades: SourcingAlibabaTradeAutomationState[];
};

export type SourcingOrderMeta = {
  deliveryProfile?: SourcingDeliveryProfile;
  workflow?: SourcingOrderWorkflow;
  parcel?: SourcingParcelMeta;
  manualFulfillment?: SourcingManualFulfillmentMeta;
  deliveryNoteExports?: SourcingDeliveryNoteExportRecord[];
  promo?: SourcingPromoAdjustment;
  sharedCart?: SourcingSharedCartContext;
  paymentContext?: SourcingPaymentContext;
  manychat?: SourcingManyChatContext;
  freeDeal?: SourcingFreeDealMeta;
};

export type SourcingCheckoutInput = SourcingCheckoutAddress & {
  userId?: string;
  items: CartInputItem[];
  shippingMethod: ShippingMethodKey;
  paymentMethod?: "card" | "mobile" | "pay_on_delivery";
  payOnDeliveryIdentityFirstName?: string;
  payOnDeliveryIdentityLastName?: string;
  notes?: string;
  deliveryProfile?: SourcingDeliveryProfile;
  promoCode?: string;
  sharedCartToken?: string;
  payerDisplayName?: string;
  payerEmail?: string;
  manychatSubscriberId?: string;
  manychatFlowId?: string;
  manychatPaidTagId?: string;
};

export type SourcingOrderItem = CartComputedItem;

export type SourcingOrder = SourcingCheckoutAddress & {
  id: string;
  orderNumber: string;
  userId?: string;
  shippingMethod: ShippingMethodKey;
  shippingCostFcfa: number;
  cartProductsTotalFcfa: number;
  totalPriceFcfa: number;
  totalWeightKg: number;
  totalVolumeCbm: number;
  status: SourcingOrderStatus;
  freightStatus: FreightStatus;
  supplierOrderStatus: SupplierOrderStatus;
  paymentStatus: PaymentStatus;
  paymentProvider?: "moneroo" | "paypal";
  paymentCurrency: string;
  alibabaTradeIds: string[];
  freightPayload?: unknown;
  supplierOrderPayload?: unknown;
  monerooPaymentId?: string;
  monerooCheckoutUrl?: string;
  monerooPaymentStatus?: string;
  monerooPaymentPayload?: unknown;
  monerooInitializedAt?: string;
  monerooVerifiedAt?: string;
  paidAt?: string;
  containerId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  items: SourcingOrderItem[];
};

export type SourcingSeaContainer = {
  id: string;
  code: string;
  targetCbm: number;
  currentCbm: number;
  fillPercent: number;
  status: SeaContainerStatus;
  orderIds: string[];
  orderCount: number;
  createdAt: string;
  updatedAt: string;
  readyToShipAt?: string;
  shipmentTriggeredAt?: string;
};

export type AlibabaIntegrationLog = {
  id: string;
  orderId?: string;
  action: string;
  endpoint: string;
  status: string;
  requestBody?: unknown;
  responseBody?: unknown;
  createdAt: string;
};

export type AlibabaCatalogMapping = {
  slug: string;
  alibabaProductId?: string;
  supplierCompanyId?: string;
  skuId?: string;
  dispatchLocation?: string;
  shippingFromCountryCode?: string;
};

const FCFA_LOCALE = "fr-FR";
const SOURCING_META_KEY = "__afripaySourcingMeta";
export const USD_TO_FCFA = 610;
export const AIR_BATCH_TARGET_KG = 2;
export const SEA_BATCH_TARGET_CBM = 1;
export const INTERNAL_RECEPTION_COUNTRY_CODES = ["TG", "BJ", "GH", "CI", "BF"] as const;
export const LOME_CHINA_HUB_COUNTRY_CODES = ["TG", "GH", "CI"] as const;
export const SUPPORTED_DIRECT_DELIVERY_COUNTRY_CODES = (Object.keys(COUNTRY_CONFIG) as CountryCode[])
  .filter((code) => !INTERNAL_RECEPTION_COUNTRY_CODES.includes(code as (typeof INTERNAL_RECEPTION_COUNTRY_CODES)[number]));
export const SUPPORTED_FORWARDER_COUNTRY_CODES = ["CN"] as const;
export const EUROPEAN_UNION_COUNTRY_CODES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT",
  "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
] as const;

export function isInternalReceptionCountry(countryCode?: string) {
  const normalizedCode = canonicalizeCountryCode(countryCode, "TG");
  return INTERNAL_RECEPTION_COUNTRY_CODES.includes(normalizedCode as (typeof INTERNAL_RECEPTION_COUNTRY_CODES)[number]);
}

export function usesLomeChinaHub(countryCode?: string) {
  const normalizedCode = canonicalizeCountryCode(countryCode, "TG");
  return LOME_CHINA_HUB_COUNTRY_CODES.includes(normalizedCode as (typeof LOME_CHINA_HUB_COUNTRY_CODES)[number]);
}

export function getLomeChinaHubGuidance(countryCode?: string) {
  if (!usesLomeChinaHub(countryCode)) {
    return null;
  }

  return {
    destinationLabel: "Lome, Togo",
    eligibleCountryCodes: [...LOME_CHINA_HUB_COUNTRY_CODES],
    eligibleCountryLabels: ["Cote d'Ivoire", "Ghana", "Togo"],
    operatorName: "AfriPay Space",
    contactPhone: "13760612978/15234022495",
    supportPhone: "+33688639294",
    modes: {
      air: {
        key: "air" as const,
        title: "Adresse colis aerien",
        badge: "Voie aerienne",
        contactName: "易运国际贝宁空运",
        phone: "13760612978/15234022495",
        addressLine1: "广州市白云区黄石西路474号",
        addressLine2: "石井仓库三号仓十三号门(3-13) 易运国际贝宁空运 Avion",
        city: "Guangzhou",
        state: "Guangdong",
        postalCode: "510000",
        countryCode: "CN",
        shippingMark: "AfriPay.Space. +33688639294 Direction lome togo voie aerien",
      },
      sea: {
        key: "sea" as const,
        title: "Adresse colis maritime",
        badge: "Voie maritime",
        contactName: "易运国际贝宁海运",
        phone: "13760612978/15234022495",
        addressLine1: "广州市白云区黄石西路474号",
        addressLine2: "石井仓库三号仓十三B号门(3-13B) 易运国际贝宁海运 (Bateau)",
        city: "Guangzhou",
        state: "Guangdong",
        postalCode: "510000",
        countryCode: "CN",
        port: "Guangzhou",
        portCode: "CNGZH",
        shippingMark: "AfriPay.Space. +33688639294 Direction lome togo voie maritime",
      },
    },
  };
}

export function isSupportedDirectDeliveryCountry(countryCode?: string) {
  const normalizedCode = canonicalizeCountryCode(countryCode, "TG") as CountryCode;
  return SUPPORTED_DIRECT_DELIVERY_COUNTRY_CODES.includes(normalizedCode);
}

export function isEuropeanUnionCountry(countryCode?: string) {
  const normalizedCode = canonicalizeCountryCode(countryCode, "TG");
  return EUROPEAN_UNION_COUNTRY_CODES.includes(normalizedCode as (typeof EUROPEAN_UNION_COUNTRY_CODES)[number]);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeAlibabaTrackingSnapshot(value: unknown): SourcingAlibabaTrackingSnapshot | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  const eventList = Array.isArray(value.eventList)
    ? value.eventList.flatMap((event) => {
        if (!isObjectRecord(event)) {
          return [] as SourcingAlibabaTrackingSnapshot["eventList"];
        }

        return [{
          eventCode: typeof event.eventCode === "string" ? event.eventCode : undefined,
          eventLocation: typeof event.eventLocation === "string" ? event.eventLocation : undefined,
          eventName: typeof event.eventName === "string" ? event.eventName : undefined,
          eventTime: typeof event.eventTime === "string" ? event.eventTime : undefined,
        }];
      })
    : [];

  return {
    carrier: typeof value.carrier === "string" ? value.carrier : undefined,
    trackingNumber: typeof value.trackingNumber === "string" ? value.trackingNumber : undefined,
    trackingUrl: typeof value.trackingUrl === "string" ? value.trackingUrl : undefined,
    currentEventCode: typeof value.currentEventCode === "string" ? value.currentEventCode : undefined,
    eventList,
    eventCount: eventList.length,
  };
}

function normalizeAlibabaTradeAutomationState(value: unknown): SourcingAlibabaTradeAutomationState | null {
  if (!isObjectRecord(value) || typeof value.tradeId !== "string") {
    return null;
  }

  return {
    tradeId: value.tradeId,
    paymentRequestedAt: typeof value.paymentRequestedAt === "string" ? value.paymentRequestedAt : undefined,
    paymentRequestStatus: value.paymentRequestStatus === "requested" || value.paymentRequestStatus === "failed" ? value.paymentRequestStatus : "skipped",
    paymentRequestCode: typeof value.paymentRequestCode === "string" ? value.paymentRequestCode : undefined,
    paymentRequestMessage: typeof value.paymentRequestMessage === "string" ? value.paymentRequestMessage : undefined,
    payUrl: typeof value.payUrl === "string" ? value.payUrl : undefined,
    paymentResultCheckedAt: typeof value.paymentResultCheckedAt === "string" ? value.paymentResultCheckedAt : undefined,
    paymentResultStatus: typeof value.paymentResultStatus === "string" ? value.paymentResultStatus : undefined,
    paymentResultCode: typeof value.paymentResultCode === "string" ? value.paymentResultCode : undefined,
    paymentResultMessage: typeof value.paymentResultMessage === "string" ? value.paymentResultMessage : undefined,
    trackingCheckedAt: typeof value.trackingCheckedAt === "string" ? value.trackingCheckedAt : undefined,
    trackingStatus: value.trackingStatus === "success" || value.trackingStatus === "failed" ? value.trackingStatus : undefined,
    trackingCode: typeof value.trackingCode === "string" ? value.trackingCode : undefined,
    trackingMessage: typeof value.trackingMessage === "string" ? value.trackingMessage : undefined,
    tracking: Array.isArray(value.trackingList)
      ? value.trackingList.map(normalizeAlibabaTrackingSnapshot).filter((entry): entry is SourcingAlibabaTrackingSnapshot => Boolean(entry))
      : [],
  };
}

function getKnownCurrency(candidate?: string) {
  if (!candidate) {
    return CURRENCY_CONFIG.XOF;
  }

  const normalized = candidate.trim().toUpperCase() as CurrencyCode;
  return CURRENCY_CONFIG[normalized] ?? CURRENCY_CONFIG.XOF;
}

function normalizeHub(candidate?: string): SourcingForwarderHub {
  return candidate === "china" ? "china" : "lome";
}

function normalizeDeliveryProofRole(candidate?: string): SourcingDeliveryProofRole {
  switch (candidate) {
    case "agent_to_forwarder":
    case "arrival_scan":
    case "relay_release":
      return candidate;
    default:
      return "supplier_to_agent";
  }
}

function normalizeDeliveryProof(value: unknown): SourcingDeliveryProof | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  const id = typeof value.id === "string" ? value.id : "";
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : "";
  if (!id || !title || !createdAt) {
    return null;
  }

  return {
    id,
    role: normalizeDeliveryProofRole(typeof value.role === "string" ? value.role : undefined),
    title,
    note: typeof value.note === "string" ? value.note : undefined,
    mediaUrl: typeof value.mediaUrl === "string" ? value.mediaUrl : undefined,
    actorLabel: typeof value.actorLabel === "string" ? value.actorLabel : undefined,
    createdAt,
  };
}

function normalizeParcelPhoto(value: unknown): SourcingParcelPhoto | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  const id = typeof value.id === "string" ? value.id.trim() : "";
  const url = typeof value.url === "string" ? value.url.trim() : "";
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : "";
  if (!id || !url || !createdAt) {
    return null;
  }

  return {
    id,
    url,
    label: typeof value.label === "string" && value.label.trim().length > 0 ? value.label.trim() : undefined,
    createdAt,
  };
}

function normalizeParcelMeta(value: unknown): SourcingParcelMeta | undefined {
  if (!isObjectRecord(value)) {
    return undefined;
  }

  const note = typeof value.note === "string" && value.note.trim().length > 0 ? value.note.trim() : undefined;
  const photos = Array.isArray(value.photos)
    ? value.photos.map(normalizeParcelPhoto).filter((entry): entry is SourcingParcelPhoto => Boolean(entry))
    : [];

  if (!note && photos.length === 0 && typeof value.updatedAt !== "string") {
    return undefined;
  }

  return {
    note,
    photos,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : undefined,
  };
}

function normalizeManualFulfillmentMeta(value: unknown): SourcingManualFulfillmentMeta | undefined {
  if (!isObjectRecord(value)) {
    return undefined;
  }

  return {
    enabled: value.enabled === true,
    statusLabel: typeof value.statusLabel === "string" && value.statusLabel.trim().length > 0 ? value.statusLabel.trim() : undefined,
    checkpointLabel: typeof value.checkpointLabel === "string" && value.checkpointLabel.trim().length > 0 ? value.checkpointLabel.trim() : undefined,
    checkpointNote: typeof value.checkpointNote === "string" && value.checkpointNote.trim().length > 0 ? value.checkpointNote.trim() : undefined,
    agentName: typeof value.agentName === "string" && value.agentName.trim().length > 0 ? value.agentName.trim() : undefined,
    agentPhone: typeof value.agentPhone === "string" && value.agentPhone.trim().length > 0 ? value.agentPhone.trim() : undefined,
    etaLabel: typeof value.etaLabel === "string" && value.etaLabel.trim().length > 0 ? value.etaLabel.trim() : undefined,
    lastUpdatedAt: typeof value.lastUpdatedAt === "string" ? value.lastUpdatedAt : undefined,
  };
}

function normalizeDeliveryNoteExportRecord(value: unknown): SourcingDeliveryNoteExportRecord | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  const id = typeof value.id === "string" ? value.id.trim() : "";
  const documentNumber = typeof value.documentNumber === "string" ? value.documentNumber.trim() : "";
  const exportedAt = typeof value.exportedAt === "string" ? value.exportedAt : "";

  if (!id || !documentNumber || !exportedAt) {
    return null;
  }

  return {
    id,
    documentNumber,
    disposition: value.disposition === "inline" ? "inline" : "attachment",
    exportedAt,
    exportedByEmail: typeof value.exportedByEmail === "string" && value.exportedByEmail.trim().length > 0 ? value.exportedByEmail.trim() : undefined,
  };
}

function normalizeDeliveryNoteExportHistory(value: unknown): SourcingDeliveryNoteExportRecord[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const history = value
    .map(normalizeDeliveryNoteExportRecord)
    .filter((entry): entry is SourcingDeliveryNoteExportRecord => Boolean(entry))
    .sort((left, right) => right.exportedAt.localeCompare(left.exportedAt));

  return history.length > 0 ? history : undefined;
}

function normalizeDeliveryProfile(value: unknown): SourcingDeliveryProfile | undefined {
  if (!isObjectRecord(value)) {
    return undefined;
  }

  const mode = value.mode === "forwarder" ? "forwarder" : "direct";
  const forwarder = isObjectRecord(value.forwarder)
    ? {
        hub: normalizeHub(typeof value.forwarder.hub === "string" ? value.forwarder.hub : undefined),
        addressBlock: typeof value.forwarder.addressBlock === "string" ? value.forwarder.addressBlock : "",
        parcelMarking: typeof value.forwarder.parcelMarking === "string" ? value.forwarder.parcelMarking : undefined,
      } satisfies SourcingForwarderAddress
    : undefined;

  return {
    mode,
    useExactPosition: value.useExactPosition === true,
    googleMapsUrl: typeof value.googleMapsUrl === "string" ? value.googleMapsUrl : undefined,
    detectedCountryCode: typeof value.detectedCountryCode === "string" ? value.detectedCountryCode : undefined,
    detectedCountryLabel: typeof value.detectedCountryLabel === "string" ? value.detectedCountryLabel : undefined,
    detectedCity: typeof value.detectedCity === "string" ? value.detectedCity : undefined,
    usesInternalReceptionAddress: value.usesInternalReceptionAddress === true,
    unsupportedCountry: value.unsupportedCountry === true,
    unsupportedMessage: typeof value.unsupportedMessage === "string" ? value.unsupportedMessage : undefined,
    forwarder,
  };
}

function normalizeOrderWorkflow(value: unknown): SourcingOrderWorkflow | undefined {
  if (!isObjectRecord(value)) {
    return undefined;
  }

  return {
    routeType: value.routeType === "customer-forwarder" ? "customer-forwarder" : "afripay-final-mile",
    freeDeliveryEligible: value.freeDeliveryEligible !== false,
    supplierDeliveryAddressRole: value.supplierDeliveryAddressRole === "forwarder" ? "forwarder" : "afripay-agent",
    relayPointAddress: typeof value.relayPointAddress === "string" ? value.relayPointAddress : undefined,
    relayPointLabel: typeof value.relayPointLabel === "string" ? value.relayPointLabel : undefined,
    availableForPickupAt: typeof value.availableForPickupAt === "string" ? value.availableForPickupAt : undefined,
    deliveredToAgentAt: typeof value.deliveredToAgentAt === "string" ? value.deliveredToAgentAt : undefined,
    completedAt: typeof value.completedAt === "string" ? value.completedAt : undefined,
    proofs: Array.isArray(value.proofs) ? value.proofs.map(normalizeDeliveryProof).filter((entry): entry is SourcingDeliveryProof => Boolean(entry)) : [],
  };
}

function normalizePromoAdjustment(value: unknown): SourcingPromoAdjustment | undefined {
  if (!isObjectRecord(value)) {
    return undefined;
  }

  const code = typeof value.code === "string" ? value.code.trim().toUpperCase() : "";
  const label = typeof value.label === "string" ? value.label.trim() : "";
  const appliedAt = typeof value.appliedAt === "string" ? value.appliedAt : "";
  if (!code || !label || !appliedAt) {
    return undefined;
  }

  return {
    code,
    label,
    discountFcfa: typeof value.discountFcfa === "number" ? value.discountFcfa : Number(value.discountFcfa ?? 0),
    baseTotalFcfa: typeof value.baseTotalFcfa === "number" ? value.baseTotalFcfa : Number(value.baseTotalFcfa ?? 0),
    finalTotalFcfa: typeof value.finalTotalFcfa === "number" ? value.finalTotalFcfa : Number(value.finalTotalFcfa ?? 0),
    appliedAt,
  };
}

function normalizeSharedCartContext(value: unknown): SourcingSharedCartContext | undefined {
  if (!isObjectRecord(value)) {
    return undefined;
  }

  const token = typeof value.token === "string" ? value.token.trim() : "";
  const ownerUserId = typeof value.ownerUserId === "string" ? value.ownerUserId.trim() : "";
  const ownerEmail = typeof value.ownerEmail === "string" ? value.ownerEmail.trim() : "";
  const ownerDisplayName = typeof value.ownerDisplayName === "string" ? value.ownerDisplayName.trim() : "";
  const importedAt = typeof value.importedAt === "string" ? value.importedAt : "";
  if (!token || !ownerUserId || !ownerEmail || !ownerDisplayName || !importedAt) {
    return undefined;
  }

  return {
    token,
    ownerUserId,
    ownerEmail,
    ownerDisplayName,
    message: typeof value.message === "string" ? value.message : undefined,
    importedAt,
  };
}

function normalizePaymentContext(value: unknown): SourcingPaymentContext | undefined {
  if (!isObjectRecord(value)) {
    return undefined;
  }

  const payerDisplayName = typeof value.payerDisplayName === "string" ? value.payerDisplayName.trim() : "";
  const payerEmail = typeof value.payerEmail === "string" ? value.payerEmail.trim() : "";
  if (!payerDisplayName || !payerEmail) {
    return undefined;
  }

  return {
    payerUserId: typeof value.payerUserId === "string" ? value.payerUserId : undefined,
    payerDisplayName,
    payerEmail,
    paymentMethod: value.paymentMethod === "mobile" || value.paymentMethod === "pay_on_delivery" ? value.paymentMethod : "card",
    payOnDeliveryIdentityFirstName: typeof value.payOnDeliveryIdentityFirstName === "string" ? value.payOnDeliveryIdentityFirstName : undefined,
    payOnDeliveryIdentityLastName: typeof value.payOnDeliveryIdentityLastName === "string" ? value.payOnDeliveryIdentityLastName : undefined,
    createdFromSharedCart: value.createdFromSharedCart === true,
    thirdPartyCreatorName: typeof value.thirdPartyCreatorName === "string" ? value.thirdPartyCreatorName : undefined,
    thirdPartyCreatorEmail: typeof value.thirdPartyCreatorEmail === "string" ? value.thirdPartyCreatorEmail : undefined,
  };
}

function normalizeManyChatContext(value: unknown): SourcingManyChatContext | undefined {
  if (!isObjectRecord(value)) {
    return undefined;
  }

  const subscriberId = typeof value.subscriberId === "string" ? value.subscriberId.trim() : "";
  if (!subscriberId) {
    return undefined;
  }

  return {
    subscriberId,
    flowId: typeof value.flowId === "string" && value.flowId.trim().length > 0 ? value.flowId.trim() : undefined,
    paidTagId: typeof value.paidTagId === "string" && value.paidTagId.trim().length > 0 ? value.paidTagId.trim() : undefined,
    orderConfirmationSentAt: typeof value.orderConfirmationSentAt === "string" ? value.orderConfirmationSentAt : undefined,
    lastFlowResponse: "lastFlowResponse" in value ? value.lastFlowResponse : undefined,
    cartReminderSentAt: typeof value.cartReminderSentAt === "string" ? value.cartReminderSentAt : undefined,
    lastCartReminderResponse: "lastCartReminderResponse" in value ? value.lastCartReminderResponse : undefined,
    logisticsLastSentAt: typeof value.logisticsLastSentAt === "string" ? value.logisticsLastSentAt : undefined,
    logisticsLastStatusSent: typeof value.logisticsLastStatusSent === "string" ? value.logisticsLastStatusSent : undefined,
    lastLogisticsResponse: "lastLogisticsResponse" in value ? value.lastLogisticsResponse : undefined,
  };
}

function normalizeFreeDealMeta(value: unknown): SourcingFreeDealMeta | undefined {
  if (!isObjectRecord(value)) {
    return undefined;
  }

  const campaignKey = typeof value.campaignKey === "string" ? value.campaignKey.trim() : "";
  const deviceIdHash = typeof value.deviceIdHash === "string" ? value.deviceIdHash.trim() : "";
  const itemLimit = typeof value.itemLimit === "number" ? value.itemLimit : Number(value.itemLimit ?? 0);
  const referralGoal = typeof value.referralGoal === "number" ? value.referralGoal : Number(value.referralGoal ?? 0);

  if (!campaignKey || !deviceIdHash || !Number.isFinite(itemLimit) || itemLimit <= 0 || !Number.isFinite(referralGoal) || referralGoal < 0) {
    return undefined;
  }

  return {
    campaignKey,
    fixedPriceEur: typeof value.fixedPriceEur === "number" ? value.fixedPriceEur : Number(value.fixedPriceEur ?? 0),
    fixedPriceFcfa: typeof value.fixedPriceFcfa === "number" ? value.fixedPriceFcfa : Number(value.fixedPriceFcfa ?? 0),
    itemLimit,
    referralGoal,
    selectedProductSlugs: Array.isArray(value.selectedProductSlugs)
      ? value.selectedProductSlugs.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [],
    deviceIdHash,
    ipHash: typeof value.ipHash === "string" ? value.ipHash : undefined,
    userAgentHash: typeof value.userAgentHash === "string" ? value.userAgentHash : undefined,
  };
}

export function normalizeVariantSelection(selection?: VariantSelection) {
  if (!selection) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(selection)
      .map(([label, value]) => [label.trim(), value.trim()] as const)
      .filter(([label, value]) => label.length > 0 && value.length > 0)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function formatVariantSelection(selection?: VariantSelection) {
  const normalized = normalizeVariantSelection(selection);
  const entries = Object.entries(normalized);
  return entries.length > 0 ? entries.map(([label, value]) => `${label}: ${value}`).join(" · ") : undefined;
}

export function buildCartItemKey(slug: string, selection?: VariantSelection) {
  const normalized = normalizeVariantSelection(selection);
  const serialized = Object.entries(normalized)
    .map(([label, value]) => `${encodeURIComponent(label)}=${encodeURIComponent(value)}`)
    .join("&");

  return serialized.length > 0 ? `${slug}::${serialized}` : slug;
}

function parseLotCbmVolume(lotCbm: string, moq: number) {
  const normalized = lotCbm.replace(",", ".");
  const volumeMatch = normalized.match(/([0-9]+(?:\.[0-9]+)?)\s*m3/i);
  const lotQtyMatch = normalized.match(/lot de\s*([0-9]+)/i);
  const totalLotCbm = volumeMatch ? Number(volumeMatch[1]) : 0;
  const lotQuantity = lotQtyMatch ? Number(lotQtyMatch[1]) : moq;

  if (!Number.isFinite(totalLotCbm) || totalLotCbm <= 0) {
    return 0;
  }

  const divisor = Number.isFinite(lotQuantity) && lotQuantity > 0 ? lotQuantity : Math.max(moq, 1);
  return totalLotCbm / divisor;
}

export function formatFcfa(amount: number) {
  return new Intl.NumberFormat(FCFA_LOCALE, {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function convertUsdToFcfa(amountUsd: number) {
  return Math.round(amountUsd * USD_TO_FCFA);
}

export function convertFcfaToUsd(amountFcfa: number) {
  return Number((amountFcfa / USD_TO_FCFA).toFixed(2));
}

export function formatSourcingAmount(amountFcfa: number, input?: { currencyCode?: string; locale?: string }) {
  const currency = getKnownCurrency(input?.currencyCode);
  const locale = input?.locale?.trim() || FCFA_LOCALE;
  const localizedAmount = convertFcfaToUsd(amountFcfa) * currency.rateFromUsd;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.code,
    minimumFractionDigits: localizedAmount >= 100 ? 0 : 2,
    maximumFractionDigits: localizedAmount >= 100 ? 0 : 2,
  }).format(localizedAmount);
}

export function formatShippingTradeLabel(
  option: Pick<ShippingMethodQuote, "tradeLabel" | "tradeDescriptor" | "tradeRateFcfa" | "tradeRateUnit">,
  input?: { currencyCode?: string; locale?: string },
) {
  if (typeof option.tradeRateFcfa !== "number" || !option.tradeRateUnit) {
    return option.tradeLabel;
  }

  const rateLabel = `${formatSourcingAmount(option.tradeRateFcfa, input)}/${option.tradeRateUnit}`;
  return option.tradeDescriptor ? `${option.tradeDescriptor} · ${rateLabel}` : rateLabel;
}

export function getSourcingOrderMeta(order: Pick<SourcingOrder, "supplierOrderPayload">): SourcingOrderMeta {
  if (!isObjectRecord(order.supplierOrderPayload)) {
    return {};
  }

  const meta = order.supplierOrderPayload[SOURCING_META_KEY];
  if (!isObjectRecord(meta)) {
    return {};
  }

  return {
    deliveryProfile: normalizeDeliveryProfile(meta.deliveryProfile),
    workflow: normalizeOrderWorkflow(meta.workflow),
    parcel: normalizeParcelMeta(meta.parcel),
    manualFulfillment: normalizeManualFulfillmentMeta(meta.manualFulfillment),
    deliveryNoteExports: normalizeDeliveryNoteExportHistory(meta.deliveryNoteExports),
    promo: normalizePromoAdjustment(meta.promo),
    sharedCart: normalizeSharedCartContext(meta.sharedCart),
    paymentContext: normalizePaymentContext(meta.paymentContext),
    manychat: normalizeManyChatContext(meta.manychat),
    freeDeal: normalizeFreeDealMeta(meta.freeDeal),
  };
}

export function getSourcingAlibabaPostPaymentAutomationState(order: Pick<SourcingOrder, "supplierOrderPayload">): SourcingAlibabaPostPaymentAutomationState | null {
  if (!isObjectRecord(order.supplierOrderPayload)) {
    return null;
  }

  const automation = order.supplierOrderPayload.automation;
  if (!isObjectRecord(automation)) {
    return null;
  }

  const postPayment = automation.alibabaPostPayment;
  if (!isObjectRecord(postPayment) || !Array.isArray(postPayment.trades)) {
    return null;
  }

  return {
    lastProcessedAt: typeof postPayment.lastProcessedAt === "string" ? postPayment.lastProcessedAt : "",
    lastTrigger: typeof postPayment.lastTrigger === "string" ? postPayment.lastTrigger : "",
    trades: postPayment.trades.map(normalizeAlibabaTradeAutomationState).filter((entry): entry is SourcingAlibabaTradeAutomationState => Boolean(entry)),
  };
}

export function getSourcingOrderBatchMode(order: Pick<SourcingOrder, "shippingMethod" | "supplierOrderPayload">): SourcingBatchMode | null {
  const meta = getSourcingOrderMeta(order);
  if (meta.freeDeal) {
    return "sea";
  }

  if (!meta.deliveryProfile?.usesInternalReceptionAddress) {
    return null;
  }

  if (order.shippingMethod === "air") {
    return "air";
  }

  if (order.shippingMethod === "sea") {
    return "sea";
  }

  return null;
}

export function getSourcingAlibabaPayUrls(order: Pick<SourcingOrder, "supplierOrderPayload">): string[] {
  const automation = getSourcingAlibabaPostPaymentAutomationState(order);
  if (!automation) {
    return [];
  }

  return Array.from(new Set(automation.trades.map((trade) => trade.payUrl).filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)));
}

export function getSourcingAlibabaPaymentRollup(order: Pick<SourcingOrder, "supplierOrderPayload">): SourcingAlibabaPaymentRollup {
  const automation = getSourcingAlibabaPostPaymentAutomationState(order);
  if (!automation || automation.trades.length === 0) {
    return "not_started";
  }

  const paidCount = automation.trades.filter((trade) => trade.paymentResultStatus === "paid").length;
  const hasPayUrl = automation.trades.some((trade) => Boolean(trade.payUrl));
  const hasFailed = automation.trades.some((trade) => trade.paymentRequestStatus === "failed" || trade.paymentResultStatus === "failed");
  const hasPending = automation.trades.some((trade) => trade.paymentRequestStatus === "requested" || (typeof trade.paymentResultStatus === "string" && trade.paymentResultStatus !== "paid" && trade.paymentResultStatus !== "failed"));

  if (paidCount === automation.trades.length) {
    return "paid";
  }

  if (paidCount > 0) {
    return "partial";
  }

  if (hasPayUrl) {
    return "pay_url_available";
  }

  if (hasFailed) {
    return "failed";
  }

  if (hasPending) {
    return "pending";
  }

  return "not_started";
}

export function isSourcingOrderClientPaid(order: Pick<SourcingOrder, "paymentStatus" | "monerooPaymentStatus" | "monerooPaymentPayload" | "paidAt">) {
  if (order.paymentStatus === "paid") {
    return true;
  }

  const monerooStatus = (order.monerooPaymentStatus || "").trim().toLowerCase();
  if (["success", "successful", "succeeded", "completed", "complete", "paid", "processed"].includes(monerooStatus)) {
    return true;
  }

  if (typeof order.paidAt === "string" && order.paidAt.trim().length > 0) {
    return true;
  }

  if (isObjectRecord(order.monerooPaymentPayload)) {
    if (order.monerooPaymentPayload.is_processed === true) {
      return true;
    }

    const payloadStatus = typeof order.monerooPaymentPayload.status === "string"
      ? order.monerooPaymentPayload.status.trim().toLowerCase()
      : "";

    if (["success", "successful", "succeeded", "completed", "complete", "paid", "processed"].includes(payloadStatus)) {
      return true;
    }
  }

  return false;
}

export function isSourcingOrderEligibleForSupplierPayment(order: Pick<SourcingOrder, "paymentStatus" | "monerooPaymentStatus" | "monerooPaymentPayload" | "paidAt" | "supplierOrderStatus" | "alibabaTradeIds" | "supplierOrderPayload">) {
  if (!isSourcingOrderClientPaid(order)) {
    return false;
  }

  if (order.supplierOrderStatus !== "created" || order.alibabaTradeIds.length === 0) {
    return false;
  }

  return getSourcingAlibabaPaymentRollup(order) !== "paid";
}

export function withSourcingOrderMeta(order: SourcingOrder, metaUpdate: SourcingOrderMeta) {
  const currentPayload = isObjectRecord(order.supplierOrderPayload)
    ? order.supplierOrderPayload
    : order.supplierOrderPayload === undefined
      ? {}
      : { rawPayload: order.supplierOrderPayload };
  const currentMeta = getSourcingOrderMeta(order);
  const nextMeta: SourcingOrderMeta = {
    deliveryProfile: metaUpdate.deliveryProfile ?? currentMeta.deliveryProfile,
    workflow: metaUpdate.workflow ?? currentMeta.workflow,
    parcel: metaUpdate.parcel ?? currentMeta.parcel,
    manualFulfillment: metaUpdate.manualFulfillment ?? currentMeta.manualFulfillment,
    deliveryNoteExports: metaUpdate.deliveryNoteExports ?? currentMeta.deliveryNoteExports,
    promo: metaUpdate.promo ?? currentMeta.promo,
    sharedCart: metaUpdate.sharedCart ?? currentMeta.sharedCart,
    paymentContext: metaUpdate.paymentContext ?? currentMeta.paymentContext,
    manychat: metaUpdate.manychat ?? currentMeta.manychat,
    freeDeal: metaUpdate.freeDeal ?? currentMeta.freeDeal,
  };

  return {
    ...order,
    supplierOrderPayload: {
      ...currentPayload,
      [SOURCING_META_KEY]: nextMeta,
    },
  } satisfies SourcingOrder;
}

export function resolveSourcingDeliveryPlan(input: {
  countryCode?: string;
  city?: string;
  deliveryProfile?: SourcingDeliveryProfile;
}): {
  supported: boolean;
  unsupportedMessage?: string;
  deliveryProfile: SourcingDeliveryProfile;
  workflow: SourcingOrderWorkflow;
} {
  const countryCode = canonicalizeCountryCode(input.countryCode, "TG");
  const requestedProfile = input.deliveryProfile;
  const requestedMode = requestedProfile?.mode === "forwarder" ? "forwarder" : "direct";
  const isChinaAddress = countryCode === "CN";
  const forcedForwarder = requestedMode === "forwarder" || isChinaAddress;
  const internalReceptionCountry = isInternalReceptionCountry(countryCode);
  const knownSupportedCountry = countryCode in COUNTRY_CONFIG;

  if (!forcedForwarder && !knownSupportedCountry) {
    return {
      supported: true,
      unsupportedMessage: "Ce pays passe en livraison manuelle AfriPay avec réception sur hub puis remise finale hors réseau direct AliExpress.",
      deliveryProfile: {
        mode: "direct",
        ...requestedProfile,
        usesInternalReceptionAddress: true,
        unsupportedCountry: true,
        unsupportedMessage: "Ce pays passe en livraison manuelle AfriPay avec réception sur hub puis remise finale hors réseau direct AliExpress.",
      },
      workflow: {
        routeType: "afripay-final-mile",
        freeDeliveryEligible: false,
        supplierDeliveryAddressRole: "afripay-agent",
        proofs: [],
      },
    };
  }

  const forwarderHub = requestedProfile?.forwarder?.hub
    ? normalizeHub(requestedProfile.forwarder.hub)
    : isChinaAddress
      ? "china"
      : "china";

  if (forcedForwarder) {
    return {
      supported: true,
      deliveryProfile: {
        mode: "forwarder",
        ...requestedProfile,
        usesInternalReceptionAddress: false,
        unsupportedCountry: false,
        unsupportedMessage: undefined,
        forwarder: requestedProfile?.forwarder
          ? {
              ...requestedProfile.forwarder,
              hub: forwarderHub,
            }
          : undefined,
      },
      workflow: {
        routeType: "customer-forwarder",
        freeDeliveryEligible: false,
        supplierDeliveryAddressRole: "forwarder",
        proofs: [],
      },
    };
  }

  if (internalReceptionCountry) {
    return {
      supported: true,
      deliveryProfile: {
        mode: "direct",
        ...requestedProfile,
        usesInternalReceptionAddress: true,
        unsupportedCountry: false,
        unsupportedMessage: undefined,
        forwarder: undefined,
      },
      workflow: {
        routeType: "afripay-final-mile",
        freeDeliveryEligible: false,
        supplierDeliveryAddressRole: "afripay-agent",
        proofs: [],
      },
    };
  }

  return {
    supported: true,
    deliveryProfile: {
      mode: "direct",
      ...requestedProfile,
      usesInternalReceptionAddress: false,
      unsupportedCountry: false,
      unsupportedMessage: undefined,
      forwarder: undefined,
    },
    workflow: {
      routeType: "afripay-final-mile",
      freeDeliveryEligible: true,
      supplierDeliveryAddressRole: "afripay-agent",
      proofs: [],
    },
  };
}

export function getProductSourcingMetrics(product: ProductCatalogItem, input?: { quantity?: number; selectedVariants?: VariantSelection }) {
  const actualWeightGrams = typeof product.itemWeightGrams === "number" && product.itemWeightGrams > 0
    ? product.itemWeightGrams
    : 0;
  const parsedVolumeCbm = parseLotCbmVolume(product.lotCbm, product.moq);
  const packageVolumeCbm = product.packageDimensionsCm
    && product.packageDimensionsCm.lengthCm > 0
    && product.packageDimensionsCm.widthCm > 0
    && product.packageDimensionsCm.heightCm > 0
    ? (product.packageDimensionsCm.lengthCm * product.packageDimensionsCm.widthCm * product.packageDimensionsCm.heightCm) / 1_000_000
    : 0;
  const weightKg = Number((actualWeightGrams / 1000).toFixed(3));
  const volumeCbm = Number((parsedVolumeCbm > 0 ? parsedVolumeCbm : packageVolumeCbm).toFixed(4));
  const supplierPriceFcfa = convertUsdToFcfa(resolveProductUnitPriceUsd(product, {
    quantity: input?.quantity,
    selection: input?.selectedVariants,
  }));

  return {
    weightKg,
    volumeCbm,
    supplierPriceFcfa,
    chinaLocalFreightFcfa: product.chinaLocalFreightFcfa,
    chinaLocalFreightLabel: product.chinaLocalFreightLabel,
  };
}
export function createEmptyQuote(settings?: Pick<SourcingSettings, "freeAirThresholdFcfa" | "containerTargetCbm">): AlibabaSourcingQuote {
  const threshold = settings?.freeAirThresholdFcfa ?? 20000;

  const containerTarget = settings?.containerTargetCbm ?? 1;

  return {
    items: [],
    cartProductsTotalFcfa: 0,
    totalWeightKg: 0,
    totalCbm: 0,
    shippingOptions: [],
    recommendedMethod: "air",
    freeAirRemainingFcfa: threshold,
    freeShippingMessage: "Ajoutez des produits au devis pour activer le calcul de la livraison gratuite.",
    containerProjection: {
      targetCbm: containerTarget,
      projectedCbm: 0,
      projectedFillPercent: 0,
    },
  };
}

export function getShippingPreferenceContext(input: { countryCode?: string | null; deliveryMode?: SourcingDeliveryMode }): string {
  if (input.deliveryMode === "forwarder") {
    return "forwarder";
  }

  return isEuropeanUnionCountry(input.countryCode ?? undefined) ? "direct-eu" : "direct-standard";
}

export function readStoredShippingPreference(storage: Storage, context: string): ShippingMethodKey | null {
  const stored = storage.getItem("afripay_sourcing_shipping_preference");
  if (!stored) {
    return null;
  }

  if (stored === "air" || stored === "sea" || stored === "freight") {
    return context === "direct-eu" ? null : stored;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<StoredShippingPreference>;
    if (
      parsed.context === context
      && (parsed.key === "air" || parsed.key === "sea" || parsed.key === "freight")
    ) {
      return parsed.key;
    }
  } catch {
    return null;
  }

  return null;
}

export function writeStoredShippingPreference(storage: Storage, context: string, key: ShippingMethodKey): void {
  const payload: StoredShippingPreference = { key, context };
  storage.setItem("afripay_sourcing_shipping_preference", JSON.stringify(payload));
}
