import { cache } from "react";

import { type ProductCatalogItem } from "@/lib/products-data";
import { getAlibabaImportedProducts } from "@/lib/alibaba-operations-store";
import { toCatalogProduct } from "@/lib/alibaba-operations";

export const getCatalogProducts = cache(async function getCatalogProducts() {
  const imported = (await getAlibabaImportedProducts())
    .filter((item) => item.publishedToSite && item.status === "published")
    .map(toCatalogProduct);

  return imported;
});

export const getCatalogProductBySlug = cache(async function getCatalogProductBySlug(slug: string) {
  const products = await getCatalogProducts();
  return products.find((product) => product.slug === slug) ?? null;
});

export async function getCatalogProductsBySlugs(slugs: string[]) {
  const products = await getCatalogProducts();
  const map = new Map(products.map((product) => [product.slug, product]));
  return slugs
    .map((slug) => map.get(slug) ?? null)
    .filter((product): product is ProductCatalogItem => product !== null);
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

  const products = await getCatalogProducts();
  const rankedResults = products
    .map((product) => {
      const haystack = [
        product.title,
        product.shortTitle,
        ...(product.keywords ?? []),
        product.supplierName,
        product.customizationLabel,
        product.shippingLabel,
        product.packaging,
        ...product.overview,
        ...product.specs.map((spec) => `${spec.label} ${spec.value}`),
        ...product.variantGroups.flatMap((group) => [group.label, ...group.values]),
      ]
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(normalizedQuery)) {
        return null;
      }

      let score = 0;
      if (product.shortTitle.toLowerCase().includes(normalizedQuery)) score += 8;
      if (product.title.toLowerCase().includes(normalizedQuery)) score += 6;
      if (product.slug.toLowerCase().includes(normalizedQuery)) score += 4;
      if (product.overview.some((entry) => entry.toLowerCase().includes(normalizedQuery))) score += 3;
      if (product.specs.some((spec) => `${spec.label} ${spec.value}`.toLowerCase().includes(normalizedQuery))) score += 2;
      if ((product.keywords ?? []).some((keyword) => keyword.toLowerCase().includes(normalizedQuery))) score += 4;

      return { product, score };
    })
    .filter((entry): entry is { product: ProductCatalogItem; score: number } => entry !== null)
    .sort((left, right) => right.score - left.score);

  const visible = rankedResults.map((entry) => entry.product);
  return typeof limit === "number" ? visible.slice(0, limit) : visible;
}
