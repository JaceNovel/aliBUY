import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Gift, PackageCheck, RefreshCcw, ShieldCheck, TicketPercent } from "lucide-react";

import { InternalPageShell } from "@/components/internal-page-shell";
import { LiveCountdownBadge } from "@/components/live-countdown-badge";
import { ModePromoHero } from "@/components/mode-promo-hero";
import { getCatalogProducts } from "@/lib/catalog-service";
import { getModePromotionConfig } from "@/lib/mode-promotions-store";
import { getPricingContext } from "@/lib/pricing";

function formatPriceRange(
  formatPrice: (amountUsd: number) => string,
  minUsd: number,
  maxUsd?: number,
) {
  if (typeof maxUsd === "number") {
    return `${formatPrice(minUsd)} - ${formatPrice(maxUsd)}`;
  }

  return formatPrice(minUsd);
}

function resolvePromoProducts<T extends { slug: string }>(products: T[], slugs: string[], fallbackStart: number, limit: number, fallbackPool?: T[]) {
  const sourcePool = fallbackPool && fallbackPool.length > 0 ? fallbackPool : products;
  const fallback = sourcePool.slice(fallbackStart, fallbackStart + limit).length > 0
    ? sourcePool.slice(fallbackStart, fallbackStart + limit)
    : sourcePool.slice(0, limit);

  if (slugs.length === 0) {
    return fallback;
  }

  const productMap = new Map(products.map((product) => [product.slug, product]));
  const selected = slugs
    .map((slug) => productMap.get(slug))
    .filter((product): product is T => Boolean(product));

  return selected.length > 0 ? selected : fallback;
}

function getDiscountPercent(minUsd: number, maxUsd?: number) {
  if (typeof maxUsd !== "number" || maxUsd <= minUsd) {
    return null;
  }

  return Math.round(((maxUsd - minUsd) / maxUsd) * 100);
}

