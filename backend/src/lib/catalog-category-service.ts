import "server-only";

import { cache } from "react";

import { slugifyCategoryLabel } from "@/lib/alibaba-operations";
import { getAlibabaImportedProducts } from "@/lib/alibaba-operations-store";
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
    return `${count} article${count > 1 ? "s" : ""} publie${count > 1 ? "s" : ""} dans ${sourcePath.join(" / ")}.`;
  }

  return `${count} article${count > 1 ? "s" : ""} publie${count > 1 ? "s" : ""} dans la categorie ${title}.`;
}

function buildCategoryHref(slug: string) {
  return `/categories/${encodeURIComponent(slug)}`;
}

function getCategorySortRank(slug: string) {
  return CATEGORY_SORT_PRIORITY[slug] ?? 999;
}

export const getCatalogCategories = cache(async function getCatalogCategories(): Promise<CatalogCategoryRecord[]> {
  const importedProducts = await getAlibabaImportedProducts();
  const publishedProducts = importedProducts.filter((product) => product.publishedToSite && product.status !== "archived");
  const categories = new Map<string, CategoryAccumulator>();

  for (const product of publishedProducts) {
    const title = product.categoryTitle?.trim()
      || product.categoryPath?.find((entry) => entry.trim().length > 0)?.trim()
      || "Catalogue importe";
    const sourcePath = Array.isArray(product.categoryPath) && product.categoryPath.length > 0
      ? product.categoryPath.filter((entry) => entry.trim().length > 0)
      : [title];
    const slug = (product.categorySlug?.trim() || slugifyCategoryLabel(title));
    const existing = categories.get(slug);

    if (existing) {
      existing.products.push(product);
      if (product.query?.trim()) {
        existing.queries.add(product.query.trim());
      }
      continue;
    }

    categories.set(slug, {
      slug,
      title,
      description: "",
      sourcePath,
      queries: new Set(product.query?.trim() ? [product.query.trim()] : []),
      products: [product],
    });
  }

  return [...categories.values()]
    .map((category) => {
      const products = dedupeProducts(category.products);
      const count = products.length;

      return {
        slug: category.slug,
        title: category.title,
        description: buildCategoryDescription(category.title, category.sourcePath, count),
        href: buildCategoryHref(category.slug),
        image: products[0]?.image,
        productCount: count,
        productSlugs: products.map((product) => product.slug),
        sourcePath: category.sourcePath,
        sourcePathLabel: category.sourcePath.join(" / "),
        queries: [...category.queries],
        products,
      } satisfies CatalogCategoryRecord;
    })
    .sort((left, right) => {
      const rank = getCategorySortRank(left.slug) - getCategorySortRank(right.slug);
      if (rank !== 0) {
        return rank;
      }

      if (right.productCount !== left.productCount) {
        return right.productCount - left.productCount;
      }

      return left.title.localeCompare(right.title, "fr");
    });
});

export const getCatalogCategoryBySlug = cache(async function getCatalogCategoryBySlug(slug: string): Promise<CatalogCategoryRecord | null> {
  const categories = await getCatalogCategories();
  return categories.find((category) => category.slug === slug) ?? null;
});
