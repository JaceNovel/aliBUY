import "server-only";

import { getCatalogProductBySlug, getCatalogProducts } from "@/lib/catalog-service";
import type { ProductCatalogItem } from "@/lib/products-data";
import {
  buildCartItemKey,
  createEmptyQuote,
  formatFcfa,
  formatVariantSelection,
  getProductSourcingMetrics,
  isEuropeanUnionCountry,
  normalizeVariantSelection,
  type CartComputedItem,
  type CartInputItem,
  type SourcingDeliveryMode,
  type SourcingSettings,
  type ShippingMethodQuote,
  type VariantSelection,
} from "@/lib/alibaba-sourcing";
import { resolveVariantSku } from "@/lib/product-variant-pricing";

function hasLogisticsMetrics(product: ProductCatalogItem) {
  const hasWeight = typeof product.itemWeightGrams === "number" && product.itemWeightGrams > 0;
  const hasDimensions = Boolean(
    product.packageDimensionsCm
    && product.packageDimensionsCm.lengthCm > 0
    && product.packageDimensionsCm.widthCm > 0
    && product.packageDimensionsCm.heightCm > 0,
  );
  const parsedLotCbm = typeof product.lotCbm === "string" ? Number(product.lotCbm.replace(",", ".")) : 0;
  const hasLotCbm = Number.isFinite(parsedLotCbm) && parsedLotCbm > 0;

  return hasWeight && (hasDimensions || hasLotCbm);
}

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

