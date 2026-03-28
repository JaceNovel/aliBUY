import { cache } from "react";

import { type ProductCatalogItem } from "@/lib/products-data";

export const getCatalogProducts = cache(async function getCatalogProducts(): Promise<ProductCatalogItem[]> {
  return [];
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
