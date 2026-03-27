import "server-only";

import { Prisma } from "@prisma/client";
import { cache } from "react";

import { getCatalogCategoryBySlug, getCatalogCategories } from "@/lib/catalog-category-service";
import { getCatalogProducts, searchCatalogProducts } from "@/lib/catalog-service";
import { prisma } from "@/lib/prisma";
import { withRedisJsonCache } from "@/lib/redis-cache";

export const PRODUCTS_FEED_PAGE_SIZE = 20;
const PRODUCTS_FEED_MAX_PAGE_SIZE = 40;
const PRODUCTS_FEED_MAX_PAGE_NUMBER = 250;
const FEATURED_PRODUCTS_DEFAULT_LIMIT = 8;
const FEATURED_PRODUCTS_REDIS_TTL_SECONDS = 120;

export const PRODUCTS_FEED_REVALIDATE_SECONDS = 60;
export const PRODUCTS_FEED_RESPONSE_CACHE_HEADER = `public, s-maxage=${PRODUCTS_FEED_REVALIDATE_SECONDS}, stale-while-revalidate=300`;

const PRODUCT_FEED_SELECT = {
  slug: true,
  title: true,
  image: true,
  badge: true,
  minUsd: true,
  maxUsd: true,
  moq: true,
  unit: true,
} satisfies Prisma.AlibabaImportedProductRecordSelect;

type ProductFeedRow = Prisma.AlibabaImportedProductRecordGetPayload<{
  select: typeof PRODUCT_FEED_SELECT;
}>;

type ProductFeedSource = "catalog" | "search" | "category" | "featured";

export type ProductFeaturedMode = "recommended" | "top" | "trending";

export type ProductFeedItem = {
  slug: string;
  title: string;
  image: string;
  badge?: string;
  minUsd: number;
  maxUsd?: number;
  moq: number;
  unit: string;
};

export type ProductFeedPage = {
  items: ProductFeedItem[];
  page: number;
  nextPage: number | null;
  hasMore: boolean;
  pageSize: number;
  source: ProductFeedSource;
  query?: string;
  category?: string;
  mode?: ProductFeaturedMode;
};

export type ProductFeedCategoryOption = {
  slug: string;
  title: string;
  productCount?: number;
};

export type ProductFeedCategorySummary = {
  slug: string;
  title: string;
  productCount: number;
};

function normalizePositiveInt(value: unknown, fallback: number, max?: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  const normalized = Math.floor(parsed);
  return typeof max === "number" ? Math.min(normalized, max) : normalized;
}

function normalizeTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isMissingColumnError(error: unknown) {
  return Boolean(
    error
    && typeof error === "object"
    && "code" in error
    && error.code === "P2022",
  );
}

function getPageInput(input?: {
  page?: number | string | null;
  limit?: number | string | null;
}) {
  const page = normalizePositiveInt(input?.page, 1, PRODUCTS_FEED_MAX_PAGE_NUMBER);
  const pageSize = normalizePositiveInt(input?.limit, PRODUCTS_FEED_PAGE_SIZE, PRODUCTS_FEED_MAX_PAGE_SIZE);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
  };
}

function toProductFeedItem(product: {
  slug: string;
  title: string;
  image: string;
  badge?: string | null;
  minUsd: number;
  maxUsd?: number | null;
  moq: number;
  unit: string;
}): ProductFeedItem {
  return {
    slug: product.slug,
    title: product.title,
    image: product.image,
    badge: product.badge ?? undefined,
    minUsd: product.minUsd,
    maxUsd: product.maxUsd ?? undefined,
    moq: product.moq,
    unit: product.unit,
  };
}

function buildPublishedWhere(): Prisma.AlibabaImportedProductRecordWhereInput {
  return {
    publishedToSite: true,
    status: "published",
  };
}

function buildSearchWhere(query: string): Prisma.AlibabaImportedProductRecordWhereInput {
  const normalizedQuery = normalizeTrimmedString(query);

  return {
    ...buildPublishedWhere(),
    OR: [
      { title: { contains: normalizedQuery, mode: "insensitive" } },
      { shortTitle: { contains: normalizedQuery, mode: "insensitive" } },
      { description: { contains: normalizedQuery, mode: "insensitive" } },
      { supplierName: { contains: normalizedQuery, mode: "insensitive" } },
      { categoryTitle: { contains: normalizedQuery, mode: "insensitive" } },
      { categorySlug: { contains: normalizedQuery, mode: "insensitive" } },
    ],
  };
}

