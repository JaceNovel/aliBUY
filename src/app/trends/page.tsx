import Image from "next/image";
import Link from "next/link";
import { Flame, PackageCheck, Sparkles } from "lucide-react";

import { InternalPageShell } from "@/components/internal-page-shell";
import { products } from "@/lib/products-data";
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

const trendingPromoSlugs = products.filter((product) => product.badge === "Promo").map((product) => product.slug);
const trendingStockSlugs = products.filter((product) => product.badge === "En stock" || product.badge === "Livraison rapide").map((product) => product.slug);
const trendProducts = products
  .filter((product) => product.badge === "En stock" || product.badge === "Promo" || product.badge === "Livraison rapide" || product.badge === "Offre mise en avant")
  .concat(products.filter((product) => !(product.badge === "En stock" || product.badge === "Promo" || product.badge === "Livraison rapide" || product.badge === "Offre mise en avant")));

export default async function TrendsPage() {
  const pricing = await getPricingContext();
  const promoProducts = products.filter((product) => trendingPromoSlugs.includes(product.slug));
  const stockProducts = products.filter((product) => trendingStockSlugs.includes(product.slug));

  return (
    <InternalPageShell pricing={pricing}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#666]">
          <Link href="/" className="transition hover:text-[#ff6a00]">Accueil</Link>
          <span>/</span>
          <span className="font-medium text-[#222]">Tendances</span>
        </div>

        <section className="bg-transparent px-0 py-0 shadow-none ring-0 sm:rounded-[28px] sm:bg-white sm:px-5 sm:py-5 sm:shadow-[0_12px_34px_rgba(24,39,75,0.06)] sm:ring-1 sm:ring-black/5 lg:px-6 lg:py-6">
          <div className="flex flex-col gap-4 border-b border-[#efefef] pb-4 sm:gap-5 sm:pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#fff3ea] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#d85300] sm:text-[12px] sm:tracking-[0.14em]">
                <Sparkles className="h-4 w-4" />
                Tendances du moment
              </div>
              <h1 className="mt-3 text-[24px] font-bold tracking-[-0.04em] text-[#222] sm:text-[36px]">Articles en stock et en promotion</h1>
              <p className="mt-2 max-w-[860px] text-[13px] leading-5 text-[#666] sm:text-[14px] sm:leading-7">
                Une grille marchande dense, inspiree des pages tendances B2B, avec produits a rotation rapide, promos visibles et references disponibles immediatement.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-[12px] font-semibold sm:gap-3 sm:text-[13px]">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#fff4eb] px-3 py-2 text-[#d85300] sm:px-4">
                <Flame className="h-4 w-4" />
                {promoProducts.length} en promotion
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#edf8f1] px-3 py-2 text-[#127a46] sm:px-4">
                <PackageCheck className="h-4 w-4" />
                {stockProducts.length} en stock
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-5 sm:gap-3 lg:grid-cols-4 xl:grid-cols-6">
            {trendProducts.map((product) => {
              const isPromo = product.badge === "Promo" || product.badge === "Offre mise en avant";
              const isStock = product.badge === "En stock" || product.badge === "Livraison rapide";

              return (
                <Link
                  key={product.slug}
                  href={`/products/${product.slug}`}
                  className="group overflow-hidden rounded-[14px] bg-white ring-1 ring-[#ececec] transition hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(17,24,39,0.12)] sm:rounded-[16px]"
                >
                  <div className="relative aspect-square overflow-hidden bg-[#f7f7f7]">
                    <Image
                      src={product.image}
                      alt={product.title}
                      fill
                      sizes="(min-width: 1280px) 13vw, (min-width: 1024px) 16vw, (min-width: 768px) 24vw, 46vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                    <div className="absolute bottom-2 left-2 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#444] shadow-[0_8px_18px_rgba(0,0,0,0.14)] ring-1 ring-black/5 sm:bottom-3 sm:left-3 sm:h-10 sm:w-10">
                      <Sparkles className="h-4 w-4" />
                    </div>
                  </div>

                  <div className="px-2.5 pb-2.5 pt-2 sm:px-3 sm:pb-3 sm:pt-2.5">
                    <div className="flex min-h-[18px] items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.06em] sm:min-h-[20px] sm:text-[10px] sm:tracking-[0.08em]">
                      {product.badge ? (
                        <span className={[
                          "rounded-full px-2 py-0.5",
                          isPromo ? "bg-[#fff0ef] text-[#ff5a36]" : isStock ? "bg-[#eef9f1] text-[#15803d]" : "bg-[#f6f0ff] text-[#7c3aed]",
                        ].join(" ")}>
                          {product.badge}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-1.5 line-clamp-2 min-h-[34px] text-[11px] font-medium leading-4 text-[#333] sm:mt-2 sm:min-h-[52px] sm:text-[14px] sm:leading-6">
                      {product.title}
                    </div>

                    {isStock ? (
                      <div className="mt-1 text-[10px] font-semibold text-[#1f8f45] sm:text-[12px]">Expédition en 5 jours</div>
                    ) : isPromo ? (
                      <div className="mt-1 text-[10px] font-semibold text-[#ff5a36] sm:text-[12px]">Prix les plus bas</div>
                    ) : (
                      <div className="mt-1 text-[10px] text-transparent sm:text-[12px]">.</div>
                    )}

                    <div className="mt-2 text-[13px] font-bold tracking-[-0.03em] text-[#111] sm:text-[18px]">
                      {formatPriceRange(pricing.formatPrice, product.minUsd, product.maxUsd)}
                    </div>
                    <div className="mt-1 text-[9px] text-[#444] sm:text-[12px]">MOQ: {product.moq} {product.unit}</div>
                    <div className="mt-1 text-[9px] text-[#8a8a8a] sm:text-[12px]">{product.yearsInBusiness} ans · CN</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </InternalPageShell>
  );
}