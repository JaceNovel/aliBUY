import { cache } from "react";

import { getAlibabaImportedProducts } from "@/lib/alibaba-operations-store";
import { type ProductCatalogItem } from "@/lib/products-data";

export const getCatalogProducts = cache(async function getCatalogProducts(): Promise<ProductCatalogItem[]> {
  const importedProducts = await getAlibabaImportedProducts();

  return importedProducts
    .filter((product) => product.publishedToSite && product.status !== "archived")
    .sort((left, right) => (right.publishedAt ?? right.updatedAt).localeCompare(left.publishedAt ?? left.updatedAt))
    .map((product) => ({
      slug: product.slug,
      title: product.title,
      shortTitle: product.shortTitle,
      keywords: product.keywords,
      image: product.image,
      gallery: product.gallery,
      videoUrl: product.videoUrl,
      videoPoster: product.videoPoster,
      packaging: product.packaging,
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
      variantGroups: product.variantGroups,
      variantPricing: product.variantPricing,
      variantSkus: product.variantSkus,
      tiers: product.tiers,
      specs: product.specs,
    }));
});

export const getCatalogProductBySlug = cache(async function getCatalogProductBySlug(slug: string) {
  const products = await getCatalogProducts();
  return products.find((product) => product.slug === slug) ?? null;
});

export async function getCatalogProductsBySlugs(slugs: string[]) {
  const products = await getCatalogProducts();
  const map = new Map(products.map((product) => [product.slug, product]));
  return slugs.flatMap((slug) => {
    const product = map.get(slug);
    return product ? [product] : [];
  });
}

export const getCatalogRelatedProducts = cache(async function getCatalogRelatedProducts(currentSlug: string, limit = 4) {
  const products = await getCatalogProducts();
  return products.filter((product) => product.slug !== currentSlug).slice(0, limit);
});

export async function searchCatalogProducts(query: string, limit?: number) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const visible = (await getCatalogProducts()).filter((product) => {
    const haystack = [product.title, product.shortTitle, ...(product.keywords ?? [])]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });
  return typeof limit === "number" ? visible.slice(0, limit) : visible;
}
