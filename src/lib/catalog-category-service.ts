import "server-only";

import { extractAlibabaCategoryInfo, toCatalogProduct, type AlibabaImportedProduct } from "@/lib/alibaba-operations";
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

type CanonicalCategoryMatch = {
  slug: string;
  title: string;
  description: string;
  path: string[];
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
  return `/products?category=${encodeURIComponent(slug)}`;
}

function looksLikeAlibabaAssetLabel(value?: string) {
  if (!value) {
    return false;
  }

  const normalized = value.trim();
  return /\b220x220\b/i.test(normalized) || /^[a-z0-9]{20,}\.(png|jpg|jpeg|webp)/i.test(normalized) || /^[A-Z0-9]{20,}\.(png|jpg|jpeg|webp)/.test(normalized);
}

function matchCanonicalImportedCategory(importedProduct: AlibabaImportedProduct): CanonicalCategoryMatch | null {
  const haystack = [
    importedProduct.query,
    importedProduct.title,
    importedProduct.shortTitle,
    importedProduct.categoryTitle,
    ...(importedProduct.keywords ?? []),
    ...(importedProduct.overview ?? []),
    ...(importedProduct.specs ?? []).flatMap((spec) => [spec.label, spec.value]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/\b(mouse|mice|souris|keyboard|keyboards|clavier|claviers|keypad|keycaps)\b/.test(haystack)) {
    return {
      slug: "keyboard-mouse",
      title: "Claviers & souris",
      description: "Souris gaming, claviers, combos et accessoires PC importes depuis Alibaba.",
      path: ["Informatique", "Claviers & souris"],
    };
  }

  return null;
}

export async function getCatalogCategories() {
  const importedProducts = (await getAlibabaImportedProducts())
    .filter((item) => item.publishedToSite && item.status === "published");

  const groups = new Map<string, CategoryAccumulator>();

  for (const importedProduct of importedProducts) {
    const canonicalCategory = matchCanonicalImportedCategory(importedProduct);
    const extractedCategory = extractAlibabaCategoryInfo({
      ...importedProduct,
      categorySlug: looksLikeAlibabaAssetLabel(importedProduct.categoryTitle) ? undefined : importedProduct.categorySlug,
      categoryTitle: looksLikeAlibabaAssetLabel(importedProduct.categoryTitle) ? undefined : importedProduct.categoryTitle,
      categoryPath: looksLikeAlibabaAssetLabel(importedProduct.categoryTitle) ? undefined : importedProduct.categoryPath,
    });
    const category = canonicalCategory ?? {
      slug: extractedCategory.slug,
      title: extractedCategory.title,
      description: buildCategoryDescription(extractedCategory.title, extractedCategory.path, 1),
      path: extractedCategory.path,
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
      if (left.productCount === right.productCount) {
        return left.title.localeCompare(right.title, "fr");
      }

      return right.productCount - left.productCount;
    });
}

export async function getCatalogCategoryBySlug(slug: string) {
  const categories = await getCatalogCategories();
  return categories.find((category) => category.slug === slug) ?? null;
}