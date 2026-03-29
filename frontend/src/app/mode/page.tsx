import Image from "next/image";
import Link from "next/link";

import { InternalPageShell } from "@/components/internal-page-shell";
import { getCatalogProducts } from "@/lib/catalog-service";
import { getModePromotionConfig } from "@/lib/mode-promotions-store";
import { getPricingContext } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ModePage() {
  const [pricing, config, catalogProducts] = await Promise.all([
    getPricingContext(),
    getModePromotionConfig(),
    getCatalogProducts(),
  ]);
  const productMap = new Map(catalogProducts.map((product) => [product.slug, product]));
  const fallbackProducts = catalogProducts.slice(0, 18);
  const selectProducts = (slugs: string[], fallbackStart: number, count: number) => {
    const selected = slugs
      .map((slug) => productMap.get(slug) ?? null)
      .filter((product): product is NonNullable<typeof productMap extends Map<string, infer T> ? T : never> => Boolean(product));

    if (selected.length >= count) {
      return selected.slice(0, count);
    }

    const fallback = fallbackProducts
      .slice(fallbackStart, fallbackStart + Math.max(count * 2, count))
      .filter((product) => !selected.some((entry) => entry.slug === product.slug));
    return [...selected, ...fallback].slice(0, count);
  };

  const heroSlides = config.heroSlides.slice(0, 2).map((slide, index) => ({
    ...slide,
    product: (slide.spotlightProductSlug ? productMap.get(slide.spotlightProductSlug) : null) ?? fallbackProducts[index] ?? null,
  })).filter((slide) => Boolean(slide.product));

  const sections = [
    { id: "grouped", title: "Offres groupees", products: selectProducts(config.groupedOfferSlugs, 0, 3) },
    { id: "daily", title: "Deals du jour", products: selectProducts(config.dailyDealSlugs, 3, 3) },
    { id: "premium", title: "Selection premium", products: selectProducts(config.premiumSelectionSlugs, 0, 6) },
    { id: "choice", title: "Choix populaires", products: selectProducts(config.choiceDealSlugs, 6, 4) },
    { id: "trend", title: "Encore plus de promos", products: selectProducts(config.trendPromoSlugs, 10, 4) },
  ].filter((section) => section.products.length > 0);

  return (
    <InternalPageShell pricing={pricing}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#666]">
          <Link href="/" className="transition hover:text-[#ff6a00]">Accueil</Link>
          <span>/</span>
          <span className="font-medium text-[#222]">Mode</span>
        </div>

        <section className="grid gap-4 lg:grid-cols-2">
          {heroSlides.map((slide) => (
            <article key={slide.id} className="relative overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#fff0f6_0%,#fff7ee_100%)] px-6 py-6 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5">
              <div className="absolute right-4 top-4 rounded-full bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#ff6a00]">
                {slide.deadlinePrefix}
              </div>
              <div className="max-w-[58%]">
                <h1 className="text-[30px] font-black tracking-[-0.05em] text-[#222]">{slide.headline}</h1>
                <div className="mt-3 space-y-2 text-[14px] text-[#555]">
                  {slide.coupons.map((coupon) => (
                    <div key={`${slide.id}-${coupon.code}`} className="rounded-[16px] bg-white/80 px-4 py-3 ring-1 ring-black/5">
                      <div className="text-[18px] font-black text-[#111827]">{coupon.value}</div>
                      <div className="text-[13px] text-[#667085]">{coupon.limit} · {coupon.code}</div>
                    </div>
                  ))}
                </div>
              </div>
              {slide.product ? (
                <Link href={`/products/${slide.product.slug}`} className="absolute bottom-0 right-0 top-0 flex w-[40%] items-end justify-center p-4">
                  <div className="relative h-full w-full overflow-hidden rounded-[26px] bg-white/70">
                    <Image src={slide.product.image} alt={slide.product.shortTitle} fill sizes="(min-width: 1024px) 20vw, 40vw" className="object-cover" />
                  </div>
                </Link>
              ) : null}
            </article>
          ))}
        </section>

        {sections.map((section) => (
          <section key={section.id} className="rounded-[30px] bg-white px-6 py-6 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 lg:px-8 lg:py-7">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-[24px] font-bold tracking-[-0.04em] text-[#222]">{section.title}</h2>
              <Link href="/products" className="text-[14px] font-semibold text-[#ff6a00] transition hover:opacity-80">Voir tout</Link>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {section.products.map((product) => (
                <Link
                  key={product.slug}
                  href={`/products/${product.slug}`}
                  className="rounded-[22px] bg-[#fffaf6] p-4 ring-1 ring-black/5 transition hover:-translate-y-0.5"
                >
                  <div className="aspect-[4/3] overflow-hidden rounded-[16px] bg-white">
                    <Image src={product.image} alt={product.shortTitle} width={640} height={480} className="h-full w-full object-cover" />
                  </div>
                  <div className="mt-4 line-clamp-2 text-[17px] font-semibold tracking-[-0.04em] text-[#222]">{product.shortTitle}</div>
                  <div className="mt-2 text-[13px] text-[#667085]">{product.supplierName}</div>
                  <div className="mt-3 text-[18px] font-bold text-[#111827]">{pricing.formatPrice(product.minUsd)}</div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </InternalPageShell>
  );
}
