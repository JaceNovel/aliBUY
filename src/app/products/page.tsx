import Link from "next/link";
import { Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { InternalPageShell } from "@/components/internal-page-shell";
import { ProductsFeedClient } from "@/components/products/products-feed-client";
import { ProductsFilterBar } from "@/components/products/products-filter-bar";
import { FREE_DEAL_ROUTE, isFreeDealSearchQuery } from "@/lib/free-deal-constants";
import {
  getCategoryProductsFeedPage,
  getProductFeedCategoryBySlug,
  getProductFeedCategoryOptions,
  getProductsFeedPage,
  getSearchProductsFeedPage,
  PRODUCTS_FEED_PAGE_SIZE,
} from "@/lib/products-feed";
import { getPricingContext } from "@/lib/pricing";
import { SITE_NAME, SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: `Catalogue produits | ${SITE_NAME}`,
  description: "Parcourez le catalogue AfriPay, filtrez les produits importes depuis Alibaba et explorez des fiches propres pour la vente et le sourcing B2B.",
  alternates: {
    canonical: `${SITE_URL}/products`,
  },
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const [pricing, { q = "", category: categorySlug = "" }] = await Promise.all([getPricingContext(), searchParams]);
  const query = q.trim();
  if (isFreeDealSearchQuery(query)) {
    redirect(FREE_DEAL_ROUTE);
  }

  const normalizedCategorySlug = categorySlug.trim();
  const [categoryOptions, activeCategory, initialProductsPage] = await Promise.all([
    getProductFeedCategoryOptions(),
    normalizedCategorySlug ? getProductFeedCategoryBySlug(normalizedCategorySlug) : Promise.resolve(null),
    normalizedCategorySlug
      ? getCategoryProductsFeedPage({ category: normalizedCategorySlug, page: 1, limit: PRODUCTS_FEED_PAGE_SIZE })
      : query
      ? getSearchProductsFeedPage({ q: query, page: 1, limit: PRODUCTS_FEED_PAGE_SIZE })
      : getProductsFeedPage({ page: 1, limit: PRODUCTS_FEED_PAGE_SIZE }),
  ]);
  const endpointPath = normalizedCategorySlug
    ? "/api/products/category"
    : query
    ? "/api/products/search"
    : "/api/products";
  const endpointParams = normalizedCategorySlug
    ? { category: normalizedCategorySlug }
    : query
    ? { q: query }
    : undefined;
  const title = activeCategory ? activeCategory.title : query ? `Produits filtres pour "${query}"` : "Tous les produits";
  const description = activeCategory
    ? `${activeCategory.productCount} produit(s) disponibles dans la categorie ${activeCategory.title}, charges par lots de ${initialProductsPage.pageSize}.`
    : query
    ? `Recherche backend paginee active. Les resultats pour "${query}" sont charges par lots de ${initialProductsPage.pageSize}.`
    : `Catalogue AfriPay charge progressivement, ${initialProductsPage.pageSize} produits par requete.`;

  return (
    <InternalPageShell pricing={pricing}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#666]">
          <Link href="/" className="transition hover:text-[#ff6a00]">Accueil</Link>
          <span>/</span>
          <span className="font-medium text-[#222]">Produits</span>
        </div>

        <section className="rounded-[30px] bg-white px-6 py-6 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 lg:px-8 lg:py-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#fff2e9] px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">
                <Sparkles className="h-4 w-4" />
                Catalogue produits
              </div>
              <h1 className="mt-4 text-[28px] font-bold tracking-[-0.05em] text-[#222] sm:text-[34px] lg:text-[42px]">
                {title}
              </h1>
              <p className="mt-3 max-w-[760px] text-[16px] leading-8 text-[#555]">{description}</p>
            </div>

            <ProductsFilterBar initialQuery={query} initialCategory={normalizedCategorySlug} categories={categoryOptions} />
          </div>
        </section>

        <ProductsFeedClient
          initialPage={initialProductsPage}
          locale={pricing.locale}
          currencyCode={pricing.currency.code}
          currencyRateFromUsd={pricing.currency.rateFromUsd}
          endpointPath={endpointPath}
          endpointParams={endpointParams}
          emptyState={{
            title: activeCategory ? "Aucun produit dans cette categorie" : query ? "Aucun produit trouve" : "Catalogue temporairement vide",
            description: activeCategory
              ? "Cette categorie ne contient encore aucun produit publie ou votre filtre est trop restrictif."
              : query
              ? "Essayez un mot-cle plus large ou changez de categorie pour relancer la recherche."
              : "Le flux catalogue n'a retourne aucun produit. Verifiez la publication des articles importes.",
          }}
        />
      </div>
    </InternalPageShell>
  );
}