function buildCategoryWhere(category: string): Prisma.AlibabaImportedProductRecordWhereInput {
  const normalizedCategory = normalizeTrimmedString(category);

  return {
    ...buildPublishedWhere(),
    OR: [
      { categorySlug: { equals: normalizedCategory, mode: "insensitive" } },
      { categoryTitle: { equals: normalizedCategory, mode: "insensitive" } },
    ],
  };
}

function buildPagePayload(
  rows: ProductFeedRow[],
  page: number,
  pageSize: number,
  source: ProductFeedSource,
  meta?: { query?: string; category?: string; mode?: ProductFeaturedMode },
): ProductFeedPage {
  const hasMore = rows.length > pageSize;
  const items = rows.slice(0, pageSize).map(toProductFeedItem);

  return {
    items,
    page,
    nextPage: hasMore ? page + 1 : null,
    hasMore,
    pageSize,
    source,
    query: meta?.query,
    category: meta?.category,
    mode: meta?.mode,
  };
}

async function getDatabaseFeedPage(options: {
  page: number;
  pageSize: number;
  skip: number;
  where: Prisma.AlibabaImportedProductRecordWhereInput;
  orderBy?: Prisma.AlibabaImportedProductRecordOrderByWithRelationInput[];
  source: ProductFeedSource;
  query?: string;
  category?: string;
  mode?: ProductFeaturedMode;
}) {
  const rows = await prisma.alibabaImportedProductRecord.findMany({
    where: options.where,
    orderBy: options.orderBy ?? [{ updatedAt: "desc" }, { id: "desc" }],
    skip: options.skip,
    take: options.pageSize + 1,
    select: PRODUCT_FEED_SELECT,
  });

  return buildPagePayload(rows, options.page, options.pageSize, options.source, {
    query: options.query,
    category: options.category,
    mode: options.mode,
  });
}

function buildFallbackPage(options: {
  items: Array<{
    slug: string;
    title: string;
    image: string;
    badge?: string | null;
    minUsd: number;
    maxUsd?: number | null;
    moq: number;
    unit: string;
  }>;
  page: number;
  pageSize: number;
  source: ProductFeedSource;
  query?: string;
  category?: string;
  mode?: ProductFeaturedMode;
}) {
  const mappedItems = options.items.slice(0, options.pageSize + 1).map(toProductFeedItem);
  const hasMore = mappedItems.length > options.pageSize;

  return {
    items: mappedItems.slice(0, options.pageSize),
    page: options.page,
    nextPage: hasMore ? options.page + 1 : null,
    hasMore,
    pageSize: options.pageSize,
    source: options.source,
    query: options.query,
    category: options.category,
    mode: options.mode,
  } satisfies ProductFeedPage;
}

function buildFeaturedOrderBy(mode: ProductFeaturedMode): Prisma.AlibabaImportedProductRecordOrderByWithRelationInput[] {
  switch (mode) {
    case "top":
      return [{ salesCount: "desc" }, { viewsCount: "desc" }, { publishedAt: "desc" }, { id: "desc" }];
    case "trending":
      return [{ viewsCount: "desc" }, { salesCount: "desc" }, { updatedAt: "desc" }, { id: "desc" }];
    case "recommended":
    default:
      return [{ salesCount: "desc" }, { viewsCount: "desc" }, { updatedAt: "desc" }, { publishedAt: "desc" }, { id: "desc" }];
  }
}

async function getTrigramSearchProductsFeedPage(options: {
  query: string;
  page: number;
  pageSize: number;
  skip: number;
}) {
  const likeQuery = `%${options.query}%`;

  const rows = await prisma.$queryRaw<ProductFeedRow[]>(Prisma.sql`
    SELECT
      "slug",
      "title",
      "image",
      "badge",
      "minUsd",
      "maxUsd",
      "moq",
      "unit"
    FROM "AlibabaImportedProductRecord"
    WHERE "publishedToSite" = true
      AND "status" = 'published'
      AND (
        "title" % ${options.query}
        OR "title" ILIKE ${likeQuery}
        OR "shortTitle" ILIKE ${likeQuery}
        OR "supplierName" ILIKE ${likeQuery}
        OR COALESCE("categoryTitle", '') ILIKE ${likeQuery}
        OR COALESCE("categorySlug", '') ILIKE ${likeQuery}
      )
    ORDER BY
      GREATEST(
        similarity("title", ${options.query}),
        similarity("shortTitle", ${options.query})
      ) DESC,
      "salesCount" DESC,
      "viewsCount" DESC,
      "updatedAt" DESC,
      "id" DESC
    LIMIT ${options.pageSize + 1}
    OFFSET ${options.skip}
  `);

  return buildPagePayload(rows, options.page, options.pageSize, "search", {
    query: options.query,
  });
}

