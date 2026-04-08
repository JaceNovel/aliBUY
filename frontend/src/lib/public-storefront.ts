import type { ProductCatalogItem } from "@/lib/products-data";

export function normalizeStorefrontText(value?: string | null): string {
  if (!value) {
    return "";
  }

  return value
    .trim()
    .replace(/Fiche minimale importee depuis la recherche DS/gi, "Fiche verifiee AfriPay+")
    .replace(/Recherche\s*DS/gi, "Selection AfriPay+")
    .replace(/AliExpress\s*DS/gi, "AfriPay+")
    .replace(/AliExpress/gi, "AfriPay+")
    .replace(/search fallback/gi, "catalogue AfriPay+");
}

export function normalizeStorefrontBadge(value?: string | null): string | undefined {
  const normalized = normalizeStorefrontText(value);
  return normalized || undefined;
}

type StorefrontCampaignMode = "standard" | "trends-promo" | "trends-hot" | "mode-fashion" | "free-deal";
type StorefrontPlacement = "catalog" | "trends" | "mode" | "free-deal";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getCampaignPayload(rawPayload: unknown) {
  if (!isRecord(rawPayload) || !isRecord(rawPayload.afripayCampaign)) {
    return null;
  }

  const mode = rawPayload.afripayCampaign.mode;
  const storefront = rawPayload.afripayCampaign.storefront;

  return {
    mode: typeof mode === "string" ? mode as StorefrontCampaignMode : "standard",
    storefront: typeof storefront === "string" ? storefront as StorefrontPlacement : "catalog",
  };
}

function buildStorefrontHaystack(product: Pick<ProductCatalogItem, "title" | "shortTitle" | "keywords" | "specs">) {
  return normalizeStorefrontText([
    product.title,
    product.shortTitle,
    ...(product.keywords ?? []),
    ...product.specs.map((spec) => `${spec.label} ${spec.value}`),
  ].join(" ")).toLowerCase();
}

export function getStorefrontCampaign(product: Pick<ProductCatalogItem, "rawPayload" | "title" | "shortTitle" | "keywords" | "specs">) {
  const stored = getCampaignPayload(product.rawPayload);
  const haystack = buildStorefrontHaystack(product);
  const isFashion = /(mode|fashion|shirt|robe|dress|sac|bag|chaussure|shoe|jewelry|bijou|watch|vetement|apparel|hoodie|sneaker)/.test(haystack);
  const storefront = stored?.storefront ?? (isFashion ? "mode" : "catalog");

  return {
    mode: stored?.mode ?? "standard",
    storefront,
    isTrend: storefront === "trends",
    isMode: storefront === "mode" || isFashion,
    isFreeDeal: storefront === "free-deal",
  };
}

export function isTrendStorefrontProduct(product: Pick<ProductCatalogItem, "rawPayload" | "title" | "shortTitle" | "keywords" | "specs">) {
  return getStorefrontCampaign(product).isTrend;
}

export function isModeStorefrontProduct(product: Pick<ProductCatalogItem, "rawPayload" | "title" | "shortTitle" | "keywords" | "specs">) {
  return getStorefrontCampaign(product).isMode;
}

export function isFreeDealStorefrontProduct(product: Pick<ProductCatalogItem, "rawPayload" | "title" | "shortTitle" | "keywords" | "specs">) {
  return getStorefrontCampaign(product).isFreeDeal;
}

export function shuffleStorefrontItems<T>(items: readonly T[]): T[] {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = next[index];
    next[index] = next[swapIndex];
    next[swapIndex] = current;
  }

  return next;
}