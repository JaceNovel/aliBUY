import "server-only";

import { cache } from "react";

import type { ProductCatalogItem } from "@/lib/products-data";

export type CatalogCategoryRecord = {
  slug: string;
  title: string;
  description: string;
  href: string;
  image?: string;
  productCount: number;
  productSlugs: string[];
  sourcePath: string[];
  sourcePathLabel: string;
  queries: string[];
  products: ProductCatalogItem[];
};

type CategoryAccumulator = {
  slug: string;
  title: string;
  description: string;
  sourcePath: string[];
  queries: Set<string>;
  products: ProductCatalogItem[];
};

const CATEGORY_SORT_PRIORITY: Record<string, number> = {
  electronique: 1,
  "telephones-accessoires": 2,
  "keyboard-mouse": 3,
  "claviers-souris": 3,
  meubles: 4,
  "maison-jardin": 5,
  "fashion-accessories": 6,
  "bijoux-accessoires": 7,
  "jewelry-accessories": 7,
  "chaussures-sacs": 8,
  "vetements-chaussures": 8,
  "sports-leisure": 9,
  "vr-gaming": 10,
};

function dedupeProducts(products: ProductCatalogItem[]) {
  const map = new Map<string, ProductCatalogItem>();

  for (const product of products) {
    map.set(product.slug, product);
  }

  return [...map.values()];
}

function buildCategoryDescription(title: string, sourcePath: string[], count: number) {
  if (sourcePath.length > 1) {
    return `${count} article${count > 1 ? "s" : ""} publie${count > 1 ? "s" : ""} depuis Alibaba dans ${sourcePath.join(" / ")}.`;
  }

  return `${count} article${count > 1 ? "s" : ""} publie${count > 1 ? "s" : ""} dans la categorie ${title}.`;
}

function buildCategoryHref(slug: string) {
  return `/categories/${encodeURIComponent(slug)}`;
}

function getCategorySortRank(slug: string) {
  return CATEGORY_SORT_PRIORITY[slug] ?? 999;
}

export const getCatalogCategories = cache(async function getCatalogCategories() {
  return [];
});

export const getCatalogCategoryBySlug = cache(async function getCatalogCategoryBySlug(slug: string) {
  const categories = await getCatalogCategories();
  return categories.find((category) => category.slug === slug) ?? null;
});
