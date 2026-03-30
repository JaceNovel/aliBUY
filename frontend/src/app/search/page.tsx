import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { InternalPageShell } from "@/components/internal-page-shell";
import { ProductsFeedClient } from "@/components/products/products-feed-client";
import { FREE_DEAL_ROUTE, isFreeDealSearchQuery } from "@/lib/free-deal-constants";
import { getPricingContext } from "@/lib/pricing";
import { getSearchProductsFeedPage } from "@/lib/products-feed";
import { SITE_NAME, SITE_URL } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: `Recherche | ${SITE_NAME}`,
  description: "Resultats de recherche produit AfriPay avec repli vers des articles similaires.",
  alternates: {
    canonical: `${SITE_URL}/search`,
  },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  if (isFreeDealSearchQuery(q)) {
    redirect(FREE_DEAL_ROUTE);
  }

  const query = q.trim();
  const [pricing, initialPage] = await Promise.all([
    getPricingContext(),
    getSearchProductsFeedPage({ q: query }),
  ]);
  const isSimilarFallback = initialPage.matchMode === "similar" && initialPage.items.length > 0;

  return (
    <InternalPageShell pricing={pricing}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#666]">
          <Link href="/" className="transition hover:text-[#ff6a00]">Accueil</Link>
          <span>/</span>
          <span className="font-medium text-[#222]">Recherche</span>
        </div>

        <section className="rounded-[30px] bg-white px-6 py-6 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 lg:px-8 lg:py-7">
          <div className="max-w-[860px]">
            <div className="inline-flex rounded-full bg-[#fff1e7] px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">
              Recherche AfriPay
            </div>
            <h1 className="mt-4 text-[30px] font-bold tracking-[-0.05em] text-[#222] sm:text-[38px]">
              {query ? `Resultats pour \"${query}\"` : "Recherchez un article"}
            </h1>
            <p className="mt-4 text-[16px] leading-8 text-[#555]">
              {!query
                ? "Saisissez un nom de produit, une reference ou un mot-cle pour afficher les articles disponibles."
                : isSimilarFallback
                  ? "Aucun resultat exact n'a ete trouve. Voici des articles similaires pour continuer votre recherche."
                  : "Voici les articles correspondants a votre recherche."}
            </p>
          </div>
        </section>

        <ProductsFeedClient
          initialPage={initialPage}
          locale={pricing.locale}
          currencyCode={pricing.currency.code}
          currencyRateFromUsd={pricing.currency.rateFromUsd}
          endpointPath="/api/products/search"
          endpointParams={{ q: query }}
          emptyState={{
            title: query ? "Aucun article trouve" : "Saisissez une recherche",
            description: query
              ? "Aucun article correspondant ou similaire n'est disponible pour le moment. Essayez un mot-cle plus large."
              : "Utilisez la barre de recherche pour trouver un article ou afficher des produits similaires.",
          }}
        />
      </div>
    </InternalPageShell>
  );
}
