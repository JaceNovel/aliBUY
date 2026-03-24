import { type ProductCatalogItem } from "@/lib/products-data";

export type MarginMode = "percent" | "fixed";
export type ShippingMethodKey = "air" | "sea";
export type SourcingOrderStatus = "checkout_created" | "grouped_sea" | "ready_to_ship" | "submitted_to_supplier" | "shipment_triggered";
export type FreightStatus = "not_requested" | "skipped" | "verified" | "failed";
export type SupplierOrderStatus = "not_created" | "skipped" | "created" | "failed";
export type PaymentStatus = "unpaid" | "initialized" | "pending" | "paid" | "failed" | "cancelled";
export type SeaContainerStatus = "pending" | "ready_to_ship" | "shipped";

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
};

export type CartComputedItem = {
  slug: string;
  title: string;
  quantity: number;
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
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode?: string;
  countryCode: string;
};

export type SourcingCheckoutInput = SourcingCheckoutAddress & {
  userId?: string;
  items: CartInputItem[];
  shippingMethod: ShippingMethodKey;
  notes?: string;
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
const USD_TO_FCFA = 610;

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

function averageSupplierPriceUsd(product: ProductCatalogItem) {
  return typeof product.maxUsd === "number" ? (product.minUsd + product.maxUsd) / 2 : product.minUsd;
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

export function getProductSourcingMetrics(product: ProductCatalogItem) {
  const weightKg = Number((product.itemWeightGrams / 1000).toFixed(3));
  const volumeCbm = Number(parseLotCbmVolume(product.lotCbm, product.moq).toFixed(4));
  const supplierPriceFcfa = convertUsdToFcfa(averageSupplierPriceUsd(product));

  return {
    weightKg,
    volumeCbm,
    supplierPriceFcfa,
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
