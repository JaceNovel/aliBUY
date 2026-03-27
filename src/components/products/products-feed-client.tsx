"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { ProductFeedPage } from "@/lib/products-feed";

import { ProductCard } from "@/components/products/product-card";
import { ProductGridSkeleton } from "@/components/products/product-grid-skeleton";

type ProductsFeedClientProps = {
  initialPage: ProductFeedPage;
  locale: string;
  currencyCode: string;
  currencyRateFromUsd: number;
  endpointPath: string;
  endpointParams?: Record<string, string | undefined>;
  emptyState?: {
    title: string;
    description: string;
  };
};

function buildPriceFormatter(locale: string, currencyCode: string, rateFromUsd: number) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: rateFromUsd >= 100 ? 0 : 2,
    maximumFractionDigits: rateFromUsd >= 100 ? 0 : 2,
  });
}

function formatProductPrice(item: ProductFeedPage["items"][number], formatter: Intl.NumberFormat, rateFromUsd: number) {
  const minAmount = item.minUsd * rateFromUsd;
  if (typeof item.maxUsd === "number" && item.maxUsd > item.minUsd) {
    return `${formatter.format(minAmount)} - ${formatter.format(item.maxUsd * rateFromUsd)}`;
  }

  return formatter.format(minAmount);
}

function buildEndpointUrl(endpointPath: string, endpointParams: Record<string, string | undefined>, page: number, limit: number) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(endpointParams)) {
    if (value?.trim()) {
      params.set(key, value);
    }
  }

  params.set("page", String(page));
  params.set("limit", String(limit));

  return `${endpointPath}?${params.toString()}`;
}

export function ProductsFeedClient({
  initialPage,
  locale,
  currencyCode,
  currencyRateFromUsd,
  endpointPath,
  endpointParams,
  emptyState,
}: ProductsFeedClientProps) {
  const [items, setItems] = useState(initialPage.items);
  const [page, setPage] = useState(initialPage.page);
  const [hasMore, setHasMore] = useState(initialPage.hasMore);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isFetchingRef = useRef(false);
  const safeEndpointParams = endpointParams ?? {};
  const requestKey = useMemo(() => buildEndpointUrl(endpointPath, safeEndpointParams, 1, initialPage.pageSize), [endpointPath, initialPage.pageSize, safeEndpointParams]);
  const formatter = useMemo(
    () => buildPriceFormatter(locale, currencyCode, currencyRateFromUsd),
    [currencyCode, currencyRateFromUsd, locale],
  );

  useEffect(() => {
    setItems(initialPage.items);
    setPage(initialPage.page);
    setHasMore(initialPage.hasMore);
    setErrorMessage(null);
    setIsLoading(false);
    isFetchingRef.current = false;
  }, [initialPage, requestKey]);

  const loadPage = async (nextPage: number) => {
    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(buildEndpointUrl(endpointPath, safeEndpointParams, nextPage, initialPage.pageSize), {
        method: "GET",
      });
      const payload = await response.json().catch(() => null) as ProductFeedPage | null;

      if (!response.ok || !payload) {
        const apiError = payload && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "Impossible de charger la suite du catalogue.";
        throw new Error(apiError);
      }

      setItems((current) => (nextPage === 1 ? payload.items : [...current, ...payload.items]));
      setPage(payload.page);
      setHasMore(payload.hasMore);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible de charger la suite du catalogue.");
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadPage(page + 1);
        }
      },
      {
        rootMargin: "600px 0px",
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, page, requestKey]);

  if (!items.length && !isLoading) {
    return (
      <section className="rounded-[30px] bg-white px-6 py-8 text-center shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5">
        <h2 className="text-[30px] font-bold tracking-[-0.04em] text-[#222]">{emptyState?.title ?? "Aucun produit trouve"}</h2>
        <p className="mx-auto mt-3 max-w-[620px] text-[16px] leading-8 text-[#555]">
          {emptyState?.description ?? "Essayez une autre recherche pour filtrer le catalogue avec un mot-cle plus large."}
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {items.map((product) => (
          <ProductCard
            key={product.slug}
            product={product}
            formattedPrice={formatProductPrice(product, formatter, currencyRateFromUsd)}
          />
        ))}
      </section>

      {isLoading ? <ProductGridSkeleton count={Math.min(initialPage.pageSize, 8)} /> : null}

      <div ref={sentinelRef} className="h-4 w-full" aria-hidden="true" />

      {errorMessage ? (
        <div className="rounded-[20px] bg-[#fff7f2] px-5 py-4 text-center ring-1 ring-[#f2dacb]">
          <div className="text-[14px] font-medium text-[#8a3b12]">{errorMessage}</div>
          <button type="button" onClick={() => void loadPage(page + 1)} className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-[#222] px-5 text-[14px] font-semibold text-white transition hover:bg-black">
            Reessayer
          </button>
        </div>
      ) : null}

      {!hasMore && items.length > 0 ? (
        <div className="rounded-[20px] bg-white px-5 py-4 text-center text-[14px] font-medium text-[#667085] ring-1 ring-black/5">
          Tous les produits sont charges.
        </div>
      ) : null}
    </div>
  );
}