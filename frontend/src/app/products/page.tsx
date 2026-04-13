import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import type { Metadata } from "next";

import { InternalPageShell } from "@/components/internal-page-shell";
import { getCatalogProducts } from "@/lib/catalog-service";
import { formatTierAwarePrice } from "@/lib/product-price-display";
import { getPricingContext } from "@/lib/pricing";
import { normalizeStorefrontText, shuffleStorefrontItems } from "@/lib/public-storefront";
import { SITE_NAME, SITE_URL } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: `Catalogue | ${SITE_NAME}`,
  description: "Catalogue produit public AfriPay avec variantes, prix et details utiles.",
  alternates: {
    canonical: `${SITE_URL}/products`,
  },
};

export default async function ProductsPage() {
  const [pricing, products] = await Promise.all([
    getPricingContext(),
    getCatalogProducts(),
  ]);
  const randomizedProducts = shuffleStorefrontItems(products);

  return (
    <InternalPageShell pricing={pricing}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#666]">
          <Link href="/" className="transition hover:text-[#ff6a00]">Accueil</Link>
          <span>/</span>
          <span className="font-medium text-[#222]">Produits</span>
        </div>

        <section className="rounded-[30px] bg-white px-6 py-6 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 lg:px-8 lg:py-7">
          <div className="max-w-[760px]">
            <div className="inline-flex rounded-[8px] bg-[#fff1e7] px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">
              Catalogue AfriPay
            </div>
            <h1 className="mt-4 text-[30px] font-bold tracking-[-0.05em] text-[#222] sm:text-[38px]">
              Produits avec variantes et attributs
            </h1>
            <p className="mt-4 text-[16px] leading-8 text-[#555]">
              Retrouvez ici les produits publics actuellement visibles sur le site, avec leurs options utiles pour la consultation et la commande.
            </p>
          </div>
        </section>

        {products.length === 0 ? (
          <section className="rounded-[30px] bg-white px-6 py-8 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 lg:px-8">
            <div className="text-[16px] leading-8 text-[#555]">Aucun produit publie pour le moment depuis l&apos;admin sourcing.</div>
          </section>
        ) : (
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {randomizedProducts.map((product) => (
              <Link
                key={product.slug}
                href={`/products/${product.slug}`}
                className="group overflow-hidden rounded-[8px] border border-[#eceff3] bg-white shadow-[0_10px_26px_rgba(17,24,39,0.06)] transition duration-300 hover:-translate-y-1 hover:border-[#ff8a3d] hover:shadow-[0_18px_40px_rgba(17,24,39,0.13)]"
              >
                <div className="relative aspect-[0.92] overflow-hidden bg-[#f6f7f9]">
                  <Image src={product.image} alt={product.shortTitle} width={640} height={480} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
                  <div className="absolute left-2 top-2 rounded-[6px] bg-[#111827] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-white shadow-[0_8px_18px_rgba(17,24,39,0.18)]">
                    AfriPay+
                  </div>
                  <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-[6px] bg-white/95 px-2 py-1 text-[10px] font-bold text-[#191919] shadow-[0_8px_18px_rgba(17,24,39,0.12)]">
                    <Star className="h-3 w-3 fill-[#f7b500] text-[#f7b500]" />
                    4.8
                  </div>
                </div>
                <div className="p-3 sm:p-3.5">
                  <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#d85300] sm:text-[10px]">Catalogue</div>
                  <div className="mt-2 line-clamp-2 min-h-[36px] text-[12px] font-bold leading-4 tracking-[-0.02em] text-[#1f2937] sm:min-h-[42px] sm:text-[13px] sm:leading-5">{product.shortTitle}</div>
                  <div className="mt-2 line-clamp-1 text-[10px] font-semibold text-[#667085] sm:text-[11px]">{normalizeStorefrontText(product.supplierName)}</div>
                  <div className="mt-2.5 flex items-end justify-between gap-2">
                    <div>
                      <div className="text-[15px] font-black tracking-[-0.04em] text-[#111827] sm:text-[17px]">{formatTierAwarePrice(pricing.formatPrice, product)}</div>
                      <div className="mt-1 line-clamp-1 text-[10px] font-semibold text-[#d85300]">Prix actualise</div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </InternalPageShell>
  );
}
