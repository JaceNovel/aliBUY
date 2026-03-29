import Image from "next/image";
import Link from "next/link";

import { InternalPageShell } from "@/components/internal-page-shell";
import { getCatalogProducts } from "@/lib/catalog-service";
import { getFeaturedProductsFeed } from "@/lib/products-feed";
import { getPricingContext } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TrendsPage() {
  const [pricing, featuredFeed, catalogProducts] = await Promise.all([
    getPricingContext(),
    getFeaturedProductsFeed({ limit: 12, mode: "trending" }),
    getCatalogProducts(),
  ]);
  const items = featuredFeed.items.length > 0
    ? featuredFeed.items.map((item) => ({
        slug: item.slug,
        title: item.title,
        image: item.image,
        priceLabel: pricing.formatPrice(item.minUsd),
        badge: item.badge,
        moqLabel: `MOQ ${item.moq} ${item.unit}`,
      }))
    : catalogProducts.slice(0, 12).map((item) => ({
        slug: item.slug,
        title: item.shortTitle,
        image: item.image,
        priceLabel: pricing.formatPrice(item.minUsd),
        badge: item.badge,
        moqLabel: `MOQ ${item.moq} ${item.unit}`,
      }));

  return (
    <InternalPageShell pricing={pricing}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#666]">
          <Link href="/" className="transition hover:text-[#ff6a00]">Accueil</Link>
          <span>/</span>
          <span className="font-medium text-[#222]">Tendances</span>
        </div>

        <section className="rounded-[30px] bg-white px-6 py-6 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 lg:px-8 lg:py-7">
          <div className="max-w-[780px]">
            <div className="inline-flex rounded-full bg-[#fff1e7] px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">
              Selection du moment
            </div>
            <h1 className="mt-4 text-[30px] font-bold tracking-[-0.05em] text-[#222] sm:text-[38px]">
              Tendances actuellement mises en avant
            </h1>
            <p className="mt-4 text-[16px] leading-8 text-[#555]">
              Cette page regroupe les produits les plus visibles du moment, avec une lecture simple des prix d&apos;appel et des quantites minimales.
            </p>
          </div>
        </section>

        {items.length === 0 ? (
          <section className="rounded-[30px] bg-white px-6 py-8 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 lg:px-8">
            <div className="text-[16px] leading-8 text-[#555]">Aucune tendance publique n&apos;est disponible pour le moment.</div>
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => (
              <Link
                key={item.slug}
                href={`/products/${item.slug}`}
                className="rounded-[24px] bg-white p-4 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 transition hover:-translate-y-0.5"
              >
                <div className="aspect-[4/3] overflow-hidden rounded-[18px] bg-[#f5f5f5]">
                  <Image src={item.image} alt={item.title} width={640} height={480} className="h-full w-full object-cover" />
                </div>
                <div className="mt-4">
                  {item.badge ? <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ff6a00]">{item.badge}</div> : null}
                  <div className="mt-2 line-clamp-2 text-[18px] font-semibold tracking-[-0.04em] text-[#222]">{item.title}</div>
                  <div className="mt-2 text-[13px] text-[#667085]">{item.moqLabel}</div>
                  <div className="mt-3 text-[18px] font-bold text-[#111827]">{item.priceLabel}</div>
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </InternalPageShell>
  );
}
