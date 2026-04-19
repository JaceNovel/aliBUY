import { getEffectiveProductMoq } from "@/lib/alibaba-sourcing";
import type { ProductFeedPage } from "@/lib/api";
import type { ProductCatalogItem } from "@/lib/products-data";

function toFeedItem(product: ProductCatalogItem): ProductFeedPage["items"][number] {
  return {
    slug: product.slug,
    title: product.title,
    image: product.image,
    badge: product.badge,
    minUsd: product.minUsd,
    maxUsd: product.maxUsd,
    moq: getEffectiveProductMoq(product.moq, product.itemWeightGrams),
    moqVerified: product.moqVerified,
    itemWeightGrams: product.itemWeightGrams,
    unit: product.unit,
  };
}

export function buildCatalogFallbackProductFeedPage(options: {
  products: ProductCatalogItem[];
  source: ProductFeedPage["source"];
  query?: string;
  category?: string;
  matchMode?: ProductFeedPage["matchMode"];
}): ProductFeedPage {
  const items = options.products.map(toFeedItem);

  return {
    items,
    page: 1,
    nextPage: null,
    hasMore: false,
    pageSize: Math.max(items.length, 20),
    source: options.source,
    query: options.query,
    category: options.category,
    matchMode: options.matchMode,
  };
}
