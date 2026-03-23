import Link from "next/link";
import { ArrowRight, Clock3, Search, ShieldCheck, Sparkles } from "lucide-react";

import { InternalPageShell } from "@/components/internal-page-shell";
import { getPricingContext } from "@/lib/pricing";

export default async function DiscoverAfriPayPage() {
  const pricing = await getPricingContext();

  return (
    <InternalPageShell pricing={pricing}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#666]">
          <Link href="/" className="transition hover:text-[#ff6a00]">Accueil</Link>
          <span>/</span>
          <span className="font-medium text-[#222]">Decouvrir AfriPay</span>
        </div>

        <section className="rounded-[32px] bg-[linear-gradient(135deg,#fff4ea_0%,#fff 48%,#f5f7fb_100%)] px-6 py-8 shadow-[0_18px_44px_rgba(24,39,75,0.08)] ring-1 ring-black/5 lg:px-8 lg:py-10">
          <div className="max-w-[920px]">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#fff1e7] px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">
              <Sparkles className="h-4 w-4" />
              Experience AfriPay
            </div>
            <h1 className="mt-4 text-[34px] font-bold tracking-[-0.05em] text-[#222] sm:text-[48px]">Une recherche plus simple pour trouver les bons produits</h1>
            <p className="mt-4 max-w-[760px] text-[16px] leading-8 text-[#555]">
              AfriPay rassemble la recherche produit, la comparaison rapide et la demande de devis dans une interface claire,
              pensee pour aider vos clients a gagner du temps lorsqu&apos;ils explorent le catalogue.
            </p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {[
            {
              title: "Recherche rapide",
              icon: Search,
              description: "Lancez une recherche texte ou visuelle pour atteindre plus vite les produits qui vous interessent.",
            },
            {
              title: "Comparaison claire",
              icon: ShieldCheck,
              description: "Consultez les informations utiles comme le MOQ, les prix et les details produit dans une presentation lisible.",
            },
            {
              title: "Suivi plus fluide",
              icon: Clock3,
              description: "Passez de la decouverte d&apos;un article a la demande de devis sans multiplier les etapes inutiles.",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="rounded-[24px] bg-white px-6 py-6 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#fff1e7] text-[#d85300]">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-[24px] font-bold tracking-[-0.04em] text-[#222]">{item.title}</h2>
                <p className="mt-3 text-[15px] leading-7 text-[#666]">{item.description}</p>
              </article>
            );
          })}
        </section>

        <section className="rounded-[28px] bg-white px-6 py-7 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">Continuer la visite</div>
              <h2 className="mt-3 text-[30px] font-bold tracking-[-0.04em] text-[#222]">Explorez le catalogue ou envoyez directement votre demande</h2>
              <p className="mt-3 max-w-[760px] text-[16px] leading-8 text-[#555]">
                Vous pouvez revenir a l&apos;accueil, parcourir les produits disponibles ou demander un devis selon votre besoin.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/products" className="inline-flex h-12 items-center justify-center rounded-full bg-[#ff6a00] px-6 text-[15px] font-semibold text-white transition hover:bg-[#ec6100]">
                Voir les produits
              </Link>
              <Link href="/quotes" className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[#d9dee7] px-6 text-[15px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
                Demander un devis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </InternalPageShell>
  );
}