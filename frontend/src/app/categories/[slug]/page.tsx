import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { InternalPageShell } from "@/components/internal-page-shell";
import { getCatalogCategoryBySlug } from "@/lib/catalog-category-service";
import { formatTierAwarePrice } from "@/lib/product-price-display";
import { getPricingContext } from "@/lib/pricing";
import { normalizeStorefrontText } from "@/lib/public-storefront";
import { SITE_URL } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCatalogCategoryBySlug(slug);

  return {
    title: category ? `${category.title} | Categories` : "Categorie introuvable",
    description: category ? category.description : "Categorie catalogue introuvable.",
    alternates: {
      canonical: `${SITE_URL}/categories/${slug}`,
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [pricing, category] = await Promise.all([
    getPricingContext(),
    getCatalogCategoryBySlug(slug),
  ]);

  if (!category) {
    notFound();
  }

  return (
    <InternalPageShell pricing={pricing}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#666]">
          <Link href="/" className="transition hover:text-[#ff6a00]">Accueil</Link>
          <span>/</span>
          <Link href="/categories" className="transition hover:text-[#ff6a00]">Categories</Link>
          <span>/</span>
          <span className="font-medium text-[#222]">{category.title}</span>
        </div>

        <section className="rounded-[30px] bg-white px-6 py-6 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 lg:px-8 lg:py-7">
          <div className="max-w-[760px]">
            <div className="inline-flex rounded-full bg-[#fff1e7] px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">
              {category.productCount} article(s)
            </div>
            <h1 className="mt-4 text-[30px] font-bold tracking-[-0.05em] text-[#222] sm:text-[38px]">{category.title}</h1>
            <p className="mt-4 text-[16px] leading-8 text-[#555]">{category.description}</p>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {category.products.map((product) => (
            <Link key={product.slug} href={`/products/${product.slug}`} className="rounded-[18px] bg-white p-2.5 shadow-[0_12px_30px_rgba(24,39,75,0.06)] ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(24,39,75,0.12)]">
              <div className="aspect-square overflow-hidden rounded-[14px] bg-[#f5f5f5]">
                <Image src={product.image} alt={product.shortTitle} width={640} height={480} className="h-full w-full object-cover" />
              </div>
              <div className="mt-2 line-clamp-2 min-h-[34px] text-[12px] font-semibold leading-4 tracking-[-0.03em] text-[#222] sm:min-h-[40px] sm:text-[13px] sm:leading-5">{product.shortTitle}</div>
              <div className="mt-1 line-clamp-1 text-[10px] text-[#667085] sm:text-[11px]">{normalizeStorefrontText(product.supplierName)}</div>
              <div className="mt-2 text-[15px] font-bold tracking-[-0.03em] text-[#111827] sm:text-[16px]">{formatTierAwarePrice(pricing.formatPrice, product)}</div>
            </Link>
          ))}
        </section>
      </div>
    </InternalPageShell>
  );
}
