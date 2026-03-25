import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Layers3, Sparkles } from "lucide-react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { InternalPageShell } from "@/components/internal-page-shell";
import { getCatalogCategories, getCatalogCategoryBySlug } from "@/lib/catalog-category-service";
import { getPricingContext } from "@/lib/pricing";
import { SITE_URL } from "@/lib/site-config";

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

export async function generateStaticParams() {
  const categories = await getCatalogCategories();
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCatalogCategoryBySlug(slug);

  if (!category) {
    return {};
  }

  return {
    title: category.title,
    description: category.description,
    alternates: {
      canonical: `${SITE_URL}/categories/${category.slug}`,
    },
    openGraph: {
      title: `${category.title} | AfriPay`,
      description: category.description,
      url: `${SITE_URL}/categories/${category.slug}`,
      images: category.image ? [{ url: category.image }] : undefined,
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const pricing = await getPricingContext();
  const { slug } = await params;
  const category = await getCatalogCategoryBySlug(slug);

  if (!category) {
    notFound();
  }
  const products = category.products;

  return (
    <InternalPageShell pricing={pricing}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#666]">
          <Link href="/" className="transition hover:text-[#ff6a00]">Accueil</Link>
          <span>/</span>
          <span className="font-medium text-[#222]">{category.title}</span>
        </div>

        <section className="overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#fff4ea_0%,#fff 44%,#f5f7fb_100%)] px-6 py-7 shadow-[0_18px_44px_rgba(24,39,75,0.08)] ring-1 ring-black/5 lg:px-8 lg:py-8">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#fff1e7] px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">
                <Sparkles className="h-4 w-4" />
                Univers categorie
              </div>
              <h1 className="mt-4 text-[36px] font-bold tracking-[-0.05em] text-[#222] sm:text-[48px]">{category.title}</h1>
              <p className="mt-4 max-w-[760px] text-[16px] leading-8 text-[#555]">{category.description}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/quotes" className="inline-flex h-13 items-center justify-center rounded-full bg-[#ff6a00] px-7 text-[16px] font-semibold text-white transition hover:bg-[#ec6100]">
                  Demander un devis categorie
                </Link>
                <Link href="/products" className="inline-flex h-13 items-center justify-center rounded-full border border-[#d9dee7] px-7 text-[16px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
                  Recherche avancee
                </Link>
              </div>
            </div>

            <article className="rounded-[28px] bg-white px-6 py-6 shadow-[0_12px_30px_rgba(17,24,39,0.06)] ring-1 ring-black/5">
              <div className="flex items-center gap-3 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">
                <Layers3 className="h-4 w-4" />
                Vue rapide
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="rounded-[20px] bg-[#faf7f3] px-4 py-4 ring-1 ring-[#f1dfd2]">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#a06942]">Produits</div>
                  <div className="mt-2 text-[28px] font-bold tracking-[-0.04em] text-[#222]">{products.length}</div>
                </div>
                <div className="rounded-[20px] bg-[#f6f8fb] px-4 py-4 ring-1 ring-[#e4ebf3]">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6c7a92]">Disponibilite</div>
                  <div className="mt-2 text-[18px] font-semibold text-[#222]">Stock et MOQ visibles</div>
                </div>
                <div className="rounded-[20px] bg-[#fff7ef] px-4 py-4 ring-1 ring-[#ffe0c2]">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#d06e1d]">Action</div>
                  <div className="mt-2 text-[18px] font-semibold text-[#222]">Comparaison immediate</div>
                </div>
              </div>
            </article>
          </div>
        </section>

        {products.length > 0 ? (
        <section className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {products.map((product) => (
            <Link key={product.slug} href={`/products/${product.slug}`} className="group rounded-[16px] bg-white p-2.5 shadow-[0_10px_30px_rgba(17,24,39,0.06)] ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-[0_20px_44px_rgba(17,24,39,0.12)] sm:rounded-[20px] sm:p-3">
              <div className="relative overflow-hidden rounded-[14px] bg-[#f6f6f6] sm:rounded-[18px]">
                {product.badge ? <div className="absolute left-2 top-2 z-10 rounded-full bg-[#de0505] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">{product.badge}</div> : null}
                <div className="relative aspect-[0.96] w-full">
                  <Image src={product.image} alt={product.title} fill sizes="(min-width: 1536px) 14vw, (min-width: 1280px) 18vw, (min-width: 768px) 28vw, 90vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                </div>
              </div>
              <div className="mt-2.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#d04a0a] sm:text-[10px] sm:tracking-[0.14em]">AfriPay Guaranteed</div>
              <div className="mt-1.5 line-clamp-2 min-h-[34px] text-[12px] font-semibold leading-4 text-[#222] sm:mt-2 sm:min-h-[40px] sm:text-[13px] sm:leading-5">{product.title}</div>
              <div className="mt-2 text-[14px] font-bold tracking-[-0.03em] text-[#f05a00] sm:text-[16px]">{formatPriceRange(pricing.formatPrice, product.minUsd, product.maxUsd)}</div>
              <div className="mt-1 text-[10px] text-[#666] sm:text-[12px]">MOQ: {product.moq} {product.unit}</div>
            </Link>
          ))}
        </section>
        ) : (
          <section className="rounded-[28px] bg-white px-6 py-8 text-center shadow-[0_14px_34px_rgba(17,24,39,0.06)] ring-1 ring-black/5">
            <h2 className="text-[28px] font-bold tracking-[-0.05em] text-[#222]">Categorie vide</h2>
            <p className="mx-auto mt-3 max-w-[720px] text-[15px] leading-7 text-[#666]">
              Cette catégorie affichera uniquement les articles réellement publiés et rattachés à cette famille.
            </p>
          </section>
        )}

        <section className="rounded-[30px] bg-white px-7 py-7 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">Suite logique</div>
              <h2 className="mt-3 text-[30px] font-bold tracking-[-0.04em] text-[#222]">Passez de la categorie au sourcing actif</h2>
              <p className="mt-2 max-w-[760px] text-[16px] leading-8 text-[#555]">Comparez les MOQ, ouvrez les fiches produit et envoyez votre demande fournisseur sans sortir de l&apos;univers categorie.</p>
            </div>
            <Link href="/quotes" className="inline-flex h-14 min-w-[260px] items-center justify-center gap-3 rounded-full bg-[#222] px-8 shadow-[0_16px_30px_rgba(17,24,39,0.16)] transition hover:-translate-y-0.5 hover:bg-black hover:shadow-[0_20px_36px_rgba(17,24,39,0.22)]">
              <span className="text-[17px] font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">
                Ouvrir un devis
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 text-white" />
            </Link>
          </div>
        </section>
      </div>
    </InternalPageShell>
  );
}