export async function getProductsFeedPage(input?: {
  page?: number | string | null;
  limit?: number | string | null;
}): Promise<ProductFeedPage> {
  const { page, pageSize, skip } = getPageInput(input);

  if (process.env.DATABASE_URL) {
    return getDatabaseFeedPage({
      page,
      pageSize,
      skip,
      where: buildPublishedWhere(),
      source: "catalog",
    });
  }

  const products = await getCatalogProducts();
  return buildFallbackPage({
    items: products.slice(skip, skip + pageSize + 1),
    page,
    pageSize,
    source: "catalog",
  });
}

export async function getSearchProductsFeedPage(input: {
  q: string;
  page?: number | string | null;
  limit?: number | string | null;
}): Promise<ProductFeedPage> {
  const normalizedQuery = normalizeTrimmedString(input.q);
  const { page, pageSize, skip } = getPageInput(input);

  if (!normalizedQuery) {
    return {
      items: [],
      page,
      nextPage: null,
      hasMore: false,
      pageSize,
      source: "search",
      query: normalizedQuery,
    };
  }

  if (process.env.DATABASE_URL) {
    try {
      return await getTrigramSearchProductsFeedPage({
        query: normalizedQuery,
        page,
        pageSize,
        skip,
      });
    } catch (error) {
      console.warn("[products-feed] trigram search fallback", {
        message: error instanceof Error ? error.message : "Unknown error",
      });

      return getDatabaseFeedPage({
        page,
        pageSize,
        skip,
        where: buildSearchWhere(normalizedQuery),
        source: "search",
        query: normalizedQuery,
      });
    }
  }

  const products = await searchCatalogProducts(normalizedQuery);
  return buildFallbackPage({
    items: products.slice(skip, skip + pageSize + 1),
    page,
    pageSize,
    source: "search",
    query: normalizedQuery,
  });
}

export async function getCategoryProductsFeedPage(input: {
  category: string;
  page?: number | string | null;
  limit?: number | string | null;
}): Promise<ProductFeedPage> {
  const normalizedCategory = normalizeTrimmedString(input.category);
  const { page, pageSize, skip } = getPageInput(input);

  if (!normalizedCategory) {
    return {
      items: [],
      page,
      nextPage: null,
      hasMore: false,
      pageSize,
      source: "category",
      category: normalizedCategory,
    };
  }

  if (process.env.DATABASE_URL) {
    return getDatabaseFeedPage({
      page,
      pageSize,
      skip,
      where: buildCategoryWhere(normalizedCategory),
      source: "category",
      category: normalizedCategory,
    });
  }

  const category = await getCatalogCategoryBySlug(normalizedCategory);
  return buildFallbackPage({
    items: (category?.products ?? []).slice(skip, skip + pageSize + 1),
    page,
    pageSize,
    source: "category",
    category: normalizedCategory,
  });
}

export async function getFeaturedProductsFeed(input?: {
  limit?: number | string | null;
  mode?: ProductFeaturedMode | string | null;
}): Promise<ProductFeedPage> {
  const pageSize = normalizePositiveInt(input?.limit, FEATURED_PRODUCTS_DEFAULT_LIMIT, PRODUCTS_FEED_MAX_PAGE_SIZE);
  const normalizedMode = normalizeTrimmedString(input?.mode);
  const mode: ProductFeaturedMode = normalizedMode === "top" || normalizedMode === "trending"
    ? normalizedMode
    : "recommended";

  const buildPayload = async () => {
    if (process.env.DATABASE_URL) {
      try {
        const rows = await prisma.alibabaImportedProductRecord.findMany({
          where: buildPublishedWhere(),
          orderBy: buildFeaturedOrderBy(mode),
          take: pageSize,
          select: PRODUCT_FEED_SELECT,
        });

        return buildPagePayload(rows, 1, pageSize, "featured", { mode });
      } catch (error) {
        if (!isMissingColumnError(error)) {
          throw error;
        }

        console.warn("[products-feed] popularity columns unavailable, falling back to recent ordering");

        const rows = await prisma.alibabaImportedProductRecord.findMany({
          where: buildPublishedWhere(),
          orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
          take: pageSize,
          select: PRODUCT_FEED_SELECT,
        });

        return buildPagePayload(rows, 1, pageSize, "featured", { mode: "recommended" });
      }
    }

    const products = await getCatalogProducts();
    return buildFallbackPage({
      items: products.slice(0, pageSize),
      page: 1,
      pageSize,
      source: "featured",
      mode,
    });
  };

  return withRedisJsonCache(`products:featured:${mode}:${pageSize}`, FEATURED_PRODUCTS_REDIS_TTL_SECONDS, buildPayload);
}

