import "server-only";

import { cache } from "react";

import { canonicalizeAlibabaCategory, extractAlibabaCategoryInfo, toCatalogProduct } from "@/lib/alibaba-operations";
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
  const importedProducts = (await getAlibabaImportedProducts())
    .filter((item) => item.publishedToSite && item.status === "published");

  const groups = new Map<string, CategoryAccumulator>();

  for (const importedProduct of importedProducts) {
    const extractedCategory = extractAlibabaCategoryInfo({
      ...importedProduct,
      rawPayload: importedProduct.rawPayload,
      categorySlug: importedProduct.categorySlug,
      categoryTitle: importedProduct.categoryTitle,
      categoryPath: importedProduct.categoryPath,
    });
    const canonicalCategory = canonicalizeAlibabaCategory({
      title: extractedCategory.title,
      path: extractedCategory.path,
    });
    const category = {
      slug: canonicalCategory.slug,
      title: canonicalCategory.title,
      description: buildCategoryDescription(canonicalCategory.title, canonicalCategory.path, 1),
      path: canonicalCategory.path,
    };
    const catalogProduct = toCatalogProduct(importedProduct);
    const existing = groups.get(category.slug);

    if (existing) {
      existing.products.push(catalogProduct);
      if (importedProduct.query?.trim()) {
        existing.queries.add(importedProduct.query.trim());
      }
      continue;
    }

    groups.set(category.slug, {
      slug: category.slug,
      title: category.title,
      description: category.description,
      sourcePath: category.path,
      queries: new Set(importedProduct.query?.trim() ? [importedProduct.query.trim()] : []),
      products: [catalogProduct],
    });
  }

  return [...groups.values()]
    .map((group) => {
      const products = dedupeProducts(group.products);

      return {
        slug: group.slug,
        title: group.title,
        description: group.description || buildCategoryDescription(group.title, group.sourcePath, products.length),
        href: buildCategoryHref(group.slug),
        image: products[0]?.image,
        productCount: products.length,
        productSlugs: products.map((product) => product.slug),
        sourcePath: group.sourcePath,
        sourcePathLabel: group.sourcePath.join(" / "),
        queries: [...group.queries].filter(Boolean),
        products,
      } satisfies CatalogCategoryRecord;
    })
    .sort((left, right) => {
      const rankDelta = getCategorySortRank(left.slug) - getCategorySortRank(right.slug);
      if (rankDelta !== 0) {
        return rankDelta;
      }

      if (left.productCount !== right.productCount) {
        return right.productCount - left.productCount;
      }

      return left.title.localeCompare(right.title, "fr");
    });
});

export const getCatalogCategoryBySlug = cache(async function getCatalogCategoryBySlug(slug: string) {
  const categories = await getCatalogCategories();
  return categories.find((category) => category.slug === slug) ?? null;
});
