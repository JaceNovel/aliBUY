import Link from "next/link";
import type { Metadata } from "next";

import { InternalPageShell } from "@/components/internal-page-shell";
import { getCatalogProducts } from "@/lib/catalog-service";
import { formatTierAwarePrice, formatTierAwarePriceMeta } from "@/lib/product-price-display";
import { getPricingContext } from "@/lib/pricing";
import { SITE_NAME, SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: `Catalogue | ${SITE_NAME}`,
  description: "Catalogue produit alimente depuis l'import AliExpress.",
  alternates: {
    canonical: `${SITE_URL}/products`,
  },
};

export default async function ProductsPage() {
  const [pricing, products] = await Promise.all([
    getPricingContext(),
    getCatalogProducts(),
  ]);

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
            <div className="inline-flex rounded-full bg-[#fff1e7] px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">
              Catalogue AliExpress
            </div>
            <h1 className="mt-4 text-[30px] font-bold tracking-[-0.05em] text-[#222] sm:text-[38px]">
              Produits importes avec variantes et attributs
            </h1>
            <p className="mt-4 text-[16px] leading-8 text-[#555]">
              Les fiches ci-dessous proviennent de l&apos;import fournisseur et gardent les options utiles pour la page détail.
            </p>
          </div>
        </section>

        {products.length === 0 ? (
          <section className="rounded-[30px] bg-white px-6 py-8 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 lg:px-8">
            <div className="text-[16px] leading-8 text-[#555]">Aucun produit publie pour le moment depuis l&apos;admin sourcing.</div>
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <Link
                key={product.slug}
                href={`/products/${product.slug}`}
                className="rounded-[24px] bg-white p-4 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 transition hover:-translate-y-0.5"
              >
                <div className="aspect-[4/3] overflow-hidden rounded-[18px] bg-[#f5f5f5]">
                  <img src={product.image} alt={product.shortTitle} className="h-full w-full object-cover" />
                </div>
                <div className="mt-4">
                  <div className="line-clamp-2 text-[18px] font-semibold tracking-[-0.04em] text-[#222]">{product.shortTitle}</div>
                  <div className="mt-2 text-[13px] text-[#667085]">{product.supplierName} · MOQ {product.moq} {product.unit}</div>
                  <div className="mt-3 text-[18px] font-bold text-[#111827]">{formatTierAwarePrice(pricing.formatPrice, product)}</div>
                  {formatTierAwarePriceMeta(product) ? <div className="mt-1 text-[12px] text-[#98a2b3]">{formatTierAwarePriceMeta(product)}</div> : null}
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </InternalPageShell>
  );
}
