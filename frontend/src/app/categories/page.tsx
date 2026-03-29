import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { InternalPageShell } from "@/components/internal-page-shell";
import { getCatalogCategories } from "@/lib/catalog-category-service";
import { getPricingContext } from "@/lib/pricing";
import { SITE_NAME, SITE_URL } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: `Categories | ${SITE_NAME}`,
  description: "Parcourez les familles de produits actuellement publiees sur AfriPay.",
  alternates: {
    canonical: `${SITE_URL}/categories`,
  },
};

export default async function CategoriesPage() {
  const [pricing, categories] = await Promise.all([
    getPricingContext(),
    getCatalogCategories(),
  ]);

  return (
    <InternalPageShell pricing={pricing}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#666]">
          <Link href="/" className="transition hover:text-[#ff6a00]">Accueil</Link>
          <span>/</span>
          <span className="font-medium text-[#222]">Categories</span>
        </div>

        <section className="rounded-[30px] bg-white px-6 py-6 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 lg:px-8 lg:py-7">
          <div className="max-w-[780px]">
            <div className="inline-flex rounded-full bg-[#fff1e7] px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">
              Navigation catalogue
            </div>
            <h1 className="mt-4 text-[30px] font-bold tracking-[-0.05em] text-[#222] sm:text-[38px]">
              Categories publiques
            </h1>
            <p className="mt-4 text-[16px] leading-8 text-[#555]">
              Les familles de produits sont maintenant reconstruites depuis les articles publies pour garder une navigation claire et propre sur le site.
            </p>
          </div>
        </section>

        {categories.length === 0 ? (
          <section className="rounded-[30px] bg-white px-6 py-8 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 lg:px-8">
            <div className="text-[16px] leading-8 text-[#555]">Aucune categorie publique n&apos;est encore disponible.</div>
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {categories.map((category) => (
              <Link key={category.slug} href={category.href} className="rounded-[24px] bg-white p-4 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 transition hover:-translate-y-0.5">
                <div className="aspect-[16/9] overflow-hidden rounded-[18px] bg-[#f7f7f7]">
                  {category.image ? <Image src={category.image} alt={category.title} width={960} height={540} className="h-full w-full object-cover" /> : null}
                </div>
                <div className="mt-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[20px] font-semibold tracking-[-0.04em] text-[#222]">{category.title}</div>
                    <div className="mt-2 text-[14px] leading-6 text-[#667085]">{category.description}</div>
                  </div>
                  <div className="rounded-full bg-[#fff4eb] px-3 py-1 text-[12px] font-semibold text-[#d85300]">{category.productCount}</div>
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </InternalPageShell>
  );
}