export default async function ModePage() {
  const [pricing, catalogProducts, promoConfig] = await Promise.all([getPricingContext(), getCatalogProducts(), getModePromotionConfig()]);
  const cheapProducts = [...catalogProducts].sort((left, right) => left.minUsd - right.minUsd);
  const groupedOffers = resolvePromoProducts(catalogProducts, promoConfig.groupedOfferSlugs, 0, 3, cheapProducts);
  const dailyDeals = resolvePromoProducts(catalogProducts, promoConfig.dailyDealSlugs, 3, 3, cheapProducts);
  const premiumSelection = resolvePromoProducts(catalogProducts, promoConfig.premiumSelectionSlugs, 0, 6);
  const choiceDeals = resolvePromoProducts(catalogProducts, promoConfig.choiceDealSlugs, 0, 4, cheapProducts);
  const trendPromos = resolvePromoProducts(catalogProducts, promoConfig.trendPromoSlugs, 4, 4, cheapProducts);
  const flashRushProducts = resolvePromoProducts(catalogProducts, promoConfig.flashRushSlugs, 0, 6, cheapProducts);
  const finalDropProducts = resolvePromoProducts(catalogProducts, promoConfig.finalDropSlugs, 6, 6, cheapProducts);
  const productMap = new Map(catalogProducts.map((product) => [product.slug, product]));
  const heroSpotlight = dailyDeals[0] ?? groupedOffers[0];
  const heroSlides = promoConfig.heroSlides.map((slide, index) => {
    const spotlightProduct = productMap.get(slide.spotlightProductSlug) ?? (index === 0 ? heroSpotlight : premiumSelection[index] ?? heroSpotlight);

    return {
      id: slide.id,
      deadlinePrefix: slide.deadlinePrefix,
      endsAt: slide.endsAt,
      headline: slide.headline,
      spotlightTitle: spotlightProduct?.shortTitle ?? "Sélection du moment",
      spotlightPrice: spotlightProduct ? formatPriceRange(pricing.formatPrice, spotlightProduct.minUsd, spotlightProduct.maxUsd) : "",
      spotlightHref: spotlightProduct ? `/products/${spotlightProduct.slug}` : "/products",
      spotlightImage: spotlightProduct?.image ?? "/products/fashion-hoodie.svg",
      accentColor: slide.accentColor,
      coupons: slide.coupons,
    };
  });
  const groupedOfferLeadPrice = groupedOffers.length > 0
    ? pricing.formatPrice(Math.min(...groupedOffers.map((product) => product.minUsd)))
    : pricing.formatPrice(0);

  if (catalogProducts.length === 0) {
    return (
      <InternalPageShell pricing={pricing}>
        <div className="space-y-6">
          <ModePromoHero slides={heroSlides} />
          <section className="rounded-[28px] bg-white px-6 py-8 text-center shadow-[0_18px_40px_rgba(17,24,39,0.06)] ring-1 ring-black/5 sm:px-8 sm:py-10">
            <h1 className="text-[30px] font-black tracking-[-0.05em] text-[#222]">Mode vide pour l&apos;instant</h1>
            <p className="mx-auto mt-3 max-w-[760px] text-[15px] leading-7 text-[#666]">
              Cette page affichera les produits mode publiés et les promotions réellement actives sur le site.
            </p>
          </section>
        </div>
      </InternalPageShell>
    );
  }

  return (
    <InternalPageShell pricing={pricing}>
      <div className="space-y-5 sm:space-y-8">
        <ModePromoHero slides={heroSlides} />

        <section className="relative left-1/2 right-1/2 -mx-[50vw] grid w-screen gap-px overflow-hidden bg-[#efe5df] md:grid-cols-3">
          {[
            { icon: PackageCheck, title: "Livraison gratuite", description: "Sur tous les articles Choice" },
            { icon: ShieldCheck, title: "Livraison rapide", description: "Remboursement en cas de problème de livraison" },
            { icon: RefreshCcw, title: "Retour gratuit", description: "Pour des millions d'articles" },
          ].map((feature) => {
            const Icon = feature.icon;

            return (
              <div key={feature.title} className="flex items-center gap-3 bg-white px-4 py-3 text-[#5b2b14] sm:px-6 sm:py-4 lg:px-10">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff1e6] text-[#9f4d18] sm:h-9 sm:w-9">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="text-[13px] sm:text-[16px]">
                  <span className="font-bold">{feature.title}</span>
                  <span className="text-[#7c5b49]"> {feature.description}</span>
                </div>
              </div>
            );
          })}
        </section>

        <section className="space-y-4 sm:space-y-6">
          <h2 className="text-center text-[28px] font-black tracking-[-0.06em] text-[#222] sm:text-[40px]">Offres du jour</h2>

          <div className="grid gap-4 xl:grid-cols-2 sm:gap-6">
            <article className="overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,#fff7ef_0%,#fff2e6_100%)] px-3 py-4 shadow-[0_16px_34px_rgba(235,127,42,0.10)] ring-1 ring-[#f3dfcf] sm:rounded-[30px] sm:bg-white sm:px-8 sm:py-7 sm:shadow-[0_16px_36px_rgba(17,24,39,0.05)] sm:ring-0">
              <div className="text-center sm:text-left">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#d46a11] sm:hidden">Bundle picks</div>
                <h3 className="mt-1 text-[20px] font-black tracking-[-0.05em] text-[#222] sm:mt-0 sm:text-[28px]">Offres groupées</h3>
                <p className="mt-1 text-[11px] text-[#8b5d3e] sm:hidden">Comparez vite vos meilleures offres.</p>
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#fff1cc] px-4 py-2 text-[12px] font-bold text-[#111] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] sm:mt-5 sm:gap-3 sm:px-6 sm:py-3 sm:text-[17px]">
                  <TicketPercent className="h-4 w-4 text-[#ff8b00] sm:h-6 sm:w-6" />
                  3+ dès {groupedOfferLeadPrice}
                  <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
              </div>

              <div className="-mx-3 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:mt-8 sm:grid sm:overflow-visible sm:px-0 sm:pb-0 sm:[scrollbar-width:auto] sm:[&::-webkit-scrollbar]:block sm:gap-6 sm:grid-cols-3">
                {groupedOffers.map((product) => (
                  <Link key={product.slug} href={`/products/${product.slug}`} className="group block min-w-[154px] snap-start rounded-[20px] bg-white p-2.5 shadow-[0_14px_28px_rgba(17,24,39,0.08)] ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-[0_18px_32px_rgba(17,24,39,0.12)] sm:min-w-0 sm:rounded-none sm:bg-transparent sm:p-0 sm:shadow-none sm:ring-0">
                    <div className="mb-2 inline-flex items-center rounded-full bg-[#fff5eb] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#d46a11] sm:hidden">
                      Pack avantage
                    </div>
                    <div className="relative aspect-[0.86] overflow-hidden rounded-[14px] bg-[#f6f6f6] sm:rounded-[18px]">
                      <Image src={product.image} alt={product.title} fill sizes="(min-width: 1280px) 18vw, 28vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                      <div className="absolute left-2 top-2 rounded-full bg-white/92 px-2 py-1 text-[9px] font-bold text-[#d46a11] shadow-[0_8px_18px_rgba(0,0,0,0.08)] sm:hidden">
                        x3 bundle
                      </div>
                    </div>
                    <div className="mt-2 line-clamp-2 min-h-[34px] text-[12px] font-semibold leading-4 tracking-[-0.03em] text-[#111] sm:mt-4 sm:min-h-0 sm:text-[18px] sm:leading-8">{product.title}</div>
                    <div className="mt-2 flex items-end gap-2 sm:mt-3">
                      <span className="text-[14px] font-black text-[#ff143c] sm:text-[19px]">{pricing.formatPrice(product.minUsd)}</span>
                      {typeof product.maxUsd === "number" && product.maxUsd > product.minUsd ? <span className="text-[11px] text-[#8c8c8c] line-through sm:text-[16px]">{pricing.formatPrice(product.maxUsd)}</span> : null}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[#222] sm:mt-2 sm:text-[16px]">
                      <span className="text-[#ffad14]">★</span>
                      <span className="font-semibold">{product.transactionsLabel}</span>
                      <span className="text-[#555]">{product.soldLabel}</span>
                    </div>
                    <div className="mt-2 inline-flex items-center rounded-full bg-[#111] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white sm:hidden">
                      Livraison groupée
                    </div>
                  </Link>
                ))}
              </div>
            </article>

            <article className="overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,#fff3f5_0%,#ffe9ee_100%)] px-3 py-4 shadow-[0_16px_34px_rgba(255,20,60,0.10)] ring-1 ring-[#f5dbe2] sm:rounded-[30px] sm:bg-white sm:px-8 sm:py-7 sm:shadow-[0_16px_36px_rgba(17,24,39,0.05)] sm:ring-0">
              <div className="text-center sm:text-left">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#ff3b59] sm:hidden">Daily drop</div>
                <h3 className="mt-1 text-[20px] font-black tracking-[-0.05em] text-[#222] sm:mt-0 sm:text-[28px]">Deal du Jour</h3>
                <p className="mt-1 text-[11px] text-[#8d5160] sm:hidden">Offres flash adaptées au mobile.</p>
                <div className="mt-3 flex items-center justify-center gap-2 sm:mt-5 sm:justify-start sm:gap-3">
                  <LiveCountdownBadge
                    endsAt="2026-03-23T16:38:05Z"
                    prefix="Finit dans :"
                    className="inline-flex items-center gap-2 rounded-full bg-[#ffe7ea] px-4 py-2 text-[12px] font-bold text-[#111] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:gap-3 sm:px-6 sm:py-3 sm:text-[17px]"
                    iconClassName="h-4 w-4 text-[#ff4d5d] sm:h-6 sm:w-6"
                  />
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ffe7ea] text-[#111] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:h-12 sm:w-12">
                    <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                </div>
              </div>

              <div className="-mx-3 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:mt-8 sm:grid sm:overflow-visible sm:px-0 sm:pb-0 sm:[scrollbar-width:auto] sm:[&::-webkit-scrollbar]:block sm:gap-6 sm:grid-cols-3">
                {dailyDeals.map((product) => {
                  const discountPercent = getDiscountPercent(product.minUsd, product.maxUsd);

                  return (
                  <Link key={product.slug} href={`/products/${product.slug}`} className="group block min-w-[154px] snap-start rounded-[20px] bg-white p-2.5 shadow-[0_14px_28px_rgba(17,24,39,0.08)] ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-[0_18px_32px_rgba(17,24,39,0.12)] sm:min-w-0 sm:rounded-none sm:bg-transparent sm:p-0 sm:shadow-none sm:ring-0">
                    <div className="mb-2 flex items-center justify-between sm:hidden">
                      <div className="inline-flex items-center rounded-full bg-[#ffe7ea] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#ff3b59]">
                        Flash deal
                      </div>
                      {discountPercent ? <div className="rounded-full bg-[#111] px-2 py-1 text-[9px] font-bold text-white">-{discountPercent}%</div> : null}
                    </div>
                    <div className="relative aspect-[0.86] overflow-hidden rounded-[14px] bg-[#f6f6f6] sm:rounded-[18px]">
                      <Image src={product.image} alt={product.title} fill sizes="(min-width: 1280px) 18vw, 28vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                      {discountPercent ? <div className="absolute left-2 top-2 hidden rounded-full bg-[#ff143c] px-2 py-1 text-[10px] font-bold text-white sm:block">-{discountPercent}%</div> : null}
                    </div>
                    <div className="mt-2 line-clamp-2 min-h-[34px] text-[12px] font-semibold leading-4 tracking-[-0.03em] text-[#111] sm:mt-4 sm:min-h-0 sm:text-[18px] sm:leading-8">{product.title}</div>
                    <div className="mt-2 flex items-end gap-2 sm:mt-3">
                      <span className="text-[14px] font-black text-[#111] sm:text-[19px]">{pricing.formatPrice(product.minUsd)}</span>
                      {typeof product.maxUsd === "number" && product.maxUsd > product.minUsd ? <span className="text-[11px] text-[#8c8c8c] line-through sm:text-[16px]">{pricing.formatPrice(product.maxUsd)}</span> : null}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-[#555] sm:hidden">
                      <span className="text-[#ffad14]">★</span>
                      <span className="font-semibold text-[#222]">{product.soldLabel}</span>
                      <span>{product.responseTime}</span>
                    </div>
                    {discountPercent ? <div className="mt-2 hidden inline-flex items-center justify-center bg-[#ff143c] px-2 py-1 text-[11px] font-bold text-white sm:mt-3 sm:inline-flex sm:text-[14px]">-{discountPercent}%</div> : null}
                  </Link>
                  );
                })}
              </div>
            </article>
          </div>
        </section>

        <section className="bg-transparent px-0 py-0 shadow-none ring-0 sm:rounded-[30px] sm:bg-[linear-gradient(180deg,#fff_0%,#fff8fb_100%)] sm:px-8 sm:py-7 sm:shadow-[0_16px_36px_rgba(17,24,39,0.05)] sm:ring-1 sm:ring-black/5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#fff1e7] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#d85300] sm:px-4 sm:py-2 sm:text-[13px] sm:tracking-[0.16em]">
                <Gift className="h-4 w-4" />
                Sélection premium
              </div>
              <h2 className="mt-3 text-[24px] font-black tracking-[-0.05em] text-[#222] sm:mt-4 sm:text-[34px]">Les best-sellers à pousser aujourd&apos;hui</h2>
              <p className="mt-2 max-w-[760px] text-[13px] leading-5 text-[#555] sm:text-[16px] sm:leading-8">Une sélection premium avec prix, badges et lecture rapide.</p>
            </div>
            <Link href="/products" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-[#222] px-5 shadow-[0_16px_30px_rgba(17,24,39,0.18)] transition hover:-translate-y-0.5 hover:bg-black hover:shadow-[0_20px_36px_rgba(17,24,39,0.24)] sm:h-14 sm:min-w-[320px] sm:w-auto sm:gap-3 sm:px-8">
              <span className="text-[13px] font-extrabold tracking-[-0.02em] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)] sm:text-[16px]">
                Voir le catalogue
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-white sm:h-5 sm:w-5" />
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:mt-8 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {premiumSelection.map((product) => (
              <Link key={product.slug} href={`/products/${product.slug}`} className="group overflow-hidden rounded-[20px] bg-white ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(17,24,39,0.12)]">
                <div className="relative aspect-[0.96] bg-[#f4f4f4]">
                  {product.badge ? <div className="absolute left-2 top-2 z-10 rounded-full bg-[#ff143c] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-white">{product.badge}</div> : null}
                  <Image src={product.image} alt={product.title} fill sizes="(min-width: 1280px) 15vw, 30vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                </div>
                <div className="p-2.5 sm:p-3">
                  <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#ff5d00] sm:text-[10px] sm:tracking-[0.14em]">Mode premium</div>
                  <div className="mt-1.5 line-clamp-2 min-h-[34px] text-[12px] font-semibold leading-4 text-[#222] sm:mt-2 sm:min-h-[40px] sm:text-[13px] sm:leading-5">{product.title}</div>
                  <div className="mt-2 text-[14px] font-black tracking-[-0.03em] text-[#111] sm:text-[16px]">{formatPriceRange(pricing.formatPrice, product.minUsd, product.maxUsd)}</div>
                  <div className="mt-1 text-[10px] text-[#666] sm:text-[12px]">MOQ: {product.moq} {product.unit}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr] sm:gap-6">
          <article className="border border-[#ece6e1] bg-transparent px-0 py-0 shadow-none ring-0 sm:rounded-[30px] sm:bg-white sm:px-8 sm:py-7 sm:shadow-[0_16px_36px_rgba(17,24,39,0.05)] sm:ring-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#ff5d00] sm:text-[13px] sm:tracking-[0.16em]">Choice à petits prix</div>
                <h2 className="mt-2 text-[22px] font-black tracking-[-0.05em] text-[#222] sm:mt-3 sm:text-[32px]">Des mini deals Promo</h2>
              </div>
              <div className="rounded-full bg-[#fff1cc] px-4 py-2 text-[12px] font-bold text-[#222] sm:px-5 sm:text-[15px]">Expédition prioritaire</div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:mt-8 sm:gap-4 xl:grid-cols-4">
              {choiceDeals.map((product) => {
                const discountPercent = getDiscountPercent(product.minUsd, product.maxUsd);

                return (
                  <Link key={product.slug} href={`/products/${product.slug}`} className="group overflow-hidden rounded-[16px] border border-[#ece6e1] bg-[#fffdfc] p-2.5 transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(17,24,39,0.1)] sm:rounded-[22px] sm:p-3">
                    <div className="relative aspect-square overflow-hidden rounded-[18px] bg-[#f6f6f6]">
                      <Image src={product.image} alt={product.title} fill sizes="(min-width: 1280px) 18vw, 40vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                      {discountPercent ? <div className="absolute left-2 top-2 rounded-full bg-[#ff143c] px-2 py-1 text-[10px] font-bold text-white">-{discountPercent}%</div> : null}
                    </div>
                    <div className="mt-2 line-clamp-2 text-[12px] font-semibold leading-4 text-[#222] sm:mt-3 sm:text-[15px] sm:leading-6">{product.title}</div>
                    <div className="mt-2 text-[14px] font-black text-[#ff143c] sm:text-[18px]">{pricing.formatPrice(product.minUsd)}</div>
                    <div className="mt-1 text-[10px] text-[#666] sm:text-[13px]">{product.shippingLabel}</div>
                  </Link>
                );
              })}
            </div>
          </article>

          <article className="rounded-[22px] bg-[linear-gradient(180deg,#ff0a68_0%,#ff4d8d_100%)] px-4 py-5 text-white shadow-[0_20px_44px_rgba(255,10,104,0.22)] sm:rounded-[30px] sm:px-8 sm:py-7">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/80 sm:text-[13px] sm:tracking-[0.16em]">Boost shopping</div>
            <h2 className="mt-2 text-[24px] font-black tracking-[-0.06em] sm:mt-3 sm:text-[36px]">Coupons, badges et sélections flash</h2>
            <p className="mt-2 text-[13px] leading-5 text-white/88 sm:mt-3 sm:text-[16px] sm:leading-8">Des promos courtes, lisibles et faciles à repérer.</p>

            <div className="mt-5 space-y-3 sm:mt-8 sm:space-y-4">
              {promoConfig.featureCoupons.map((entry) => (
                <div key={entry.label} className="flex items-center justify-between rounded-[18px] bg-white/12 px-4 py-3 ring-1 ring-white/20 backdrop-blur-sm sm:rounded-[22px] sm:px-5 sm:py-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/72 sm:text-[14px] sm:tracking-[0.12em]">{entry.label}</div>
                    <div className="mt-1 text-[12px] text-white/88 sm:text-[15px]">{entry.detail}</div>
                  </div>
                  <div className="text-[22px] font-black tracking-[-0.04em] sm:text-[30px]">{entry.value}</div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="border border-[#ece6e1] bg-transparent px-0 py-0 shadow-none ring-0 sm:rounded-[30px] sm:bg-white sm:px-8 sm:py-7 sm:shadow-[0_16px_36px_rgba(17,24,39,0.05)] sm:ring-0">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#ff5d00] sm:text-[13px] sm:tracking-[0.16em]">Inspiration du moment</div>
              <h2 className="mt-2 text-[24px] font-black tracking-[-0.05em] text-[#222] sm:mt-3 sm:text-[34px]">Encore plus de promos</h2>
            </div>
            <Link href="/products?q=promo" className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#e5d8cf] px-4 text-[13px] font-bold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00] sm:h-12 sm:px-6 sm:text-[15px]">
              Voir les promos
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:mt-8 sm:gap-4 lg:grid-cols-4">
            {trendPromos.map((product, index) => (
              <Link key={product.slug} href={`/products/${product.slug}`} className={["group rounded-[18px] p-3 text-white shadow-[0_16px_34px_rgba(17,24,39,0.08)] transition hover:-translate-y-1 sm:rounded-[24px] sm:p-4", index % 2 === 0 ? "bg-[linear-gradient(180deg,#ff3f7f_0%,#ff1762_100%)]" : "bg-[linear-gradient(180deg,#ffae2b_0%,#ff7d14_100%)]"].join(" ")}>
                <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/76 sm:text-[12px] sm:tracking-[0.14em]">Flash pick</div>
                <div className="mt-3 flex items-start justify-between gap-3 sm:mt-4 sm:gap-4">
                  <div className="max-w-[150px]">
                    <div className="line-clamp-3 text-[13px] font-black leading-4 tracking-[-0.04em] sm:text-[22px] sm:leading-7">{product.shortTitle}</div>
                    <div className="mt-2 text-[10px] text-white/88 sm:mt-4 sm:text-[15px]">À partir de {pricing.formatPrice(product.minUsd)}</div>
                  </div>
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[14px] bg-white/20 sm:h-24 sm:w-24 sm:rounded-[18px]">
                    <Image src={product.image} alt={product.title} fill sizes="96px" className="object-cover" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.78fr_1.22fr] sm:gap-6">
          <article className="overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,#ff0a68_0%,#ff4f93_100%)] px-4 py-5 text-white shadow-[0_24px_44px_rgba(255,10,104,0.22)] sm:rounded-[30px] sm:px-8 sm:py-7">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/78 sm:text-[13px] sm:tracking-[0.16em]">Rush coupons</div>
            <h2 className="mt-2 text-[24px] font-black tracking-[-0.06em] sm:mt-3 sm:text-[36px]">Promo AfriPay</h2>
            <p className="mt-2 max-w-[420px] text-[13px] leading-5 text-white/88 sm:mt-3 sm:text-[16px] sm:leading-8">Coupons, flash deals et petits prix à activer vite.</p>

            <div className="mt-5 space-y-3 sm:mt-8 sm:space-y-4">
              {promoConfig.rushCoupons.map((coupon) => (
                <div key={coupon.label} className="flex items-center justify-between rounded-[18px] bg-white/12 px-4 py-3 ring-1 ring-white/20 backdrop-blur-sm sm:rounded-[22px] sm:px-5 sm:py-4">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/72 sm:text-[13px] sm:tracking-[0.12em]">{coupon.label}</div>
                    <div className="mt-1 text-[12px] text-white/88 sm:text-[15px]">{coupon.detail}</div>
                  </div>
                  <div className="text-[22px] font-black tracking-[-0.04em] sm:text-[30px]">{coupon.value}</div>
                </div>
              ))}
            </div>

            <Link href="/deals-flash" className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 self-start rounded-full bg-[#ff9f1a] px-5 text-[13px] font-extrabold text-white shadow-[0_16px_30px_rgba(255,159,26,0.34)] transition hover:-translate-y-0.5 hover:bg-[#ff8c00] hover:shadow-[0_20px_36px_rgba(255,140,0,0.38)] sm:mt-8 sm:h-14 sm:min-w-[280px] sm:w-auto sm:gap-3 sm:px-8 sm:text-[15px]">
              Explorer les deals flash
              <ChevronRight className="h-4 w-4 text-white" />
            </Link>
          </article>

          <article className="border border-[#ece6e1] bg-transparent px-0 py-0 shadow-none ring-0 sm:rounded-[30px] sm:bg-white sm:px-8 sm:py-7 sm:shadow-[0_16px_36px_rgba(17,24,39,0.05)] sm:ring-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#ff5d00] sm:text-[13px] sm:tracking-[0.16em]">Vente éclair 24h</div>
                <h2 className="mt-2 text-[22px] font-black tracking-[-0.05em] text-[#222] sm:mt-3 sm:text-[32px]">Mosaïque promo</h2>
              </div>
              <div className="rounded-full bg-[#fff1cc] px-4 py-2 text-[12px] font-bold text-[#222] sm:px-5 sm:text-[15px]">Best deals mis à jour</div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:mt-8 sm:gap-4 xl:grid-cols-3">
              {flashRushProducts.map((product) => {
                const discountPercent = getDiscountPercent(product.minUsd, product.maxUsd);

                return (
                  <Link key={product.slug} href={`/products/${product.slug}`} className="group overflow-hidden rounded-[16px] border border-[#eee5dd] bg-[#fffdfb] p-2.5 transition hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(17,24,39,0.1)] sm:rounded-[22px] sm:p-3">
                    <div className="relative aspect-[1.05] overflow-hidden rounded-[18px] bg-[#f5f5f5]">
                      {discountPercent ? <div className="absolute left-2 top-2 z-10 rounded-full bg-[#ff143c] px-2 py-1 text-[10px] font-bold text-white">-{discountPercent}%</div> : null}
                      <Image src={product.image} alt={product.title} fill sizes="(min-width: 1280px) 18vw, 40vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    </div>
                    <div className="mt-2 line-clamp-2 text-[12px] font-semibold leading-4 text-[#222] sm:mt-3 sm:text-[15px] sm:leading-6">{product.title}</div>
                    <div className="mt-2 flex items-end gap-2">
                      <span className="text-[14px] font-black text-[#ff143c] sm:text-[18px]">{pricing.formatPrice(product.minUsd)}</span>
                      {typeof product.maxUsd === "number" && product.maxUsd > product.minUsd ? <span className="text-[10px] text-[#8c8c8c] line-through sm:text-[13px]">{pricing.formatPrice(product.maxUsd)}</span> : null}
                    </div>
                    <div className="mt-1 text-[10px] text-[#666] sm:text-[13px]">{product.soldLabel}</div>
                  </Link>
                );
              })}
            </div>
          </article>
        </section>

        <section className="border border-[#ece6e1] bg-transparent px-0 py-0 shadow-none ring-0 sm:rounded-[30px] sm:bg-[linear-gradient(180deg,#fff_0%,#fff7f2_100%)] sm:px-8 sm:py-7 sm:shadow-[0_16px_36px_rgba(17,24,39,0.05)] sm:ring-0">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#ff5d00] sm:text-[13px] sm:tracking-[0.16em]">Dernier drop promo</div>
              <h2 className="mt-2 text-[24px] font-black tracking-[-0.05em] text-[#222] sm:mt-3 sm:text-[34px]">Dernières cartes promo</h2>
            </div>
            <Link href="/products?q=deal" className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#e5d8cf] px-4 text-[13px] font-bold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00] sm:h-12 sm:px-6 sm:text-[15px]">
              Voir tous les deals
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:mt-8 sm:gap-3 md:grid-cols-3 xl:grid-cols-6">
            {finalDropProducts.map((product) => (
              <Link key={product.slug} href={`/products/${product.slug}`} className="group overflow-hidden rounded-[20px] bg-white ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(17,24,39,0.1)]">
                <div className="relative aspect-[0.94] bg-[#f4f4f4]">
                  <div className="absolute left-2 top-2 z-10 rounded-full bg-[#111] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-white">{product.responseTime}</div>
                  <Image src={product.image} alt={product.title} fill sizes="(min-width: 1280px) 15vw, 30vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                </div>
                <div className="p-2.5 sm:p-3">
                  <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#ff5d00] sm:text-[10px] sm:tracking-[0.14em]">{product.shippingLabel}</div>
                  <div className="mt-1.5 line-clamp-2 min-h-[34px] text-[12px] font-semibold leading-4 text-[#222] sm:mt-2 sm:min-h-[40px] sm:text-[13px] sm:leading-5">{product.title}</div>
                  <div className="mt-2 text-[14px] font-black text-[#111] sm:text-[16px]">{formatPriceRange(pricing.formatPrice, product.minUsd, product.maxUsd)}</div>
                  <div className="mt-1 text-[10px] text-[#666] sm:text-[12px]">Promo courte • MOQ {product.moq}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </InternalPageShell>
  );
}
