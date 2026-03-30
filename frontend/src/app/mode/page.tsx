import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Bike, Flame, PackageCheck, RefreshCcw, Shirt, Sparkles, Truck, Watch } from "lucide-react";

import { InternalPageShell } from "@/components/internal-page-shell";
import { getCatalogCategories } from "@/lib/catalog-category-service";
import { getCatalogProducts } from "@/lib/catalog-service";
import { getProductImageUrl } from "@/lib/product-image";
import { getPricingContext } from "@/lib/pricing";
import { isModeStorefrontProduct, normalizeStorefrontBadge, normalizeStorefrontText, shuffleStorefrontItems } from "@/lib/public-storefront";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const categoryIcons = [Flame, Shirt, Watch, Bike, PackageCheck, Sparkles, Truck, RefreshCcw];

function formatCompactMetric(product: { soldLabel: string; transactionsLabel: string; responseTime: string }) {
  return normalizeStorefrontText(product.soldLabel || product.transactionsLabel || product.responseTime);
}

export default async function ModePage() {
  const [pricing, catalogProducts, categories] = await Promise.all([
    getPricingContext(),
    getCatalogProducts(),
    getCatalogCategories(),
  ]);
  const curatedModeProducts = catalogProducts.filter((product) => isModeStorefrontProduct(product));
  const spotlightCategory = categories[0] ?? null;
  const randomizedCatalogProducts = shuffleStorefrontItems(curatedModeProducts.length > 0 ? curatedModeProducts : catalogProducts);
  const stripCategories = categories.slice(0, 8);
  const spotlightProducts = shuffleStorefrontItems(curatedModeProducts.length > 0 ? curatedModeProducts : (spotlightCategory?.products ?? randomizedCatalogProducts)).slice(0, 8);
  const denseGridProducts = randomizedCatalogProducts;

  return (
    <InternalPageShell pricing={pricing}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#666]">
          <Link href="/" className="transition hover:text-[#ff6a00]">Accueil</Link>
          <span>/</span>
          <span className="font-medium text-[#222]">Mode</span>
        </div>

        <section className="space-y-4">
          <div className="rounded-[22px] bg-[linear-gradient(90deg,#ff6a00_0%,#ff8447_48%,#ff9f64_100%)] px-5 py-4 text-white sm:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3 text-[30px] font-black tracking-[-0.06em]">
                <span>AfriPay+</span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-[13px] font-semibold sm:gap-6">
                <span className="inline-flex items-center gap-2"><Truck className="h-4 w-4" /> Livraison suivie</span>
                <span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4" /> Nouveautes publiees</span>
                <span className="inline-flex items-center gap-2"><BadgeCheck className="h-4 w-4" /> {curatedModeProducts.length || denseGridProducts.length} refs mode</span>
                <span className="inline-flex items-center gap-2"><RefreshCcw className="h-4 w-4" /> Catalogue mis a jour</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
              {stripCategories.map((category, index) => {
                const Icon = categoryIcons[index % categoryIcons.length] ?? Sparkles;
                return (
                  <Link
                    key={category.slug}
                    href={category.href}
                    className={[
                      "flex min-h-[60px] items-center gap-3 rounded-[4px] border px-3 py-2 transition hover:border-[#ffb187] hover:bg-[#fff7f1]",
                      index === 0 ? "border-[#1f2430] bg-[#1f2430] text-white" : "border-[#efefef] bg-[#fafafa] text-[#222]",
                    ].join(" ")}
                  >
                    <div className={[
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      index === 0 ? "bg-white/14 text-white" : "bg-white text-[#444] ring-1 ring-black/5",
                    ].join(" ")}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="line-clamp-2 text-[11px] font-semibold leading-4 sm:text-[12px]">{category.title}</span>
                  </Link>
                );
              })}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-8">
              {spotlightProducts.map((product, index) => (
                <Link key={product.slug} href={`/products/${product.slug}`} className="group overflow-hidden rounded-[4px] bg-white transition hover:-translate-y-0.5">
                  <div className="flex items-center justify-between bg-[#ff7b36] px-2 py-1 text-[10px] font-bold text-white">
                    <span className="inline-flex items-center gap-1"><BadgeCheck className="h-3 w-3" /> ALL</span>
                    <span>Site</span>
                  </div>
                  <div className="relative aspect-square overflow-hidden bg-[#f5f5f5]">
                    <Image src={getProductImageUrl(product.image, { width: 420, quality: 74 })} alt={product.shortTitle} fill sizes="(min-width: 1280px) 11vw, (min-width: 1024px) 18vw, 30vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                  </div>
                  <div className="px-1.5 pb-1.5 pt-2">
                    <div className="line-clamp-2 min-h-[32px] text-[10px] font-semibold leading-4 text-[#222] sm:text-[11px]">{product.shortTitle}</div>
                    {index % 3 === 0 ? <div className="mt-1 text-[9px] font-semibold text-[#ef4444]">Stock faible</div> : null}
                    <div className="mt-1 line-clamp-1 text-[9px] text-[#6b7280]">{normalizeStorefrontText(product.supplierName)}</div>
                    <div className="mt-1 line-clamp-1 text-[9px] text-[#6b7280]">{formatCompactMetric(product)}</div>
                    <div className="mt-1 text-[12px] font-black tracking-[-0.03em] text-[#111827] sm:text-[13px]">{pricing.formatPrice(product.minUsd)}</div>
                  </div>
                </Link>
              ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ff6a00]">Marketplace mode</div>
              <h1 className="mt-1 text-[26px] font-black tracking-[-0.05em] text-[#111827] sm:text-[32px]">Selection mode compacte</h1>
            </div>
            <Link href="/products" className="text-[13px] font-semibold text-[#ff6a00] transition hover:opacity-80">Voir tout</Link>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-8">
            {denseGridProducts.map((product, index) => (
              <Link
                key={product.slug}
                href={`/products/${product.slug}`}
                className="group overflow-hidden rounded-[4px] bg-white transition hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between bg-[#ff7b36] px-2 py-1 text-[10px] font-bold text-white">
                  <span className="inline-flex items-center gap-1"><BadgeCheck className="h-3 w-3" /> ALL</span>
                  <span>{normalizeStorefrontBadge(product.badge) || "AfriPay+"}</span>
                </div>
                <div className="relative aspect-square overflow-hidden bg-[#f5f5f5]">
                  <Image src={getProductImageUrl(product.image, { width: 420, quality: 74 })} alt={product.shortTitle} fill sizes="(min-width: 1280px) 11vw, (min-width: 1024px) 18vw, 30vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                </div>
                <div className="px-1.5 pb-2 pt-2">
                  <div className="line-clamp-2 min-h-[32px] text-[10px] font-semibold leading-4 text-[#222] sm:text-[11px]">{product.shortTitle}</div>
                  {index % 4 === 1 ? <div className="mt-1 text-[9px] font-semibold text-[#ef4444]">Stock faible</div> : null}
                  <div className="mt-1 line-clamp-1 text-[9px] text-[#6b7280]">{normalizeStorefrontText(product.supplierName)}</div>
                  <div className="mt-1 line-clamp-1 text-[9px] text-[#6b7280]">{formatCompactMetric(product)}</div>
                  <div className="mt-1 text-[12px] font-black tracking-[-0.03em] text-[#111827] sm:text-[13px]">{pricing.formatPrice(product.minUsd)}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </InternalPageShell>
  );
}
