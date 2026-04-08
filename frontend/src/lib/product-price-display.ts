import type { ProductTier } from "@/lib/products-data";

type TieredPriceLike = {
  minUsd: number;
  maxUsd?: number;
  tiers?: ProductTier[];
};

function getTierMinimum(label: string) {
  const rangeMatch = label.match(/\d+/);
  return rangeMatch ? Number(rangeMatch[0]) : 1;
}

function getSortedTiers(tiers?: ProductTier[]) {
  return [...(tiers ?? [])]
    .filter((tier) => Number.isFinite(tier.priceUsd) && tier.priceUsd > 0)
    .sort((left, right) => getTierMinimum(left.quantityLabel) - getTierMinimum(right.quantityLabel));
}

export function formatTierAwarePrice(
  formatPrice: (amountUsd: number) => string,
  product: TieredPriceLike,
) {
  const tiers = getSortedTiers(product.tiers);

  if (tiers.length > 0) {
    const firstTier = tiers[0];
    if (tiers.length === 1) {
      return formatPrice(firstTier.priceUsd);
    }

    return `${formatPrice(firstTier.priceUsd)} selon quantite`;
  }

  if (typeof product.maxUsd === "number") {
    return `${formatPrice(product.minUsd)} - ${formatPrice(product.maxUsd)}`;
  }

  return formatPrice(product.minUsd);
}

export function formatTierAwarePriceMeta(product: TieredPriceLike) {
  const tiers = getSortedTiers(product.tiers);
  if (tiers.length === 0) {
    return undefined;
  }

  if (tiers.length === 1) {
    return tiers[0].quantityLabel;
  }

  return `${tiers[0].quantityLabel} · ${tiers.length} paliers`;
}