export async function incrementProductViewCount(slug: string) {
  const normalizedSlug = normalizeTrimmedString(slug);
  if (!normalizedSlug || !process.env.DATABASE_URL) {
    return;
  }

  try {
    await prisma.alibabaImportedProductRecord.updateMany({
      where: {
        slug: normalizedSlug,
        publishedToSite: true,
        status: "published",
      },
      data: {
        viewsCount: {
          increment: 1,
        },
      },
    });
  } catch (error) {
    if (isMissingColumnError(error)) {
      console.warn("[products-feed] viewsCount column unavailable, skipping view tracking");
      return;
    }

    throw error;
  }
}

export async function incrementProductSalesCounts(items: Array<{ slug: string; quantity?: number }>) {
  if (!process.env.DATABASE_URL || items.length === 0) {
    return;
  }

  const quantityBySlug = new Map<string, number>();

  for (const item of items) {
    const normalizedSlug = normalizeTrimmedString(item.slug);
    const quantity = normalizePositiveInt(item.quantity, 1);

    if (!normalizedSlug) {
      continue;
    }

    quantityBySlug.set(normalizedSlug, (quantityBySlug.get(normalizedSlug) ?? 0) + quantity);
  }

  if (quantityBySlug.size === 0) {
    return;
  }

  try {
    await prisma.$transaction(
      Array.from(quantityBySlug.entries()).map(([slug, quantity]) =>
        prisma.alibabaImportedProductRecord.updateMany({
          where: {
            slug,
            publishedToSite: true,
            status: "published",
          },
          data: {
            salesCount: {
              increment: quantity,
            },
          },
        })),
    );
  } catch (error) {
    if (isMissingColumnError(error)) {
      console.warn("[products-feed] salesCount column unavailable, skipping sales tracking");
      return;
    }

    throw error;
  }
}

export const getProductFeedCategoryOptions = cache(async function getProductFeedCategoryOptions() {
  if (process.env.DATABASE_URL) {
    const rows = await prisma.alibabaImportedProductRecord.groupBy({
      by: ["categorySlug", "categoryTitle"],
      where: {
        ...buildPublishedWhere(),
        categorySlug: { not: null },
        categoryTitle: { not: null },
      },
      _count: {
        _all: true,
      },
      orderBy: {
        categoryTitle: "asc",
      },
    });

    return rows
      .filter((row) => row.categorySlug && row.categoryTitle)
      .map((row) => ({
        slug: row.categorySlug as string,
        title: row.categoryTitle as string,
        productCount: row._count._all,
      })) satisfies ProductFeedCategoryOption[];
  }

  const categories = await getCatalogCategories();
  return categories.map((category) => ({
    slug: category.slug,
    title: category.title,
    productCount: category.productCount,
  })) satisfies ProductFeedCategoryOption[];
});

export const getProductFeedCategoryBySlug = cache(async function getProductFeedCategoryBySlug(slug: string) {
  const normalizedCategory = normalizeTrimmedString(slug);

  if (!normalizedCategory) {
    return null;
  }

  if (process.env.DATABASE_URL) {
    const where = buildCategoryWhere(normalizedCategory);
    const [row, productCount] = await Promise.all([
      prisma.alibabaImportedProductRecord.findFirst({
        where,
        select: {
          categorySlug: true,
          categoryTitle: true,
        },
      }),
      prisma.alibabaImportedProductRecord.count({ where }),
    ]);

    if (!row?.categorySlug || !row.categoryTitle) {
      return null;
    }

    return {
      slug: row.categorySlug,
      title: row.categoryTitle,
      productCount,
    } satisfies ProductFeedCategorySummary;
  }

  const category = await getCatalogCategoryBySlug(normalizedCategory);
  if (!category) {
    return null;
  }

  return {
    slug: category.slug,
    title: category.title,
    productCount: category.productCount,
  } satisfies ProductFeedCategorySummary;
});

export function buildProductFeedResponseHeaders(durationMs: number, itemCount: number) {
  return {
    "Cache-Control": PRODUCTS_FEED_RESPONSE_CACHE_HEADER,
    "Server-Timing": `app;dur=${durationMs.toFixed(1)}`,
    "X-Products-Count": String(itemCount),
  };
}

export function logProductFeedRequest(
  path: string,
  durationMs: number,
  itemCount: number,
  meta?: Record<string, string | number | null | undefined>,
) {
  console.info(`[products-feed] ${path}`, {
    durationMs: Number(durationMs.toFixed(1)),
    itemCount,
    ...meta,
  });
}
