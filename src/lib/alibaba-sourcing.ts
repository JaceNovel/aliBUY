import { type ProductCatalogItem } from "@/lib/products-data";
import { resolveProductUnitPriceUsd } from "@/lib/product-variant-pricing";
import { CURRENCY_CONFIG, type CurrencyCode } from "@/lib/pricing-options";

export type MarginMode = "percent" | "fixed";
export type ShippingMethodKey = "air" | "sea" | "freight";
export type SourcingOrderStatus = "checkout_created" | "grouped_sea" | "ready_to_ship" | "submitted_to_supplier" | "shipment_triggered" | "in_transit_to_agent" | "delivered_to_agent" | "relay_ready" | "completed";
export type FreightStatus = "not_requested" | "skipped" | "verified" | "failed";
export type SupplierOrderStatus = "not_created" | "skipped" | "created" | "failed";
export type PaymentStatus = "unpaid" | "initialized" | "pending" | "paid" | "failed" | "cancelled";
export type SeaContainerStatus = "pending" | "ready_to_ship" | "shipped";
export type VariantSelection = Record<string, string>;
export type SourcingDeliveryMode = "direct" | "forwarder";
export type SourcingForwarderHub = "china" | "lome";
export type SourcingDeliveryProofRole = "supplier_to_agent" | "agent_to_forwarder" | "arrival_scan" | "relay_release";

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
  createdFromSharedCart: boolean;
  thirdPartyCreatorName?: string;
  thirdPartyCreatorEmail?: string;
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
  promo?: SourcingPromoAdjustment;
  sharedCart?: SourcingSharedCartContext;
  paymentContext?: SourcingPaymentContext;
  freeDeal?: SourcingFreeDealMeta;
};

export type SourcingCheckoutInput = SourcingCheckoutAddress & {
  userId?: string;
  items: CartInputItem[];
  shippingMethod: ShippingMethodKey;
  notes?: string;
  deliveryProfile?: SourcingDeliveryProfile;
  promoCode?: string;
  sharedCartToken?: string;
  payerDisplayName?: string;
  payerEmail?: string;
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
  paymentProvider?: "moneroo";
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
export const SUPPORTED_DIRECT_DELIVERY_COUNTRY_CODES = ["TG", "BJ", "GH", "CI", "BF"] as const;
export const SUPPORTED_FORWARDER_COUNTRY_CODES = ["CN"] as const;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeAlibabaTrackingSnapshot(value: unknown): SourcingAlibabaTrackingSnapshot | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  return {
    carrier: typeof value.carrier === "string" ? value.carrier : undefined,
    trackingNumber: typeof value.trackingNumber === "string" ? value.trackingNumber : undefined,
    trackingUrl: typeof value.trackingUrl === "string" ? value.trackingUrl : undefined,
    currentEventCode: typeof value.currentEventCode === "string" ? value.currentEventCode : undefined,
    eventCount: Array.isArray(value.eventList) ? value.eventList.length : 0,
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
    createdFromSharedCart: value.createdFromSharedCart === true,
    thirdPartyCreatorName: typeof value.thirdPartyCreatorName === "string" ? value.thirdPartyCreatorName : undefined,
    thirdPartyCreatorEmail: typeof value.thirdPartyCreatorEmail === "string" ? value.thirdPartyCreatorEmail : undefined,
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
    return 0.002;
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
    promo: normalizePromoAdjustment(meta.promo),
    sharedCart: normalizeSharedCartContext(meta.sharedCart),
    paymentContext: normalizePaymentContext(meta.paymentContext),
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
    promo: metaUpdate.promo ?? currentMeta.promo,
    sharedCart: metaUpdate.sharedCart ?? currentMeta.sharedCart,
    paymentContext: metaUpdate.paymentContext ?? currentMeta.paymentContext,
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
  const countryCode = input.countryCode?.trim().toUpperCase() || "TG";
  const requestedProfile = input.deliveryProfile;
  const requestedMode = requestedProfile?.mode === "forwarder" ? "forwarder" : "direct";
  const isChinaAddress = countryCode === "CN";
  const isSupportedDirectCountry = SUPPORTED_DIRECT_DELIVERY_COUNTRY_CODES.includes(countryCode as (typeof SUPPORTED_DIRECT_DELIVERY_COUNTRY_CODES)[number]);
  const forcedForwarder = requestedMode === "forwarder" || isChinaAddress;

  if (!forcedForwarder && !isSupportedDirectCountry) {
    return {
      supported: false,
      unsupportedMessage: "Ce pays n'est pas pris en charge par nos transporteurs. Utilisez un transitaire en Chine.",
      deliveryProfile: {
        mode: "direct",
        ...requestedProfile,
        unsupportedCountry: true,
        unsupportedMessage: "Ce pays n'est pas pris en charge par nos transporteurs. Utilisez un transitaire en Chine.",
      },
      workflow: {
        routeType: "afripay-final-mile",
        freeDeliveryEligible: true,
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

  return {
    supported: true,
    deliveryProfile: {
      mode: "direct",
      ...requestedProfile,
      unsupportedCountry: false,
      unsupportedMessage: undefined,
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
  const weightKg = Number((product.itemWeightGrams / 1000).toFixed(3));
  const volumeCbm = Number(parseLotCbmVolume(product.lotCbm, product.moq).toFixed(4));
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
  const threshold = settings?.freeAirThresholdFcfa ?? 15000;

  const containerTarget = settings?.containerTargetCbm ?? 1;

  return {
    items: [],
    cartProductsTotalFcfa: 0,
    totalWeightKg: 0,
    totalCbm: 0,
    shippingOptions: [],
    recommendedMethod: "air",
    freeAirRemainingFcfa: threshold,
    freeShippingMessage: `Ajoutez ${formatFcfa(threshold)} de plus pour obtenir la livraison avion offerte`,
    containerProjection: {
      targetCbm: containerTarget,
      projectedCbm: 0,
      projectedFillPercent: 0,
    },
  };
}
