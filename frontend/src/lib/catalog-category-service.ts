import "server-only";

import { cache } from "react";

import { extractAlibabaCategoryInfo, slugifyCategoryLabel } from "@/lib/alibaba-operations";
import { getAlibabaImportedProducts } from "@/lib/alibaba-operations-store";
import { buildApiUrl } from "@/lib/api";
import { getCatalogProducts } from "@/lib/catalog-service";
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

function isNoiseCategoryTitle(value: string) {
  const normalized = value.trim().toLowerCase();
  return /^(usd|cny|eur|gbp|cad|aud|xof|fcfa|catalogue|autres produits|aliexpress|alibaba|general|misc|other|others)$/i.test(normalized);
}

function isNoiseCategorySlug(value: string) {
  const normalized = value.trim().toLowerCase();
  return /^(aliexpress|alibaba|general|misc|other|others)$/i.test(normalized);
}

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

function resolveCategoryProducts(category: CatalogCategoryRecord, products: ProductCatalogItem[]) {
  const productsBySlug = new Map(products.map((product) => [product.slug, product]));
  const explicitMatches = category.productSlugs.flatMap((slug) => {
    const product = productsBySlug.get(slug);
    return product ? [product] : [];
  });

  if (explicitMatches.length > 0) {
    return dedupeProducts([...category.products, ...explicitMatches]);
  }

  return dedupeProducts([
    ...category.products,
    ...products.filter((product) => {
      const inferredCategory = extractAlibabaCategoryInfo({
        rawPayload: product.rawPayload,
        title: product.title,
        keywords: product.keywords,
      });

      return inferredCategory.slug === category.slug
        || slugifyCategoryLabel(inferredCategory.title) === category.slug
        || slugifyCategoryLabel(category.title) === inferredCategory.slug;
    }),
  ]);
}

async function hydrateCategory(category: CatalogCategoryRecord): Promise<CatalogCategoryRecord> {
  if (category.products.length > 0 && category.productSlugs.length <= category.products.length) {
    return {
      ...category,
      products: dedupeProducts(category.products),
    };
  }

  const catalogProducts = await getCatalogProducts({ fresh: true });
  const products = resolveCategoryProducts(category, catalogProducts);
  if (products.length === 0) {
    return category;
  }

  const productCount = Math.max(category.productCount, products.length);

  return {
    ...category,
    image: category.image ?? products[0]?.image,
    productCount,
    productSlugs: products.map((product) => product.slug),
    products,
    description: buildCategoryDescription(category.title, category.sourcePath, productCount),
  };
}

async function fetchRemoteCatalogCategories() {
  try {
    const response = await fetch(buildApiUrl("/api/catalog/categories"), {
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
        return [] as CatalogCategoryRecord[];
      }

      const candidate = item as Record<string, unknown>;
      const slug = typeof candidate.slug === "string" && candidate.slug.trim()
        ? candidate.slug.trim()
        : slugifyCategoryLabel(typeof candidate.title === "string" ? candidate.title : "catalogue");
      const title = typeof candidate.title === "string" && candidate.title.trim()
        ? candidate.title.trim()
        : slug;
      if (isNoiseCategorySlug(slug) || isNoiseCategoryTitle(title)) {
        return [] as CatalogCategoryRecord[];
      }
      const productCount = typeof candidate.productCount === "number" && Number.isFinite(candidate.productCount)
        ? candidate.productCount
        : 0;
      const products = Array.isArray(candidate.products)
        ? candidate.products.filter((product) => product && typeof product === "object") as ProductCatalogItem[]
        : [];

      return [{
        slug,
        title,
        description: typeof candidate.description === "string" && candidate.description.trim()
          ? candidate.description.trim()
          : buildCategoryDescription(title, [title], productCount),
        href: typeof candidate.href === "string" && candidate.href.trim()
          ? candidate.href.trim()
          : buildCategoryHref(slug),
        image: typeof candidate.image === "string" && candidate.image.trim() ? candidate.image.trim() : undefined,
        productCount,
        productSlugs: Array.isArray(candidate.productSlugs)
          ? candidate.productSlugs.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
          : products.map((product) => product.slug),
        sourcePath: Array.isArray(candidate.sourcePath)
          ? candidate.sourcePath.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
          : [title],
        sourcePathLabel: typeof candidate.sourcePathLabel === "string" && candidate.sourcePathLabel.trim()
          ? candidate.sourcePathLabel.trim()
          : title,
        queries: Array.isArray(candidate.queries)
          ? candidate.queries.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
          : [],
        products,
      } satisfies CatalogCategoryRecord];
    });
  } catch {
    return null;
  }
}

function mergeCatalogCategories(remoteCategories: CatalogCategoryRecord[], localCategories: CatalogCategoryRecord[]) {
  const merged = new Map<string, CatalogCategoryRecord>();

  for (const category of remoteCategories) {
    merged.set(category.slug, category);
  }

  for (const localCategory of localCategories) {
    const existing = merged.get(localCategory.slug);
    if (!existing) {
      merged.set(localCategory.slug, localCategory);
      continue;
    }

    const productSlugs = [...new Set([...existing.productSlugs, ...localCategory.productSlugs])];
    const products = dedupeProducts([...existing.products, ...localCategory.products]);
    const productCount = Math.max(existing.productCount, localCategory.productCount, productSlugs.length, products.length);

    merged.set(localCategory.slug, {
      ...existing,
      title: existing.title || localCategory.title,
      description: existing.description || localCategory.description,
      image: existing.image ?? localCategory.image,
      productCount,
      productSlugs,
      sourcePath: existing.sourcePath.length > 0 ? existing.sourcePath : localCategory.sourcePath,
      sourcePathLabel: existing.sourcePathLabel || localCategory.sourcePathLabel,
      queries: [...new Set([...existing.queries, ...localCategory.queries])],
      products,
    });
  }

  return [...merged.values()]
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
}

export const getCatalogCategories = cache(async function getCatalogCategories(): Promise<CatalogCategoryRecord[]> {
  const remoteCategories = await fetchRemoteCatalogCategories();

  const importedProducts = await getAlibabaImportedProducts();
  const publishedProducts = importedProducts.filter((product) => product.publishedToSite && product.status !== "archived");
  const categories = new Map<string, CategoryAccumulator>();

  for (const product of publishedProducts) {
    const normalizedCategory = extractAlibabaCategoryInfo({
      rawPayload: product.rawPayload,
      query: product.query,
      title: product.title,
      keywords: product.keywords,
      categoryTitle: product.categoryTitle?.trim(),
      categoryPath: Array.isArray(product.categoryPath) ? product.categoryPath : undefined,
    });
    const title = normalizedCategory.title;
    const sourcePath = normalizedCategory.path;
    const slug = normalizedCategory.slug || slugifyCategoryLabel(title);
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

  const localCategories = [...categories.values()]
    .filter((category) => !isNoiseCategoryTitle(category.title) && !isNoiseCategorySlug(category.slug))
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

  if (remoteCategories && remoteCategories.length > 0 && localCategories.length > 0) {
    return mergeCatalogCategories(remoteCategories, localCategories);
  }

  if (localCategories.length > 0) {
    return localCategories;
  }

  return remoteCategories ?? [];
});

export const getCatalogCategoryBySlug = cache(async function getCatalogCategoryBySlug(slug: string): Promise<CatalogCategoryRecord | null> {
  const categories = await getCatalogCategories();
  const category = categories.find((entry) => entry.slug === slug) ?? null;
  return category ? hydrateCategory(category) : null;
});
