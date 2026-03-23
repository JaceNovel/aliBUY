import { products, type ProductCatalogItem } from "@/lib/products-data";

export type MarginMode = "percent" | "fixed";
export type ShippingMethodKey = "air" | "sea";
export type SourcingOrderStatus = "checkout_created" | "grouped_sea" | "ready_to_ship" | "submitted_to_supplier" | "shipment_triggered";
export type FreightStatus = "not_requested" | "skipped" | "verified" | "failed";
export type SupplierOrderStatus = "not_created" | "skipped" | "created" | "failed";
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
  items: CartInputItem[];
  shippingMethod: ShippingMethodKey;
  notes?: string;
};

export type SourcingOrderItem = CartComputedItem;

export type SourcingOrder = SourcingCheckoutAddress & {
  id: string;
  orderNumber: string;
  shippingMethod: ShippingMethodKey;
  shippingCostFcfa: number;
  cartProductsTotalFcfa: number;
  totalPriceFcfa: number;
  totalWeightKg: number;
  totalVolumeCbm: number;
  status: SourcingOrderStatus;
  freightStatus: FreightStatus;
  supplierOrderStatus: SupplierOrderStatus;
  alibabaTradeIds: string[];
  freightPayload?: unknown;
  supplierOrderPayload?: unknown;
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

function computeMarginAmount(supplierPriceFcfa: number, settings: SourcingSettings) {
  if (settings.defaultMarginMode === "fixed") {
    return Math.round(settings.defaultMarginValue);
  }

  return Math.round((supplierPriceFcfa * settings.defaultMarginValue) / 100);
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

export function getAlibabaSourcingCatalog(settings: SourcingSettings) {
  return products.map((product) => {
    const metrics = getProductSourcingMetrics(product);
    const marginAmountFcfa = computeMarginAmount(metrics.supplierPriceFcfa, settings);

    return {
      slug: product.slug,
      title: product.shortTitle,
      supplier: product.supplierName,
      image: product.image,
      ...metrics,
      marginMode: settings.defaultMarginMode,
      marginValue: settings.defaultMarginValue,
      marginAmountFcfa,
      suggestedFinalPriceFcfa: metrics.supplierPriceFcfa + marginAmountFcfa,
    };
  });
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

export function createAlibabaSourcingQuote(inputItems: CartInputItem[], settings: SourcingSettings) {
  const validItems = inputItems
    .map((item) => {
      const product = products.find((entry) => entry.slug === item.slug);
      if (!product || item.quantity <= 0) {
        return null;
      }

      const metrics = getProductSourcingMetrics(product);
      const marginAmountFcfa = computeMarginAmount(metrics.supplierPriceFcfa, settings);
      const finalUnitPriceFcfa = metrics.supplierPriceFcfa + marginAmountFcfa;

      return {
        product,
        quantity: item.quantity,
        ...metrics,
        marginAmountFcfa,
        finalUnitPriceFcfa,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (validItems.length === 0) {
    return createEmptyQuote(settings);
  }

  const items: CartComputedItem[] = validItems.map((item) => ({
    slug: item.product.slug,
    title: item.product.shortTitle,
    quantity: item.quantity,
    weightKg: item.weightKg,
    volumeCbm: item.volumeCbm,
    supplierPriceFcfa: item.supplierPriceFcfa,
    marginMode: settings.defaultMarginMode,
    marginValue: settings.defaultMarginValue,
    marginAmountFcfa: item.marginAmountFcfa,
    finalUnitPriceFcfa: item.finalUnitPriceFcfa,
    finalLinePriceFcfa: item.finalUnitPriceFcfa * item.quantity,
    image: item.product.image,
  }));

  const cartProductsTotalFcfa = items.reduce((sum, item) => sum + item.finalLinePriceFcfa, 0);
  const totalWeightKg = Number(validItems.reduce((sum, item) => sum + item.weightKg * item.quantity, 0).toFixed(3));
  const totalCbm = Number(validItems.reduce((sum, item) => sum + item.volumeCbm * item.quantity, 0).toFixed(4));
  const airCostFcfa = Math.ceil(totalWeightKg * settings.airRatePerKgFcfa);
  const seaCostFcfa = Math.ceil(totalCbm * settings.seaSellRatePerCbmFcfa);
  const airIsFree = settings.freeAirEnabled && cartProductsTotalFcfa >= settings.freeAirThresholdFcfa;
  const showBothOptions = totalWeightKg > settings.airWeightThresholdKg;
  const freeAirRemainingFcfa = Math.max(settings.freeAirThresholdFcfa - cartProductsTotalFcfa, 0);

  const shippingOptions: ShippingMethodQuote[] = showBothOptions
    ? [
        {
          key: "air",
          label: "Avion",
          priceFcfa: airIsFree ? 0 : airCostFcfa,
          deliveryWindow: settings.airEstimatedDays,
          isFree: airIsFree,
          tradeLabel: `Express · ${formatFcfa(settings.airRatePerKgFcfa)}/kg`,
        },
        {
          key: "sea",
          label: "Bateau",
          priceFcfa: seaCostFcfa,
          deliveryWindow: settings.seaEstimatedDays,
          isFree: false,
          tradeLabel: `Groupage · ${formatFcfa(settings.seaSellRatePerCbmFcfa)}/CBM`,
        },
      ]
    : [
        {
          key: "air",
          label: "Avion",
          priceFcfa: airIsFree ? 0 : airCostFcfa,
          deliveryWindow: settings.airEstimatedDays,
          isFree: airIsFree,
          tradeLabel: `Rapide · ${formatFcfa(settings.airRatePerKgFcfa)}/kg`,
        },
      ];

  return {
    items,
    cartProductsTotalFcfa,
    totalWeightKg,
    totalCbm,
    shippingOptions,
    recommendedMethod: showBothOptions ? "sea" : "air",
    freeAirRemainingFcfa,
    freeShippingMessage: freeAirRemainingFcfa > 0
      ? `Ajoutez ${formatFcfa(freeAirRemainingFcfa)} de plus pour obtenir la livraison avion offerte`
      : `Livraison avion offerte dès ${formatFcfa(settings.freeAirThresholdFcfa)}`,
    containerProjection: {
      targetCbm: settings.containerTargetCbm,
      projectedCbm: totalCbm,
      projectedFillPercent: Math.min(100, Math.round((totalCbm / settings.containerTargetCbm) * 100)),
    },
  } satisfies AlibabaSourcingQuote;
}import { products, type ProductCatalogItem } from "@/lib/products-data";

export type AlibabaSourcingConfig = {
  airRatePerKgFcfa: number;
  seaRatePerCbmFcfa: number;
  seaSellRatePerCbmFcfa: number;
  freeAirThresholdFcfa: number;
  freeAirEnabled: boolean;
  marginPercent: number;
  estimatedAirDays: string;
  estimatedSeaDays: string;
  containerTargetCbm: number;
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
  estimatedShippingPerUnitFcfa: number;
  finalUnitPriceFcfa: number;
  finalLinePriceFcfa: number;
  image: string;
};

export type ShippingMethodQuote = {
  key: "air" | "sea";
  label: string;
  priceFcfa: number;
  deliveryWindow: string;
  isFree: boolean;
  tradeLabel: string;
};

export type AlibabaSourcingQuote = {
  items: CartComputedItem[];
  subtotalFcfa: number;
  totalWeightKg: number;
  totalCbm: number;
  shippingOptions: ShippingMethodQuote[];
  recommendedMethod: "air" | "sea";
  container: {
    currentCbm: number;
    targetCbm: number;
    fillPercent: number;
    orderCount: number;
    remainingCbm: number;
  };
  freeShippingMessage: string;
};

export const alibabaSourcingConfig: AlibabaSourcingConfig = {
  airRatePerKgFcfa: 10000,
  seaRatePerCbmFcfa: 180000,
  seaSellRatePerCbmFcfa: 210000,
  freeAirThresholdFcfa: 15000,
  freeAirEnabled: true,
  marginPercent: 10,
  estimatedAirDays: "8-15 jours",
  estimatedSeaDays: "20-40 jours",
  containerTargetCbm: 1,
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

export function getAlibabaSourcingCatalog() {
  return products.map((product) => {
    const metrics = getProductSourcingMetrics(product);

    return {
      slug: product.slug,
      title: product.shortTitle,
      supplier: product.supplierName,
      image: product.image,
      ...metrics,
      marginPercent: alibabaSourcingConfig.marginPercent,
      suggestedFinalPriceFcfa: Math.round(metrics.supplierPriceFcfa * (1 + alibabaSourcingConfig.marginPercent / 100)),
    };
  });
}

export function createAlibabaSourcingQuote(inputItems: CartInputItem[]) {
  const validItems = inputItems
    .map((item) => {
      const product = products.find((entry) => entry.slug === item.slug);
      if (!product || item.quantity <= 0) {
        return null;
      }

      const metrics = getProductSourcingMetrics(product);

      return {
        product,
        quantity: item.quantity,
        ...metrics,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const totalWeightKg = Number(validItems.reduce((sum, item) => sum + item.weightKg * item.quantity, 0).toFixed(3));
  const totalCbm = Number(validItems.reduce((sum, item) => sum + item.volumeCbm * item.quantity, 0).toFixed(4));

  const airCostFcfa = Math.ceil(totalWeightKg * alibabaSourcingConfig.airRatePerKgFcfa);
  const seaCostFcfa = Math.ceil(totalCbm * alibabaSourcingConfig.seaSellRatePerCbmFcfa);
  const subtotalSupplierFcfa = validItems.reduce((sum, item) => sum + item.supplierPriceFcfa * item.quantity, 0);
  const airIsFree = alibabaSourcingConfig.freeAirEnabled && subtotalSupplierFcfa >= alibabaSourcingConfig.freeAirThresholdFcfa;

  const items: CartComputedItem[] = validItems.map((item) => {
    const estimatedShippingPerUnitFcfa = item.weightKg <= 1
      ? Math.ceil(item.weightKg * alibabaSourcingConfig.airRatePerKgFcfa)
      : Math.ceil(item.volumeCbm * alibabaSourcingConfig.seaSellRatePerCbmFcfa);
    const finalUnitPriceFcfa = Math.ceil((item.supplierPriceFcfa + estimatedShippingPerUnitFcfa) * (1 + alibabaSourcingConfig.marginPercent / 100));

    return {
      slug: item.product.slug,
      title: item.product.shortTitle,
      quantity: item.quantity,
      weightKg: item.weightKg,
      volumeCbm: item.volumeCbm,
      supplierPriceFcfa: item.supplierPriceFcfa,
      estimatedShippingPerUnitFcfa,
      finalUnitPriceFcfa,
      finalLinePriceFcfa: finalUnitPriceFcfa * item.quantity,
      image: item.product.image,
    };
  });

  const subtotalFcfa = items.reduce((sum, item) => sum + item.finalLinePriceFcfa, 0);
  const shippingOptions: ShippingMethodQuote[] = totalWeightKg <= 1
    ? [
        {
          key: "air",
          label: "Avion",
          priceFcfa: airIsFree ? 0 : airCostFcfa,
          deliveryWindow: alibabaSourcingConfig.estimatedAirDays,
          isFree: airIsFree,
          tradeLabel: "Rapide · 10 000 FCFA/kg",
        },
      ]
    : [
        {
          key: "air",
          label: "Avion",
          priceFcfa: airIsFree ? 0 : airCostFcfa,
          deliveryWindow: alibabaSourcingConfig.estimatedAirDays,
          isFree: airIsFree,
          tradeLabel: "Express · 10 000 FCFA/kg",
        },
        {
          key: "sea",
          label: "Bateau",
          priceFcfa: seaCostFcfa,
          deliveryWindow: alibabaSourcingConfig.estimatedSeaDays,
          isFree: false,
          tradeLabel: "Groupage container · 210 000 FCFA/CBM",
        },
      ];

  const recommendedMethod = totalWeightKg <= 1 ? "air" : seaCostFcfa < airCostFcfa ? "sea" : "air";
  const currentCbm = Number(Math.min(totalCbm, alibabaSourcingConfig.containerTargetCbm).toFixed(4));
  const fillPercent = Math.min(100, Math.round((currentCbm / alibabaSourcingConfig.containerTargetCbm) * 100));

  return {
    items,
    subtotalFcfa,
    totalWeightKg,
    totalCbm,
    shippingOptions,
    recommendedMethod,
    container: {
      currentCbm,
      targetCbm: alibabaSourcingConfig.containerTargetCbm,
      fillPercent,
      orderCount: validItems.length,
      remainingCbm: Number(Math.max(alibabaSourcingConfig.containerTargetCbm - currentCbm, 0).toFixed(4)),
    },
    freeShippingMessage: `Livraison avion offerte dès ${formatFcfa(alibabaSourcingConfig.freeAirThresholdFcfa)}`,
  } satisfies AlibabaSourcingQuote;
}

export function getMockSeaContainerState() {
  const pendingOrders = [
    createAlibabaSourcingQuote([{ slug: products[0]?.slug ?? "", quantity: 12 }, { slug: products[1]?.slug ?? "", quantity: 24 }]),
    createAlibabaSourcingQuote([{ slug: products[2]?.slug ?? "", quantity: 4 }]),
    createAlibabaSourcingQuote([{ slug: products[3]?.slug ?? "", quantity: 6 }]),
  ].filter((quote) => quote.items.length > 0);

  const currentCbm = Number(pendingOrders.reduce((sum, quote) => sum + quote.totalCbm, 0).toFixed(4));
  const targetCbm = alibabaSourcingConfig.containerTargetCbm;

  return {
    orders: pendingOrders,
    currentCbm,
    targetCbm,
    fillPercent: Math.min(100, Math.round((currentCbm / targetCbm) * 100)),
    remainingCbm: Number(Math.max(targetCbm - currentCbm, 0).toFixed(4)),
  };
}