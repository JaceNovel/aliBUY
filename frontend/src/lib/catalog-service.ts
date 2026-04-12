import { API_URL, buildApiUrl } from "@/lib/api";
import { getAlibabaImportedProducts } from "@/lib/alibaba-operations-store";
import { deriveVariantGroupsFromPricing, deriveVariantGroupsFromSkus } from "@/lib/product-variant-pricing";
import { type ProductCatalogItem } from "@/lib/products-data";

async function fetchRemoteCatalogProducts() {
  if (!API_URL) {
    return null;
  }

  try {
    const response = await fetch(buildApiUrl("/api/catalog/products"), {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null) as { items?: unknown[] } | null;
    if (!Array.isArray(payload?.items)) {
      return null;
    }

    return payload.items.flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [] as ProductCatalogItem[];
      }

      const candidate = item as Record<string, unknown>;
      const slug = typeof candidate.slug === "string" && candidate.slug.trim() ? candidate.slug.trim() : "";
      const title = typeof candidate.title === "string" && candidate.title.trim() ? candidate.title.trim() : slug;
      const image = typeof candidate.image === "string" ? candidate.image.trim() : "";
      const minUsd = typeof candidate.minUsd === "number" && Number.isFinite(candidate.minUsd) ? candidate.minUsd : 0;

      if (!slug || !title || !image) {
        return [] as ProductCatalogItem[];
      }

      const maxUsd = typeof candidate.maxUsd === "number" && Number.isFinite(candidate.maxUsd) ? candidate.maxUsd : undefined;
      const moq = typeof candidate.moq === "number" && Number.isFinite(candidate.moq) && candidate.moq > 0 ? candidate.moq : 1;
      const unit = typeof candidate.unit === "string" && candidate.unit.trim() ? candidate.unit.trim() : "piece";

      return [{
        slug,
        title,
        shortTitle: typeof candidate.shortTitle === "string" && candidate.shortTitle.trim() ? candidate.shortTitle.trim() : title,
        keywords: Array.isArray(candidate.keywords)
          ? candidate.keywords.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
          : [],
        image,
        gallery: Array.isArray(candidate.gallery)
          ? candidate.gallery.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
          : [image],
        videoUrl: typeof candidate.videoUrl === "string" && candidate.videoUrl.trim() ? candidate.videoUrl.trim() : undefined,
        videoPoster: typeof candidate.videoPoster === "string" && candidate.videoPoster.trim() ? candidate.videoPoster.trim() : undefined,
        packaging: typeof candidate.packaging === "string" && candidate.packaging.trim() ? candidate.packaging.trim() : "Selon catalogue",
        packageDimensionsCm: undefined,
        itemWeightGrams: typeof candidate.itemWeightGrams === "number" && Number.isFinite(candidate.itemWeightGrams) ? candidate.itemWeightGrams : 0,
        lotCbm: typeof candidate.lotCbm === "string" && candidate.lotCbm.trim() ? candidate.lotCbm.trim() : "0.0000",
        minUsd,
        maxUsd,
        moq,
        moqVerified: typeof candidate.moqVerified === "boolean" ? candidate.moqVerified : true,
        weightVerified: typeof candidate.weightVerified === "boolean" ? candidate.weightVerified : false,
        priceVerified: typeof candidate.priceVerified === "boolean" ? candidate.priceVerified : true,
        unit,
        badge: typeof candidate.badge === "string" && candidate.badge.trim() ? candidate.badge.trim() : undefined,
        supplierName: typeof candidate.supplierName === "string" && candidate.supplierName.trim() ? candidate.supplierName.trim() : "Selection AfriPay+",
        supplierCompanyId: typeof candidate.supplierCompanyId === "string" && candidate.supplierCompanyId.trim() ? candidate.supplierCompanyId.trim() : undefined,
        supplierLocation: typeof candidate.supplierLocation === "string" && candidate.supplierLocation.trim() ? candidate.supplierLocation.trim() : "CN",
        responseTime: typeof candidate.responseTime === "string" && candidate.responseTime.trim() ? candidate.responseTime.trim() : "Sous 24 h",
        yearsInBusiness: typeof candidate.yearsInBusiness === "number" && Number.isFinite(candidate.yearsInBusiness) ? candidate.yearsInBusiness : 1,
        transactionsLabel: typeof candidate.transactionsLabel === "string" && candidate.transactionsLabel.trim() ? candidate.transactionsLabel.trim() : "Catalogue live",
        soldLabel: typeof candidate.soldLabel === "string" && candidate.soldLabel.trim() ? candidate.soldLabel.trim() : "0",
        customizationLabel: typeof candidate.customizationLabel === "string" && candidate.customizationLabel.trim() ? candidate.customizationLabel.trim() : "Selon catalogue",
        shippingLabel: typeof candidate.shippingLabel === "string" && candidate.shippingLabel.trim() ? candidate.shippingLabel.trim() : "Livraison internationale",
        chinaLocalFreightFcfa: typeof candidate.chinaLocalFreightFcfa === "number" && Number.isFinite(candidate.chinaLocalFreightFcfa) ? candidate.chinaLocalFreightFcfa : undefined,
        chinaLocalFreightLabel: typeof candidate.chinaLocalFreightLabel === "string" && candidate.chinaLocalFreightLabel.trim() ? candidate.chinaLocalFreightLabel.trim() : undefined,
        overview: Array.isArray(candidate.overview)
          ? candidate.overview.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
          : [title],
        variantGroups: Array.isArray(candidate.variantGroups) ? candidate.variantGroups as ProductCatalogItem["variantGroups"] : [],
        variantPricing: Array.isArray(candidate.variantPricing) ? candidate.variantPricing as ProductCatalogItem["variantPricing"] : [],
        variantSkus: Array.isArray(candidate.variantSkus) ? candidate.variantSkus as ProductCatalogItem["variantSkus"] : [],
        tiers: Array.isArray(candidate.tiers) ? candidate.tiers as ProductCatalogItem["tiers"] : [{ quantityLabel: `${moq}+`, priceUsd: minUsd }],
        specs: Array.isArray(candidate.specs) ? candidate.specs as ProductCatalogItem["specs"] : [],
        rawPayload: candidate.rawPayload ?? candidate,
      } satisfies ProductCatalogItem];
    });
  } catch {
    return null;
  }
}

