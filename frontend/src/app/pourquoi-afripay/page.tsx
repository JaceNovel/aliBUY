import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, MessageSquareQuote, ShieldCheck, Truck } from "lucide-react";

import { InternalPageShell } from "@/components/internal-page-shell";
import { getPricingContext } from "@/lib/pricing";

const proofCards = [
  {
    title: "Capture de suivi claire",
    description: "Le client voit un vrai statut commande, un tracking AfriPay et les preuves déposées au fil de la logistique.",
    icon: Truck,
  },
  {
    title: "Exemple de devis concret",
    description: "La demande garde le besoin produit, la quantité, la cible budget et la fenêtre logistique au même endroit.",
    icon: ShieldCheck,
  },
  {
    title: "Relance utile, pas du bruit",
    description: "Panier et devis abandonnés remontent automatiquement pour reprendre sans tout ressaisir.",
    icon: MessageSquareQuote,
  },
];

export default async function PourquoiAfripayPage() {
  const pricing = await getPricingContext();

  return (
    <InternalPageShell pricing={pricing}>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[34px] bg-[linear-gradient(135deg,#1a2436_0%,#243a5c_42%,#fff2e7_100%)] text-white shadow-[0_20px_50px_rgba(17,24,39,0.14)]">
          <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
              <div className="inline-flex rounded-full bg-white/12 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-white/82">
                Pourquoi AfriPay
              </div>
              <h1 className="mt-4 max-w-[760px] text-[34px] font-black tracking-[-0.06em] sm:text-[48px]">
                Pas une vitrine de plus. Un vrai pont entre produit, paiement et logistique.
              </h1>
              <p className="mt-4 max-w-[720px] text-[16px] leading-8 text-white/82">
                AfriPay devient fort quand le client voit la preuve: une équipe identifiable, des devis repris sans friction,
                un paiement traçable et un suivi commande compréhensible jusqu&apos;à la remise finale.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/support-center" className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-[15px] font-semibold text-[#1f2937] transition hover:opacity-90">
                  Ouvrir mon centre de reprise
                </Link>
                <Link href="/quotes" className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/30 px-6 text-[15px] font-semibold text-white transition hover:bg-white/8">
                  Préparer un devis
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="relative min-h-[320px] lg:min-h-full">
              <Image
                src="/api/assets/union"
                alt="Equipe AfriPay réunie autour d'un colis AfriPay"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,24,39,0.08)_0%,rgba(17,24,39,0.42)_100%)]" />
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {proofCards.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="rounded-[26px] bg-white px-6 py-6 shadow-[0_14px_34px_rgba(17,24,39,0.06)] ring-1 ring-black/5">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#fff2e8] text-[#ff6a00]">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-[24px] font-black tracking-[-0.04em] text-[#111827]">{item.title}</h2>
                <p className="mt-3 text-[15px] leading-7 text-[#667085]">{item.description}</p>
              </article>
            );
          })}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-[30px] bg-white px-6 py-7 shadow-[0_14px_34px_rgba(17,24,39,0.06)] ring-1 ring-black/5 sm:px-8">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff6a00]">Preuves visibles</div>
            <h2 className="mt-3 text-[30px] font-black tracking-[-0.05em] text-[#111827]">Ce qu&apos;un client comprend sans explication supplémentaire</h2>
            <div className="mt-6 space-y-4">
              {[
                "Un panier peut être repris ou payé par un tiers sans casser la commande.",
                "Un devis commencé ne disparaît plus quand on quitte la page.",
                "La timeline commande sépare enfin création, paiement, achat fournisseur, expédition, hub et livraison.",
                "Les pages produit montrent le délai, le poids, l'origine, la méthode de livraison et le risque douane avant validation.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-[18px] bg-[#f8fafc] px-4 py-4 ring-1 ring-[#e7edf4]">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#16a34a]" />
                  <p className="text-[15px] leading-7 text-[#475467]">{item}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[30px] bg-[linear-gradient(180deg,#fff8f1_0%,#ffffff_100%)] px-6 py-7 shadow-[0_14px_34px_rgba(17,24,39,0.06)] ring-1 ring-[#f2dfcf] sm:px-8">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#d65d00]">Pourquoi ça convertit mieux</div>
            <h2 className="mt-3 text-[28px] font-black tracking-[-0.05em] text-[#111827]">Moins de promesses génériques, plus de preuves actionnables</h2>
            <p className="mt-4 text-[15px] leading-7 text-[#667085]">
              Un site B2B solide ne gagne pas avec des slogans sur le “sourcing” ou le “paiement sécurisé”.
              Il gagne quand le client voit le prochain pas, le coût probable, le niveau de contrôle et l&apos;équipe derrière.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/products" className="inline-flex h-12 items-center justify-center rounded-full bg-[#ff6a00] px-6 text-[15px] font-semibold text-white transition hover:bg-[#eb6200]">
                Explorer les produits
              </Link>
              <Link href="/orders/tracking" className="inline-flex h-12 items-center justify-center rounded-full border border-[#d9dee7] px-6 text-[15px] font-semibold text-[#1f2937] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
                Voir la timeline commande
              </Link>
            </div>
          </article>
        </section>
      </div>
    </InternalPageShell>
  );
}
