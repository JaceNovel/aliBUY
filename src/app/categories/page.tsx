import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

import { InternalPageShell } from "@/components/internal-page-shell";
import { getCatalogCategories } from "@/lib/catalog-category-service";
import { getPricingContext } from "@/lib/pricing";
import { SITE_NAME, SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: `Categories produit | ${SITE_NAME}`,
  description: "Explorez les categories du catalogue AfriPay pour retrouver rapidement les produits importes, publies et classes automatiquement depuis Alibaba.",
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
        <section className="rounded-[30px] bg-[linear-gradient(135deg,#fff4ea_0%,#fff 52%,#f6f8fc_100%)] px-6 py-7 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 sm:px-8">
          <div className="max-w-[860px]">
            <div className="inline-flex rounded-full bg-[#fff1e7] px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">
              Taxonomie AfriPay
            </div>
            <h1 className="mt-4 text-[34px] font-black tracking-[-0.06em] text-[#101828] sm:text-[46px]">Toutes les categories du catalogue</h1>
            <p className="mt-4 text-[16px] leading-8 text-[#555]">
              Chaque categorie est alimentee automatiquement depuis les imports Alibaba publies. Si une nouvelle famille produit arrive,
              elle apparait ici avec son premier article et se consolide au fur et a mesure des publications.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={category.href}
              className="group overflow-hidden rounded-[24px] bg-white p-4 shadow-[0_12px_30px_rgba(17,24,39,0.06)] ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(17,24,39,0.1)]"
            >
              <div className="grid gap-4 sm:grid-cols-[108px_minmax(0,1fr)] sm:items-center">
                <div className="relative aspect-square overflow-hidden rounded-[20px] bg-[#f7f7f7]">
                  {category.image ? (
                    <Image src={category.image} alt={category.title} fill sizes="160px" className="object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[13px] font-semibold uppercase tracking-[0.12em] text-[#d06e1d]">
                      AfriPay
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#d06e1d]">{category.productCount} produit{category.productCount > 1 ? "s" : ""}</div>
                  <h2 className="mt-2 text-[24px] font-bold tracking-[-0.05em] text-[#111827]">{category.title}</h2>
                  <p className="mt-2 text-[14px] leading-6 text-[#667085]">{category.description}</p>
                  <div className="mt-3 text-[13px] font-semibold text-[#ff6a00]">
                    {category.sourcePathLabel}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </InternalPageShell>
  );
}
