import Image from "next/image";
import Link from "next/link";
import { Camera, Search } from "lucide-react";

import { InternalPageShell } from "@/components/internal-page-shell";
import { getCatalogProductsBySlugs } from "@/lib/catalog-service";
import { formatTierAwarePrice } from "@/lib/product-price-display";
import { getPricingContext } from "@/lib/pricing";

export default async function ImageSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ slugs?: string; name?: string }>;
}) {
  const pricing = await getPricingContext();
  const { slugs = "", name = "image" } = await searchParams;
  const resultSlugs = slugs
    .split(",")
    .map((slug) => slug.trim())
    .filter(Boolean);
  const results = await getCatalogProductsBySlugs(resultSlugs);

  return (
    <InternalPageShell pricing={pricing}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#666]">
          <Link href="/" className="transition hover:text-[#ff6a00]">Accueil</Link>
          <span>/</span>
          <span className="font-medium text-[#222]">Recherche par image</span>
        </div>

        <section className="rounded-[30px] bg-white px-6 py-6 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 lg:px-8 lg:py-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#fff2e9] px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">
                <Camera className="h-4 w-4" />
                Recherche visuelle
              </div>
              <h1 className="mt-4 text-[34px] font-bold tracking-[-0.05em] text-[#222] sm:text-[42px]">Resultats pour l&apos;image importee</h1>
              <p className="mt-3 max-w-[760px] text-[16px] leading-8 text-[#555]">
                AfriPay a compare votre image au catalogue et a retenu les produits les plus proches visuellement. Fichier analyse: <span className="font-semibold text-[#222]">{name}</span>
              </p>
            </div>

            <Link href="/" className="inline-flex h-14 items-center justify-center gap-3 rounded-full bg-[#222] px-7 text-[16px] font-semibold text-white transition hover:bg-black">
              <Search className="h-5 w-5" />
              Nouvelle recherche
            </Link>
          </div>
        </section>

        {results.length > 0 ? (
          <section className="grid grid-cols-2 gap-2.5 sm:gap-5 xl:grid-cols-4 2xl:grid-cols-6">
            {results.map((product) => (
              <Link key={product.slug} href={`/products/${product.slug}`} className="group rounded-[16px] bg-white p-2.5 shadow-[0_8px_30px_rgba(17,24,39,0.06)] ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(17,24,39,0.12)] sm:rounded-[24px] sm:p-3">
                <div className="relative overflow-hidden rounded-[14px] bg-[#f5f5f5] sm:rounded-[18px]">
                  <div className="relative aspect-square w-full">
                    <Image src={product.image} alt={product.title} fill sizes="(min-width: 1536px) 14vw, (min-width: 1280px) 18vw, (min-width: 640px) 44vw, 90vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                  </div>
                </div>
                <div className="mt-2.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#d04a0a] sm:mt-4 sm:text-[11px] sm:tracking-[0.14em]">Correspondance image</div>
                <div className="mt-1.5 line-clamp-2 min-h-[34px] text-[12px] font-semibold leading-4 text-[#222] sm:mt-2 sm:min-h-12 sm:text-[16px] sm:leading-6">{product.title}</div>
                <div className="mt-2 text-[14px] font-bold tracking-[-0.03em] text-[#f05a00] sm:mt-3 sm:text-[18px]">
                  {formatTierAwarePrice(pricing.formatPrice, product)}
                </div>
                <div className="mt-1 text-[10px] text-[#666] sm:mt-2 sm:text-[13px]">MOQ: {product.moq} {product.unit}</div>
              </Link>
            ))}
          </section>
        ) : (
          <section className="rounded-[30px] bg-white px-6 py-8 text-center shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5">
            <h2 className="text-[30px] font-bold tracking-[-0.04em] text-[#222]">Aucun resultat visuel</h2>
            <p className="mx-auto mt-3 max-w-[620px] text-[16px] leading-8 text-[#555]">
              Aucun produit importe et publie ne correspond encore a cette image. Importez vos articles depuis l&apos;admin Alibaba puis relancez la recherche.
            </p>
            <Link href="/" className="mt-6 inline-flex h-13 items-center justify-center rounded-full bg-[#ff6a00] px-7 text-[16px] font-semibold text-white transition hover:bg-[#ec6100]">
              Retour a l&apos;accueil
            </Link>
          </section>
        )}
      </div>
    </InternalPageShell>
  );
}