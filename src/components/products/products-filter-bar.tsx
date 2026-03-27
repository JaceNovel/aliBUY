"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { SearchSuggestionInput } from "@/components/search-suggestion-input";
import type { ProductFeedCategoryOption } from "@/lib/products-feed";

type ProductsFilterBarProps = {
  initialQuery: string;
  initialCategory: string;
  categories: ProductFeedCategoryOption[];
};

function buildProductsUrl(pathname: string, query: string, category: string) {
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }

  if (category) {
    params.set("category", category);
  }

  const serializedParams = params.toString();
  return serializedParams ? `${pathname}?${serializedParams}` : pathname;
}

export function ProductsFilterBar({ initialQuery, initialCategory, categories }: ProductsFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length === 1) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const nextUrl = buildProductsUrl(pathname, normalizedQuery, category);
      const currentQuery = searchParams.toString();
      const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;

      if (nextUrl !== currentUrl) {
        router.replace(nextUrl, { scroll: false });
      }
    }, 320);

    return () => window.clearTimeout(timeoutId);
  }, [category, pathname, query, router, searchParams]);

  const hasActiveFilters = query.trim().length > 0 || category.length > 0;

  return (
    <div className="space-y-3 lg:min-w-[620px]">
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start">
        <SearchSuggestionInput
          key={`${initialQuery}:${initialCategory}`}
          name="q"
          defaultValue={initialQuery}
          placeholder="Ex: souris, bureau gaming, activewear"
          wrapperClassName="relative flex-1"
          inputClassName="h-14 w-full rounded-full border border-[#d8dde6] bg-white px-5 text-[16px] text-[#222] outline-none transition focus:border-[#ff6a00]"
          panelClassName="absolute left-0 right-0 top-[calc(100%+14px)] z-30 rounded-[26px] border border-black/5 bg-white p-4 shadow-[0_24px_48px_rgba(17,24,39,0.16)]"
          onValueChange={setQuery}
        />

        <label className="relative block sm:w-[240px]">
          <span className="sr-only">Categorie</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-14 w-full appearance-none rounded-full border border-[#d8dde6] bg-white px-5 text-[15px] text-[#222] outline-none transition focus:border-[#ff6a00]"
          >
            <option value="">Toutes les categories</option>
            {categories.map((option) => (
              <option key={option.slug} value={option.slug}>
                {option.title}{typeof option.productCount === "number" ? ` (${option.productCount})` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="text-[12px] font-medium text-[#667085]">
          Recherche debouncee a 320 ms. Minimum conseille: 2 caracteres.
        </div>
        {hasActiveFilters ? (
          <Link href="/products" className="text-[13px] font-semibold text-[#d85300] transition hover:text-[#ff6a00]">
            Effacer les filtres
          </Link>
        ) : null}
      </div>
    </div>
  );
}