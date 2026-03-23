import Image from "next/image";
import Link from "next/link";
import { Heart, Sparkles } from "lucide-react";

import { InternalPageShell } from "@/components/internal-page-shell";
import { getCatalogProductsBySlugs } from "@/lib/catalog-service";
import { getUserFavoriteSlugs } from "@/lib/customer-data-store";
import { getPricingContext } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/user-auth";

export default async function FavoritesPage() {
  const pricing = await getPricingContext();
  const user = await getCurrentUser();
  const favoriteSlugs = user ? await getUserFavoriteSlugs(user.id) : [];
  const favoriteItems = await getCatalogProductsBySlugs(favoriteSlugs);

  return (
    <InternalPageShell pricing={pricing}>
      <section className="bg-transparent px-0 py-0 shadow-none ring-0 sm:rounded-[30px] sm:bg-white sm:px-8 sm:py-8 sm:shadow-[0_8px_30px_rgba(24,39,75,0.05)] sm:ring-1 sm:ring-black/5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#fff2e9] px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">
              <Heart className="h-4 w-4" />
              Favoris
            </div>
            <h1 className="mt-5 text-[30px] font-bold tracking-[-0.05em] text-[#222] sm:text-[40px]">Produits sauvegardes</h1>
            <p className="mt-3 text-[15px] text-[#666] sm:text-[17px]">Retrouvez vos selections preferees et relancez vos fournisseurs plus vite.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#f7f7f7] px-4 py-2 text-[14px] font-semibold text-[#333] ring-1 ring-black/5">
            <Sparkles className="h-4 w-4 text-[#ff6a00]" />
            {pricing.flagEmoji} Prix adaptes pour {pricing.countryLabel}
          </div>
        </div>

        {favoriteItems.length === 0 ? (
          <div className="mt-8 rounded-[22px] bg-[#fafafa] px-5 py-8 text-center ring-1 ring-black/5">
            <div className="text-[20px] font-semibold text-[#222]">Aucun favori enregistre</div>
            <p className="mx-auto mt-3 max-w-[620px] text-[14px] leading-7 text-[#666]">
              Ajoutez des produits a vos favoris depuis les fiches produit. Votre liste sera propre a votre compte.
            </p>
            <Link href="/products" className="mt-5 inline-flex h-11 items-center justify-center rounded-full border border-[#222] px-5 text-[14px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
              Parcourir le catalogue
            </Link>
          </div>
        ) : (
        <div className="mt-8 grid grid-cols-2 gap-2.5 sm:gap-5 xl:grid-cols-4">
          {favoriteItems.map((item) => (
            <article key={item.title} className="overflow-hidden rounded-[16px] bg-white shadow-[0_8px_24px_rgba(24,39,75,0.05)] ring-1 ring-black/5 sm:rounded-[24px]">
              <div className="relative aspect-square bg-[#f4f4f4]">
                <Image src={item.image} alt={item.title} fill sizes="(min-width:1280px) 20vw, (min-width:640px) 40vw, 90vw" className="object-cover" />
              </div>
              <div className="p-2.5 sm:p-5">
                <div className="line-clamp-3 min-h-[48px] text-[12px] font-semibold leading-4 text-[#222] sm:min-h-[84px] sm:text-[20px] sm:leading-7">{item.title}</div>
                <div className="mt-2 text-[14px] font-bold tracking-[-0.04em] text-[#d85300] sm:mt-4 sm:text-[24px]">{pricing.formatPrice(item.minUsd)}{typeof item.maxUsd === "number" ? ` - ${pricing.formatPrice(item.maxUsd)}` : ""}</div>
                <Link href={`/products/${item.slug}`} className="mt-3 inline-flex h-9 items-center justify-center rounded-full border border-[#222] px-4 text-[12px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00] sm:mt-5 sm:h-12 sm:px-6 sm:text-[15px]">
                  Voir le produit
                </Link>
              </div>
            </article>
          ))}
        </div>
        )}
      </section>
    </InternalPageShell>
  );
}