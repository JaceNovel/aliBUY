import Image from "next/image";
import Link from "next/link";
import { Search, Sparkles } from "lucide-react";

import { InternalPageShell } from "@/components/internal-page-shell";
import { SearchSuggestionInput } from "@/components/search-suggestion-input";
import { getCatalogProducts, searchCatalogProducts } from "@/lib/catalog-service";
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

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const pricing = await getPricingContext();
  const { q = "" } = await searchParams;
  const query = q.trim();
  const visibleProducts = query ? await searchCatalogProducts(query) : await getCatalogProducts();

  return (
    <InternalPageShell pricing={pricing}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#666]">
          <Link href="/" className="transition hover:text-[#ff6a00]">Accueil</Link>
          <span>/</span>
          <span className="font-medium text-[#222]">Produits</span>
        </div>

        <section className="rounded-[30px] bg-white px-6 py-6 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 lg:px-8 lg:py-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#fff2e9] px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">
                <Sparkles className="h-4 w-4" />
                Catalogue produits
              </div>
              <h1 className="mt-4 text-[28px] font-bold tracking-[-0.05em] text-[#222] sm:text-[34px] lg:text-[42px]">
                {query ? `Produits filtres pour "${query}"` : "Tous les produits"}
              </h1>
              <p className="mt-3 max-w-[760px] text-[16px] leading-8 text-[#555]">
                {query
                  ? `Le catalogue a ete filtre selon votre recherche. ${visibleProducts.length} produit(s) correspondent a votre demande.`
                  : "Consultez tout le catalogue AfriPay dans une grille dense, inspiree des listings B2B marketplace."}
              </p>
            </div>

            <form action="/products" className="flex w-full max-w-[620px] flex-col gap-3 sm:flex-row sm:items-start">
              <SearchSuggestionInput
                name="q"
                defaultValue={query}
                placeholder="Ex: souris, bureau gaming, activewear"
                wrapperClassName="relative flex-1"
                inputClassName="h-14 w-full rounded-full border border-[#d8dde6] bg-white px-5 text-[16px] text-[#222] outline-none transition focus:border-[#ff6a00]"
                panelClassName="absolute left-0 right-0 top-[calc(100%+14px)] z-30 rounded-[26px] border border-black/5 bg-white p-4 shadow-[0_24px_48px_rgba(17,24,39,0.16)]"
              />
              <button type="submit" className="group inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-[#222] px-7 text-[16px] font-semibold text-white shadow-[0_10px_24px_rgba(34,34,34,0.16)] transition duration-200 hover:-translate-y-0.5 hover:bg-black hover:shadow-[0_16px_30px_rgba(34,34,34,0.22)] active:translate-y-0 active:scale-[0.98] sm:w-auto">
                <Search className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
                Rechercher
              </button>
            </form>
          </div>
        </section>

        {visibleProducts.length > 0 ? (
          <section className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {visibleProducts.map((product) => (
              <Link key={product.slug} href={`/products/${product.slug}`} className="group overflow-hidden rounded-[16px] bg-white ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(17,24,39,0.12)] sm:rounded-[18px]">
                <div className="relative aspect-[0.95] bg-[#f5f5f5]">
                  {product.badge ? (
                    <div className="absolute left-2 top-2 z-10 rounded-full bg-[#de0505] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-white">
                      {product.badge}
                    </div>
                  ) : null}
                  <Image
                    src={product.image}
                    alt={product.title}
                    fill
                    sizes="(min-width: 1536px) 14vw, (min-width: 1280px) 18vw, (min-width: 768px) 28vw, 90vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="p-2.5 sm:p-3">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#d04a0a] sm:text-[10px] sm:tracking-[0.14em]">AfriPay Guaranteed</div>
                  <div className="mt-1.5 line-clamp-2 min-h-[34px] text-[12px] font-semibold leading-4 text-[#222] sm:mt-2 sm:min-h-[40px] sm:text-[13px] sm:leading-5">{product.title}</div>
                  <div className="mt-2 text-[14px] font-bold tracking-[-0.03em] text-[#f05a00] sm:text-[16px]">{formatPriceRange(pricing.formatPrice, product.minUsd, product.maxUsd)}</div>
                  <div className="mt-1 text-[10px] text-[#666] sm:text-[12px]">MOQ: {product.moq} {product.unit}</div>
                </div>
              </Link>
            ))}
          </section>
        ) : (
          <section className="rounded-[30px] bg-white px-6 py-8 text-center shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5">
            <h2 className="text-[30px] font-bold tracking-[-0.04em] text-[#222]">Aucun produit trouve</h2>
            <p className="mx-auto mt-3 max-w-[620px] text-[16px] leading-8 text-[#555]">
              Essayez une autre recherche pour filtrer le catalogue avec un mot-cle plus large.
            </p>
          </section>
        )}
      </div>
    </InternalPageShell>
  );
}