async function readCatalogProductsSource(): Promise<ProductCatalogItem[]> {
  const remoteProducts = await fetchRemoteCatalogProducts();
  if (remoteProducts && remoteProducts.length > 0) {
    return remoteProducts;
  }

  const importedProducts = await getAlibabaImportedProducts();

  return importedProducts
    .filter((product) => product.publishedToSite && product.status !== "archived")
    .sort((left, right) => (right.publishedAt ?? right.updatedAt).localeCompare(left.publishedAt ?? left.updatedAt))
    .map((product) => {
      const fallbackVariantGroups = deriveVariantGroupsFromPricing(product.variantPricing ?? []);
      const fallbackVariantGroupsFromSkus = deriveVariantGroupsFromSkus(product.variantSkus ?? []);
      const variantGroups = product.variantGroups.length > 0
        ? product.variantGroups
        : fallbackVariantGroups.length > 0
          ? fallbackVariantGroups
          : fallbackVariantGroupsFromSkus;

      return {
        slug: product.slug,
        title: product.title,
        shortTitle: product.shortTitle,
        keywords: product.keywords,
        image: product.image,
        gallery: product.gallery,
        videoUrl: product.videoUrl,
        videoPoster: product.videoPoster,
        packaging: product.packaging,
        packageDimensionsCm: product.packageDimensionsCm,
        itemWeightGrams: product.itemWeightGrams,
        lotCbm: product.lotCbm,
        minUsd: product.minUsd,
        maxUsd: product.maxUsd,
        moq: product.moq,
        moqVerified: product.moqVerified,
        unit: product.unit,
        badge: product.badge,
        supplierName: product.supplierName,
        supplierLocation: product.supplierLocation,
        responseTime: product.responseTime,
        yearsInBusiness: product.yearsInBusiness,
        transactionsLabel: product.transactionsLabel,
        soldLabel: product.soldLabel,
        customizationLabel: product.customizationLabel,
        shippingLabel: product.shippingLabel,
        chinaLocalFreightFcfa: product.chinaLocalFreightFcfa,
        chinaLocalFreightLabel: product.chinaLocalFreightLabel,
        overview: product.overview,
        variantGroups,
        variantPricing: product.variantPricing,
        variantSkus: product.variantSkus,
        tiers: product.tiers,
        specs: product.specs,
        rawPayload: product.rawPayload,
      };
    });
}

