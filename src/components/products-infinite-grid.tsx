"use client";

import { ProductsFeedClient } from "@/components/products/products-feed-client";

import type { ProductFeedItem, ProductFeedPage } from "@/lib/products-feed";

type ProductsInfiniteGridProps = {
  initialPage: ProductFeedPage;
  locale: string;
  currencyCode: string;
  currencyRateFromUsd: number;
};

export function ProductsInfiniteGrid({ initialPage, locale, currencyCode, currencyRateFromUsd }: ProductsInfiniteGridProps) {
  return (
    <ProductsFeedClient
      initialPage={initialPage}
      locale={locale}
      currencyCode={currencyCode}
      currencyRateFromUsd={currencyRateFromUsd}
      endpointPath="/api/products"
    />
  );
}