export async function getAlibabaSourcingCatalogPreview(settings: SourcingSettings, limit = 8) {
  const products = await getCatalogProducts();

  return products.slice(0, limit).map((product) => {
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
  options?: { disableFreeAir?: boolean; deliveryMode?: SourcingDeliveryMode; countryCode?: string },
) {
  const products = await getCatalogProducts();
  const productsBySlug = new Map(products.map((product) => [product.slug, product]));
  const productDetailCache = new Map<string, Promise<ProductCatalogItem | null>>();
  const totalQuantityBySlug = new Map<string, number>();
  inputItems.forEach((item) => {
    totalQuantityBySlug.set(item.slug, (totalQuantityBySlug.get(item.slug) ?? 0) + item.quantity);
  });
  const validItems = inputItems
    .map(async (item) => {
      const fallbackProduct = productsBySlug.get(item.slug);
      if (!fallbackProduct || item.quantity <= 0) {
        return null;
      }

      const product = hasLogisticsMetrics(fallbackProduct)
        ? fallbackProduct
        : await (() => {
            const cached = productDetailCache.get(item.slug);
            if (cached) {
              return cached;
            }

            const request = getCatalogProductBySlug(item.slug)
              .then((resolvedProduct) => resolvedProduct ?? fallbackProduct)
              .catch(() => fallbackProduct);
            productDetailCache.set(item.slug, request);
            return request;
          })();

      if (!product) {
        return null;
      }

      const selectedVariants = resolveProductVariantSelection(product, item.selectedVariants);
      const selectionLabel = formatVariantSelection(selectedVariants);
      const requiredVariantLabels = product.variantGroups.map((group) => group.label);
      const missingVariantLabels = requiredVariantLabels.filter((label) => !selectedVariants[label]);
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
        requiredVariantLabels,
        missingVariantLabels,
        matchedVariantSku,
        ...metrics,
        marginAmountFcfa,
        finalUnitPriceFcfa,
      };
    })
    ;

  const resolvedValidItems = (await Promise.all(validItems))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (resolvedValidItems.length === 0) {
    return createEmptyQuote(settings);
  }

  const items: CartComputedItem[] = resolvedValidItems.map((item) => ({
    cartKey: item.cartKey,
    slug: item.product.slug,
    title: item.selectionLabel ? `${item.product.shortTitle} · ${item.selectionLabel}` : item.product.shortTitle,
    quantity: item.quantity,
    selectedVariants: item.selectedVariants,
    selectionLabel: item.selectionLabel,
    requiredVariantLabels: item.requiredVariantLabels,
    missingVariantLabels: item.missingVariantLabels,
    variantSelectionComplete: item.missingVariantLabels.length === 0,
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
  const totalWeightKg = Number(resolvedValidItems.reduce((sum, item) => sum + item.weightKg * item.quantity, 0).toFixed(3));
  const totalCbm = Number(resolvedValidItems.reduce((sum, item) => sum + item.volumeCbm * item.quantity, 0).toFixed(4));
  const airCostFcfa = Math.ceil(totalWeightKg * settings.airRatePerKgFcfa);
  const seaCostFcfa = Math.ceil(totalCbm * settings.seaSellRatePerCbmFcfa);
  const isEuropeanUnionDestination = options?.deliveryMode !== "forwarder" && isEuropeanUnionCountry(options?.countryCode);
  const europeanExpressFeeFcfa = Math.round((2.99 / 0.92) * 602);
  const shouldPreferSea = totalWeightKg > settings.airWeightThresholdKg;
  const airIsFree = !isEuropeanUnionDestination && !options?.disableFreeAir && !shouldPreferSea && settings.freeAirEnabled && cartProductsTotalFcfa >= settings.freeAirThresholdFcfa;
  const showBothOptions = true;
  const freeAirRemainingFcfa = isEuropeanUnionDestination ? 0 : Math.max(settings.freeAirThresholdFcfa - cartProductsTotalFcfa, 0);

  if (options?.deliveryMode === "forwarder") {
    return {
      items,
      cartProductsTotalFcfa,
      totalWeightKg,
      totalCbm,
      shippingOptions: [
        {
          key: "freight",
          label: "Fret",
          priceFcfa: 0,
          deliveryWindow: "2-5 jours en Chine",
          isFree: true,
          tradeLabel: "Transport calcule au moment de la validation du panier",
          tradeDescriptor: "Transport differe",
        },
      ],
      recommendedMethod: "freight",
      freeAirRemainingFcfa: 0,
      freeShippingMessage: "Le transport est choisi et paye par le client au moment de la validation du panier.",
      containerProjection: {
        targetCbm: settings.containerTargetCbm,
        projectedCbm: totalCbm,
        projectedFillPercent: Math.min(100, Math.round((totalCbm / settings.containerTargetCbm) * 100)),
      },
    };
  }

  const shippingOptions: ShippingMethodQuote[] = showBothOptions
    ? [
        {
          key: "air",
          label: isEuropeanUnionDestination ? "Express" : "Avion",
          priceFcfa: isEuropeanUnionDestination ? europeanExpressFeeFcfa : airIsFree ? 0 : airCostFcfa,
          deliveryWindow: settings.airEstimatedDays,
          isFree: airIsFree,
          tradeLabel: isEuropeanUnionDestination ? "Livraison express domicile · 2,99 EUR" : `Express payant · ${formatFcfa(settings.airRatePerKgFcfa)}/kg`,
          tradeDescriptor: isEuropeanUnionDestination ? undefined : "Express payant",
          tradeRateFcfa: isEuropeanUnionDestination ? undefined : settings.airRatePerKgFcfa,
          tradeRateUnit: isEuropeanUnionDestination ? undefined : "kg",
        },
        {
          key: "sea",
          label: isEuropeanUnionDestination ? "Standard gratuit" : "Bateau",
          priceFcfa: isEuropeanUnionDestination ? 0 : seaCostFcfa,
          deliveryWindow: settings.seaEstimatedDays,
          isFree: isEuropeanUnionDestination,
          tradeLabel: isEuropeanUnionDestination ? "Livraison standard offerte dans l'Union europeenne" : `Groupage · ${formatFcfa(settings.seaSellRatePerCbmFcfa)}/m3`,
          tradeDescriptor: isEuropeanUnionDestination ? undefined : "Groupage",
          tradeRateFcfa: isEuropeanUnionDestination ? undefined : settings.seaSellRatePerCbmFcfa,
          tradeRateUnit: isEuropeanUnionDestination ? undefined : "m3",
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
          tradeDescriptor: "Express",
          tradeRateFcfa: settings.airRatePerKgFcfa,
          tradeRateUnit: "kg",
        },
      ];

  return {
    items,
    cartProductsTotalFcfa,
    totalWeightKg,
    totalCbm,
    shippingOptions,
    recommendedMethod: isEuropeanUnionDestination || shouldPreferSea ? "sea" : "air",
    freeAirRemainingFcfa,
    freeShippingMessage: isEuropeanUnionDestination
      ? "Livraison standard gratuite pour les destinations de l'Union europeenne. Passez en express pour 2,99 EUR."
      : shouldPreferSea
      ? `Le moyen de livraison peut etre change si le poids est trop consequent. Pour profiter de la livraison gratuite, les commandes ne doivent pas depasser ${settings.airWeightThresholdKg} kg.`
      : airIsFree
        ? `Livraison gratuite debloquee des ${formatFcfa(settings.freeAirThresholdFcfa)} pour une commande ne depassant pas ${settings.airWeightThresholdKg} kg.`
        : `Livraison gratuite disponible a partir de ${formatFcfa(settings.freeAirThresholdFcfa)} si la commande ne depasse pas ${settings.airWeightThresholdKg} kg.`,
    containerProjection: {
      targetCbm: settings.containerTargetCbm,
      projectedCbm: totalCbm,
      projectedFillPercent: Math.min(100, Math.round((totalCbm / settings.containerTargetCbm) * 100)),
    },
  };
}
