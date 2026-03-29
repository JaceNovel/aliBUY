import Image from "next/image";
import Link from "next/link";
import { Flame, Sparkles, TrendingUp } from "lucide-react";

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
      }))
    : catalogProducts.slice(0, 12).map((item) => ({
        slug: item.slug,
        title: item.shortTitle,
        image: item.image,
        priceLabel: pricing.formatPrice(item.minUsd),
        badge: item.badge,
      }));
  const spotlightItems = items.slice(0, 3);
  const gridItems = items.slice(0, 18);
  const highlightedCount = items.filter((item) => Boolean(item.badge)).length;

  return (
    <InternalPageShell pricing={pricing}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#666]">
          <Link href="/" className="transition hover:text-[#ff6a00]">Accueil</Link>
          <span>/</span>
          <span className="font-medium text-[#222]">Tendances</span>
        </div>

        <section className="overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#fff5ef_0%,#fff8f1_46%,#fff 100%)] px-5 py-5 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 sm:px-6 lg:px-8 lg:py-7">
          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#fff1e7] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">
                <Flame className="h-4 w-4" />
                Radar tendances
              </div>
              <h1 className="mt-4 text-[30px] font-bold tracking-[-0.05em] text-[#222] sm:text-[38px]">
                Les produits qui bougent le plus en ce moment
              </h1>
              <p className="mt-3 max-w-[760px] text-[14px] leading-7 text-[#555] sm:text-[15px]">
                Une page plus dense, pensée comme un vrai mur de tendances: produits visibles, badge mis en avant, lecture rapide des prix et accès immédiat à la fiche.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[20px] bg-white px-4 py-4 ring-1 ring-black/5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">Produits visibles</div>
                  <div className="mt-2 text-[28px] font-black tracking-[-0.05em] text-[#111827]">{gridItems.length}</div>
                </div>
                <div className="rounded-[20px] bg-white px-4 py-4 ring-1 ring-black/5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">Badges actifs</div>
                  <div className="mt-2 text-[28px] font-black tracking-[-0.05em] text-[#111827]">{highlightedCount}</div>
                </div>
                <div className="rounded-[20px] bg-white px-4 py-4 ring-1 ring-black/5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">Vue compacte</div>
                  <div className="mt-2 text-[28px] font-black tracking-[-0.05em] text-[#111827]">6</div>
                  <div className="text-[12px] text-[#667085]">colonnes desktop</div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-3">
              {spotlightItems.map((item, index) => (
                <Link key={item.slug} href={`/products/${item.slug}`} className="group overflow-hidden rounded-[22px] bg-white p-2.5 ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(17,24,39,0.12)]">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-[16px] bg-[#f5f5f5]">
                    <Image src={item.image} alt={item.title} fill sizes="(min-width: 1280px) 18vw, 30vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#111827] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-white">
                      {index === 0 ? <TrendingUp className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                      {item.badge || "Top vue"}
                    </div>
                  </div>
                  <div className="mt-3 line-clamp-2 text-[13px] font-semibold leading-5 tracking-[-0.03em] text-[#222]">{item.title}</div>
                  <div className="mt-2 text-[16px] font-black tracking-[-0.04em] text-[#111827]">{item.priceLabel}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {items.length === 0 ? (
          <section className="rounded-[30px] bg-white px-6 py-8 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 lg:px-8">
            <div className="text-[16px] leading-8 text-[#555]">Aucune tendance publique n&apos;est disponible pour le moment.</div>
          </section>
        ) : (
          <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {gridItems.map((item) => (
              <Link
                key={item.slug}
                href={`/products/${item.slug}`}
                className="group rounded-[18px] bg-white p-2.5 shadow-[0_12px_30px_rgba(24,39,75,0.06)] ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(24,39,75,0.12)]"
              >
                <div className="relative aspect-square overflow-hidden rounded-[14px] bg-[#f5f5f5]">
                  <Image src={item.image} alt={item.title} width={640} height={480} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                </div>
                <div className="mt-2">
                  {item.badge ? <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#ff6a00] sm:text-[10px]">{item.badge}</div> : null}
                  <div className="mt-1.5 line-clamp-2 min-h-[34px] text-[12px] font-semibold leading-4 tracking-[-0.03em] text-[#222] sm:min-h-[40px] sm:text-[13px] sm:leading-5">{item.title}</div>
                  <div className="mt-2 text-[15px] font-bold tracking-[-0.03em] text-[#111827] sm:text-[16px]">{item.priceLabel}</div>
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </InternalPageShell>
  );
}
