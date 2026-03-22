import Link from "next/link";
import { ArrowRight, CircleDollarSign, Package, Plane, Ship, Sparkles } from "lucide-react";

import { InternalPageShell } from "@/components/internal-page-shell";
import { getMessages } from "@/lib/messages";
import { getPricingContext } from "@/lib/pricing";

const pricingRows = [
  { label: "Accessoires gaming", baseUsd: 8.4, note: "MOQ flexible" },
  { label: "Casques VR retail", baseUsd: 13.77, note: "Bundle populaire" },
  { label: "Mobilier gaming", baseUsd: 25.46, note: "Volume B2B" },
];

const freightModes = [
  {
    title: "Par avion",
    description: "Le bon choix pour les commandes urgentes, les echantillons et les colis legers.",
    icon: Plane,
    eta: "3 a 7 jours",
  },
  {
    title: "Par bateau",
    description: "Le bon choix pour les lots lourds, les palettes et les approvisionnements de stock.",
    icon: Ship,
    eta: "20 a 45 jours",
  },
];

export default async function PricingPage() {
  const pricing = await getPricingContext();
  const messages = getMessages(pricing.languageCode);

  return (
    <InternalPageShell pricing={pricing}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#666]">
          <Link href="/" className="transition hover:text-[#ff6a00]">Accueil</Link>
          <span>/</span>
          <span className="font-medium text-[#222]">Tarifs</span>
        </div>

        <section className="overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#1d1612_0%,#572815_48%,#ff6a00_100%)] px-7 py-8 text-white shadow-[0_24px_60px_rgba(81,35,12,0.28)] lg:px-10 lg:py-10">
          <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr] xl:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-white/86">
                <Sparkles className="h-4 w-4" />
                {messages.pricing.heading}
              </div>
              <h1 className="mt-5 max-w-[760px] text-[40px] font-bold leading-[1.02] tracking-[-0.05em] sm:text-[52px]">
                Page de tarification selon votre pays, votre devise et votre fenetre logistique.
              </h1>
              <p className="mt-4 max-w-[760px] text-[17px] leading-8 text-white/82">
                AfriPay affiche vos tarifs dans votre devise locale, avec conversion serveur et contexte de livraison deja applique. Vous gardez une lecture claire du cout produit avant de commander.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/quotes" className="inline-flex h-13 items-center justify-center rounded-full bg-[#ffd9c2] px-7 text-[16px] font-semibold text-[#5a240d] shadow-[0_10px_24px_rgba(0,0,0,0.12)] transition hover:bg-[#ffc59f]">
                  Demander un devis
                </Link>
                <Link href="/" className="inline-flex h-13 items-center justify-center rounded-full border border-[#f0b58d] bg-[#6c3319] px-7 text-[16px] font-semibold text-white transition hover:bg-[#7a3b1d]">
                  Retour aux produits
                </Link>
              </div>
            </div>

            <article className="rounded-[28px] bg-white/10 px-6 py-6 backdrop-blur-sm ring-1 ring-white/14">
              <div className="text-[13px] font-semibold uppercase tracking-[0.16em] text-white/72">Contexte actif</div>
              <div className="mt-4 text-[30px] font-bold tracking-[-0.04em] text-white">{pricing.flagEmoji} {pricing.countryLabel}</div>
              <div className="mt-2 text-[16px] text-white/78">{pricing.languageLabel}</div>
              <div className="mt-5 space-y-3 text-[15px] text-white/86">
                <div className="flex items-center justify-between gap-4 rounded-[18px] bg-black/14 px-4 py-3">
                  <span>{messages.pricing.conversion}</span>
                  <span className="font-semibold">{pricing.exchangeLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-[18px] bg-black/14 px-4 py-3">
                  <span>{messages.pricing.logisticsWindow}</span>
                  <span className="font-semibold">{pricing.shippingWindow}</span>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-[30px] bg-white px-7 py-7 shadow-[0_10px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5">
            <div className="flex items-center gap-3 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">
              <CircleDollarSign className="h-4 w-4" />
              Tarifs affiches
            </div>
            <h2 className="mt-4 text-[30px] font-bold tracking-[-0.04em] text-[#222]">Exemples de prix contextualises</h2>
            <p className="mt-3 max-w-[760px] text-[16px] leading-8 text-[#555]">
              Les montants ci-dessous montrent comment un tarif usine en USD est affiche directement dans votre devise actuelle, avec le meme moteur serveur que sur les fiches produit.
            </p>

            <div className="mt-7 overflow-hidden rounded-[24px] border border-[#ececec]">
              <div className="grid grid-cols-[minmax(0,1.2fr)_0.75fr_0.9fr] bg-[#faf7f3] px-5 py-4 text-[13px] font-semibold uppercase tracking-[0.14em] text-[#7d6b5f]">
                <div>Produit</div>
                <div>Base USD</div>
                <div>Prix local</div>
              </div>
              {pricingRows.map((row, index) => (
                <div key={row.label} className={["grid grid-cols-[minmax(0,1.2fr)_0.75fr_0.9fr] items-center gap-3 px-5 py-5", index > 0 ? "border-t border-[#ececec]" : ""].join(" ")}>
                  <div>
                    <div className="text-[18px] font-semibold text-[#222]">{row.label}</div>
                    <div className="mt-1 text-[14px] text-[#666]">{row.note}</div>
                  </div>
                  <div className="text-[17px] font-semibold text-[#555]">${row.baseUsd.toFixed(2)}</div>
                  <div className="text-[22px] font-bold tracking-[-0.04em] text-[#f05a00]">{pricing.formatPrice(row.baseUsd)}</div>
                </div>
              ))}
            </div>
          </article>

          <aside className="space-y-6">
            <article className="rounded-[30px] bg-white px-7 py-7 shadow-[0_10px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5">
              <div className="flex items-center gap-3 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">
                <Package className="h-4 w-4" />
                Lecture rapide
              </div>
              <h2 className="mt-4 text-[28px] font-bold tracking-[-0.04em] text-[#222]">Ce que comprend la page Tarifs</h2>
              <div className="mt-5 space-y-4">
                {[
                  "Conversion automatique selon votre devise active.",
                  "Visibilite immediate sur la fenetre logistique disponible.",
                  "Comparaison simple entre petits achats et commandes de volume.",
                ].map((item) => (
                  <div key={item} className="rounded-[18px] bg-[#fafafa] px-5 py-4 text-[15px] leading-7 text-[#444] ring-1 ring-black/5">
                    {item}
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[30px] bg-white px-7 py-7 shadow-[0_10px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5">
              <div className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">Modes d&apos;expedition</div>
              <div className="mt-5 space-y-4">
                {freightModes.map((mode) => {
                  const Icon = mode.icon;

                  return (
                    <div key={mode.title} className="rounded-[22px] border border-[#ececec] px-5 py-5">
                      <div className="flex items-center gap-3 text-[#222]">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#fff3ea] text-[#d85300]">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-[19px] font-semibold">{mode.title}</div>
                          <div className="text-[14px] text-[#777]">Transit estime: {mode.eta}</div>
                        </div>
                      </div>
                      <p className="mt-4 text-[15px] leading-7 text-[#555]">{mode.description}</p>
                    </div>
                  );
                })}
              </div>
            </article>
          </aside>
        </section>

        <section className="rounded-[30px] bg-white px-7 py-7 shadow-[0_10px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">Action rapide</div>
              <h2 className="mt-3 text-[30px] font-bold tracking-[-0.04em] text-[#222]">Passer du tarif affiche au devis fournisseur</h2>
              <p className="mt-2 max-w-[760px] text-[16px] leading-8 text-[#555]">
                Quand un prix vous convient, vous pouvez enchainer directement sur une demande de devis ou revenir vers les fiches produit pour comparer les MOQ et les paliers.
              </p>
            </div>
            <Link href="/quotes" className="inline-flex h-14 items-center justify-center gap-3 rounded-full bg-[#ff6a00] px-8 text-[17px] font-semibold text-white transition hover:bg-[#ec6100]">
              Ouvrir la demande de devis
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </section>
      </div>
    </InternalPageShell>
  );
}