import Link from "next/link";
import { Heart } from "lucide-react";
import { redirect } from "next/navigation";

import { InternalPageShell } from "@/components/internal-page-shell";
import { getCatalogProductsBySlugs } from "@/lib/catalog-service";
import { getFavoriteRecords } from "@/lib/customer-data-store";
import { getStorefrontMoqDisplay } from "@/lib/product-moq";
import { getPricingContext } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/user-auth";

export default async function FavoritesPage() {
  const pricing = await getPricingContext();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/favorites");
  }

  const favoriteSlugs = (await getFavoriteRecords())
    .filter((entry) => entry.userId === user.id)
    .map((entry) => entry.productSlug);
  const products = await getCatalogProductsBySlugs(favoriteSlugs);

  return (
    <InternalPageShell pricing={pricing}>
      <section className="rounded-[28px] bg-white px-6 py-7 shadow-[0_14px_34px_rgba(17,24,39,0.06)] ring-1 ring-black/5 sm:px-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#fff1e7] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">
          <Heart className="h-4 w-4 fill-current" />
          Favoris actifs
        </div>
        <h1 className="mt-4 text-[32px] font-black tracking-[-0.05em] text-[#111827]">Produits à relancer</h1>
        <p className="mt-3 max-w-[760px] text-[15px] leading-7 text-[#667085]">
          Retrouvez ici les produits que vous avez marqués pour comparaison, reprise panier ou validation plus tard.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.length === 0 ? (
            <div className="rounded-[20px] bg-[#f8fafc] px-5 py-5 text-[14px] text-[#667085] ring-1 ring-[#e7edf4]">
              Aucun favori enregistré pour ce compte. Depuis une fiche produit, utilisez le cœur pour le retrouver ici.
            </div>
          ) : products.map((product) => {
            const moqDisplay = getStorefrontMoqDisplay(product);

            return (
              <Link key={product.slug} href={`/products/${product.slug}`} className="rounded-[22px] border border-[#e8edf3] bg-white px-5 py-5 transition hover:-translate-y-0.5 hover:border-[#ffb37a] hover:shadow-[0_16px_32px_rgba(17,24,39,0.08)]">
                <div className="text-[18px] font-bold leading-7 text-[#111827]">{product.shortTitle}</div>
                <div className="mt-2 text-[13px] font-semibold text-[#d65d00]">{moqDisplay.label} · {moqDisplay.value}</div>
                <div className="mt-2 text-[14px] text-[#667085]">{pricing.formatPrice(product.tiers[0]?.priceUsd ?? 0)}</div>
                <div className="mt-4 inline-flex rounded-full bg-[#fff5ed] px-3 py-1 text-[12px] font-semibold text-[#d65d00]">
                  Relancer ce produit
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </InternalPageShell>
  );
}
