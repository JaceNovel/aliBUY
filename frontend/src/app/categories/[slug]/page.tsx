import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { InternalPageShell } from "@/components/internal-page-shell";
import { getCatalogCategoryBySlug } from "@/lib/catalog-category-service";
import { formatTierAwarePrice } from "@/lib/product-price-display";
import { getPricingContext } from "@/lib/pricing";
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

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {category.products.map((product) => (
            <Link key={product.slug} href={`/products/${product.slug}`} className="rounded-[24px] bg-white p-4 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 transition hover:-translate-y-0.5">
              <div className="aspect-[4/3] overflow-hidden rounded-[18px] bg-[#f5f5f5]">
                <Image src={product.image} alt={product.shortTitle} width={640} height={480} className="h-full w-full object-cover" />
              </div>
              <div className="mt-4 line-clamp-2 text-[18px] font-semibold tracking-[-0.04em] text-[#222]">{product.shortTitle}</div>
              <div className="mt-2 text-[13px] text-[#667085]">{product.supplierName} · MOQ {product.moq} {product.unit}</div>
              <div className="mt-3 text-[18px] font-bold text-[#111827]">{formatTierAwarePrice(pricing.formatPrice, product)}</div>
            </Link>
          ))}
        </section>
      </div>
    </InternalPageShell>
  );
}
