import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { InternalPageShell } from "@/components/internal-page-shell";
import { ProductsFeedClient } from "@/components/products/products-feed-client";
import { getCategoryProducts } from "@/lib/api";
import { getCatalogCategoryBySlug } from "@/lib/catalog-category-service";
import { searchCatalogProducts } from "@/lib/catalog-service";
import { buildCatalogFallbackProductFeedPage } from "@/lib/product-feed-fallback";
import { getPricingContext } from "@/lib/pricing";
import { SITE_URL } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCatalogCategoryBySlug(slug);

  return {
    title: category ? `${category.title} | Categories` : "Categorie introuvable",
    description: category ? category.description : "Categorie catalogue introuvable.",
    alternates: {
      canonical: `${SITE_URL}/categories/${slug}`,
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [pricing, category] = await Promise.all([
    getPricingContext(),
    getCatalogCategoryBySlug(slug),
  ]);

  if (!category) {
    notFound();
  }

  const [apiInitialPage, searchFallbackProducts] = await Promise.all([
    getCategoryProducts(category.slug).catch(() => null),
    category.products.length > 0 ? Promise.resolve(category.products) : searchCatalogProducts(category.title),
  ]);
  const initialPage = apiInitialPage && apiInitialPage.items.length > 0
    ? apiInitialPage
    : buildCatalogFallbackProductFeedPage({
      products: searchFallbackProducts,
      source: "category",
      category: category.slug,
    });
  const displayProductCount = Math.max(category.productCount, initialPage.items.length);
  const displayDescription = displayProductCount > category.productCount
    ? `${displayProductCount} article${displayProductCount > 1 ? "s" : ""} publie${displayProductCount > 1 ? "s" : ""} dans ${category.sourcePathLabel}.`
    : category.description;

  return (
    <InternalPageShell pricing={pricing}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#666]">
          <Link href="/" className="transition hover:text-[#ff6a00]">Accueil</Link>
          <span>/</span>
          <Link href="/categories" className="transition hover:text-[#ff6a00]">Categories</Link>
          <span>/</span>
          <span className="font-medium text-[#222]">{category.title}</span>
        </div>

        <section className="rounded-[30px] bg-white px-6 py-6 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 lg:px-8 lg:py-7">
          <div className="max-w-[760px]">
            <div className="inline-flex rounded-full bg-[#fff1e7] px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">
              {displayProductCount} article(s)
            </div>
            <h1 className="mt-4 text-[30px] font-bold tracking-[-0.05em] text-[#222] sm:text-[38px]">{category.title}</h1>
            <p className="mt-4 text-[16px] leading-8 text-[#555]">{displayDescription}</p>
          </div>
        </section>

        <ProductsFeedClient
          initialPage={initialPage}
          locale={pricing.locale}
          currencyCode={pricing.currency.code}
          currencyRateFromUsd={pricing.currency.rateFromUsd}
          endpointPath="/api/products/category"
          endpointParams={{ category: category.slug }}
          emptyState={{
            title: "Aucun article trouve dans cette categorie",
            description: "Les produits de cette categorie ne sont pas disponibles pour le moment.",
          }}
        />
      </div>
    </InternalPageShell>
  );
}
