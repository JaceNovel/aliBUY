import "server-only";

import { getCatalogProducts } from "@/lib/catalog-service";
import type { ProductCatalogItem } from "@/lib/products-data";
import {
  buildCartItemKey,
  createEmptyQuote,
  formatFcfa,
  formatVariantSelection,
  getProductSourcingMetrics,
  normalizeVariantSelection,
  type CartComputedItem,
  type CartInputItem,
  type SourcingSettings,
  type ShippingMethodQuote,
  type VariantSelection,
} from "@/lib/alibaba-sourcing";
import { resolveVariantSku } from "@/lib/product-variant-pricing";

function resolveProductVariantSelection(product: ProductCatalogItem, selection?: VariantSelection) {
  const normalizedSelection = normalizeVariantSelection(selection);

  return Object.fromEntries(
    product.variantGroups.flatMap((group) => {
      const selectedValue = normalizedSelection[group.label];
      return selectedValue && group.values.includes(selectedValue) ? [[group.label, selectedValue] as const] : [];
    }),
  );
}

function computeMarginAmount(supplierPriceFcfa: number, settings: SourcingSettings) {
  if (settings.defaultMarginMode === "fixed") {
    return Math.round(settings.defaultMarginValue);
  }

  return Math.round((supplierPriceFcfa * settings.defaultMarginValue) / 100);
}

export async function getAlibabaSourcingCatalog(settings: SourcingSettings) {
  const products = await getCatalogProducts();

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

export async function createAlibabaSourcingQuote(
  inputItems: CartInputItem[],
  settings: SourcingSettings,
  options?: { disableFreeAir?: boolean },
) {
  const products = await getCatalogProducts();
  const totalQuantityBySlug = new Map<string, number>();
  inputItems.forEach((item) => {
    totalQuantityBySlug.set(item.slug, (totalQuantityBySlug.get(item.slug) ?? 0) + item.quantity);
  });
  const validItems = inputItems
    .map((item) => {
      const product = products.find((entry) => entry.slug === item.slug);
      if (!product || item.quantity <= 0) {
        return null;
      }

      const selectedVariants = resolveProductVariantSelection(product, item.selectedVariants);
      const selectionLabel = formatVariantSelection(selectedVariants);
      const metrics = getProductSourcingMetrics(product, {
        quantity: (product.variantPricing?.some((rule) => Object.entries(rule.selections).every(([label, value]) => selectedVariants[label] === value)) ?? false)
          ? item.quantity
          : totalQuantityBySlug.get(product.slug) ?? item.quantity,
        selectedVariants,
      });
      const matchedVariantSku = resolveVariantSku(product, selectedVariants);
      const marginAmountFcfa = computeMarginAmount(metrics.supplierPriceFcfa, settings);
      const finalUnitPriceFcfa = metrics.supplierPriceFcfa + marginAmountFcfa;

      return {
        product,
        cartKey: buildCartItemKey(product.slug, selectedVariants),
        quantity: item.quantity,
        selectedVariants,
        selectionLabel,
        matchedVariantSku,
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
    cartKey: item.cartKey,
    slug: item.product.slug,
    title: item.selectionLabel ? `${item.product.shortTitle} · ${item.selectionLabel}` : item.product.shortTitle,
    quantity: item.quantity,
    selectedVariants: item.selectedVariants,
    selectionLabel: item.selectionLabel,
    supplierSkuId: item.matchedVariantSku?.skuId,
    supplierSkuCode: item.matchedVariantSku?.skuCode,
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
  const shouldPreferSea = totalWeightKg > settings.airWeightThresholdKg;
  const airIsFree = !options?.disableFreeAir && !shouldPreferSea && settings.freeAirEnabled && cartProductsTotalFcfa >= settings.freeAirThresholdFcfa;
  const showBothOptions = shouldPreferSea;
  const freeAirRemainingFcfa = Math.max(settings.freeAirThresholdFcfa - cartProductsTotalFcfa, 0);

  const shippingOptions: ShippingMethodQuote[] = showBothOptions
    ? [
        {
          key: "air",
          label: "Avion",
          priceFcfa: airIsFree ? 0 : airCostFcfa,
          deliveryWindow: settings.airEstimatedDays,
          isFree: airIsFree,
          tradeLabel: `Express payant · ${formatFcfa(settings.airRatePerKgFcfa)}/kg`,
        },
        {
          key: "sea",
          label: "Bateau",
          priceFcfa: seaCostFcfa,
          deliveryWindow: settings.seaEstimatedDays,
          isFree: false,
          tradeLabel: `Groupage · ${formatFcfa(settings.seaSellRatePerCbmFcfa)}/m3`,
        },
      ]
    : [
        {
          key: "air",
          label: "Avion",
          priceFcfa: airIsFree ? 0 : airCostFcfa,
          deliveryWindow: settings.airEstimatedDays,
          isFree: airIsFree,
          tradeLabel: `Express · ${formatFcfa(settings.airRatePerKgFcfa)}/kg`,
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
    freeShippingMessage: shouldPreferSea
      ? `Au-dessus de ${settings.airWeightThresholdKg} kg, le bateau est recommande. L'avion reste disponible avec frais.`
      : airIsFree
        ? "Livraison avion offerte debloquee pour ce panier"
        : `Ajoutez ${formatFcfa(freeAirRemainingFcfa)} de plus pour obtenir la livraison avion offerte`,
    containerProjection: {
      targetCbm: settings.containerTargetCbm,
      projectedCbm: totalCbm,
      projectedFillPercent: Math.min(100, Math.round((totalCbm / settings.containerTargetCbm) * 100)),
    },
  };
}