export async function getCatalogProducts(options?: { fresh?: boolean }): Promise<ProductCatalogItem[]> {
  if (options?.fresh) {
    return readCatalogProductsSource();
  }

  return readCatalogProductsSource();
}

export async function getCatalogProductBySlug(slug: string) {
  const products = await getCatalogProducts();
  return products.find((product) => product.slug === slug) ?? null;
}

export async function getCatalogProductsBySlugs(slugs: string[], options?: { fresh?: boolean }) {
  const products = await getCatalogProducts(options);
  const map = new Map(products.map((product) => [product.slug, product]));
  return slugs.flatMap((slug) => {
    const product = map.get(slug);
    return product ? [product] : [];
  });
}

export async function getCatalogRelatedProducts(currentSlug: string, limit = 4) {
  const products = await getCatalogProducts();
  return products.filter((product) => product.slug !== currentSlug).slice(0, limit);
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenizeSearchText(value: string) {
  return normalizeSearchText(value).split(/\s+/).filter((token) => token.length >= 2);
}

function scoreCatalogProduct(
  product: ProductCatalogItem,
  normalizedQuery: string,
  queryTokens: string[],
  mode: "exact" | "similar",
) {
  const title = normalizeSearchText(product.title);
  const shortTitle = normalizeSearchText(product.shortTitle);
  const keywords = (product.keywords ?? []).map((keyword) => normalizeSearchText(keyword)).filter(Boolean);
  const category = normalizeSearchText(product.specs.map((spec) => `${spec.label} ${spec.value}`).join(" "));
  const haystacks = [title, shortTitle, ...keywords, category].filter(Boolean);

  let score = 0;
  let directMatch = false;
  let matchedTokens = 0;

  if (title === normalizedQuery) {
    score += 220;
    directMatch = true;
  }

  if (shortTitle === normalizedQuery) {
    score += 200;
    directMatch = true;
  }

  if (title.includes(normalizedQuery)) {
    score += 120;
    directMatch = true;
  }

  if (shortTitle.includes(normalizedQuery)) {
    score += 90;
    directMatch = true;
  }

  if (keywords.some((keyword) => keyword.includes(normalizedQuery))) {
    score += 70;
    directMatch = true;
  }

  for (const token of queryTokens) {
    let tokenScore = 0;

    if (title.includes(token)) {
      tokenScore = 24;
    } else if (shortTitle.includes(token)) {
      tokenScore = 18;
    } else if (keywords.some((keyword) => keyword.includes(token))) {
      tokenScore = 14;
    } else if (mode === "similar" && haystacks.some((entry) => entry.split(" ").some((word) => word.startsWith(token.slice(0, Math.min(token.length, 4)))))) {
      tokenScore = 8;
    }

    if (tokenScore > 0) {
      matchedTokens += 1;
      score += tokenScore;
    }
  }

  if (queryTokens.length > 0 && matchedTokens === queryTokens.length) {
    score += mode === "exact" ? 50 : 20;
    directMatch = true;
  }

  if (mode === "exact") {
    if (!directMatch && matchedTokens < Math.max(1, queryTokens.length)) {
      return 0;
    }
  } else if (matchedTokens === 0 && score < 40) {
    return 0;
  }

  return score;
}

async function findCatalogProductsByMode(query: string, mode: "exact" | "similar", limit?: number) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [];
  }

  const queryTokens = tokenizeSearchText(query);
  const ranked = (await getCatalogProducts())
    .map((product) => ({
      product,
      score: scoreCatalogProduct(product, normalizedQuery, queryTokens, mode),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.product.title.localeCompare(right.product.title));

  const products = ranked.map((entry) => entry.product);
  return typeof limit === "number" ? products.slice(0, limit) : products;
}

export async function searchCatalogProducts(query: string, limit?: number) {
  return findCatalogProductsByMode(query, "exact", limit);
}

export async function findSimilarCatalogProducts(query: string, limit?: number) {
  return findCatalogProductsByMode(query, "similar", limit);
}
