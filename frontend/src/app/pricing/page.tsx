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

        <section className="overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#1d1612_0%,#572815_48%,#ff6a00_100%)] px-4 py-5 text-white shadow-[0_18px_36px_rgba(81,35,12,0.22)] sm:rounded-[32px] sm:px-7 sm:py-8 sm:shadow-[0_24px_60px_rgba(81,35,12,0.28)] lg:px-10 lg:py-10">
          <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr] xl:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/86 sm:px-4 sm:py-2 sm:text-[13px] sm:tracking-[0.16em]">
                <Sparkles className="h-4 w-4" />
                {messages.pricing.heading}
              </div>
              <h1 className="mt-4 max-w-[760px] text-[26px] font-bold leading-[1.06] tracking-[-0.05em] sm:mt-5 sm:text-[52px]">
                Page de tarification selon votre pays, votre devise et votre fenetre logistique.
              </h1>
              <p className="mt-3 max-w-[760px] text-[13px] leading-5 text-white/82 sm:mt-4 sm:text-[17px] sm:leading-8">
                AfriPay affiche vos tarifs dans votre devise locale, avec conversion serveur et contexte de livraison deja applique. Vous gardez une lecture claire du cout produit avant de commander.
              </p>
              <div className="mt-5 flex flex-col gap-2.5 sm:mt-7 sm:flex-row sm:flex-wrap sm:gap-3">
                <Link href="/quotes" className="inline-flex h-11 items-center justify-center rounded-full bg-[#ffd9c2] px-5 text-[13px] font-semibold text-[#5a240d] shadow-[0_10px_24px_rgba(0,0,0,0.12)] transition hover:bg-[#ffc59f] sm:h-13 sm:px-7 sm:text-[16px]">
                  Demander un devis
                </Link>
                <Link href="/" className="inline-flex h-11 items-center justify-center rounded-full border border-[#f0b58d] bg-[#6c3319] px-5 text-[13px] font-semibold text-white transition hover:bg-[#7a3b1d] sm:h-13 sm:px-7 sm:text-[16px]">
                  Retour aux produits
                </Link>
              </div>
            </div>

            <article className="rounded-[20px] bg-white/10 px-4 py-4 backdrop-blur-sm ring-1 ring-white/14 sm:rounded-[28px] sm:px-6 sm:py-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/72 sm:text-[13px] sm:tracking-[0.16em]">Contexte actif</div>
              <div className="mt-3 text-[22px] font-bold tracking-[-0.04em] text-white sm:mt-4 sm:text-[30px]">{pricing.flagEmoji} {pricing.countryLabel}</div>
              <div className="mt-1 text-[13px] text-white/78 sm:mt-2 sm:text-[16px]">{pricing.languageLabel}</div>
              <div className="mt-4 space-y-2.5 text-[13px] text-white/86 sm:mt-5 sm:space-y-3 sm:text-[15px]">
                <div className="flex items-center justify-between gap-4 rounded-[16px] bg-black/14 px-3.5 py-3 sm:rounded-[18px] sm:px-4">
                  <span>{messages.pricing.conversion}</span>
                  <span className="font-semibold">{pricing.exchangeLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-[16px] bg-black/14 px-3.5 py-3 sm:rounded-[18px] sm:px-4">
                  <span>{messages.pricing.logisticsWindow}</span>
                  <span className="font-semibold">{pricing.shippingWindow}</span>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr] sm:gap-6">
          <article className="bg-transparent px-0 py-0 shadow-none ring-0 sm:rounded-[30px] sm:bg-white sm:px-7 sm:py-7 sm:shadow-[0_10px_36px_rgba(24,39,75,0.06)] sm:ring-1 sm:ring-black/5">
            <div className="flex items-center gap-3 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">
              <CircleDollarSign className="h-4 w-4" />
              Tarifs affiches
            </div>
            <h2 className="mt-3 text-[22px] font-bold tracking-[-0.04em] text-[#222] sm:mt-4 sm:text-[30px]">Exemples de prix contextualises</h2>
            <p className="mt-2 max-w-[760px] text-[13px] leading-5 text-[#555] sm:mt-3 sm:text-[16px] sm:leading-8">
              Les montants ci-dessous montrent comment un tarif usine en USD est affiche directement dans votre devise actuelle, avec le meme moteur serveur que sur les fiches produit.
            </p>

            <div className="mt-5 overflow-hidden rounded-[20px] border border-[#ececec] sm:mt-7 sm:rounded-[24px]">
              <div className="hidden grid-cols-[minmax(0,1.2fr)_0.75fr_0.9fr] bg-[#faf7f3] px-5 py-4 text-[13px] font-semibold uppercase tracking-[0.14em] text-[#7d6b5f] sm:grid">
                <div>Produit</div>
                <div>Base USD</div>
                <div>Prix local</div>
              </div>
              {pricingRows.map((row, index) => (
                <div key={row.label} className={["px-4 py-4 sm:grid sm:grid-cols-[minmax(0,1.2fr)_0.75fr_0.9fr] sm:items-center sm:gap-3 sm:px-5 sm:py-5", index > 0 ? "border-t border-[#ececec]" : ""].join(" ")}>
                  <div>
                    <div className="text-[15px] font-semibold text-[#222] sm:text-[18px]">{row.label}</div>
                    <div className="mt-1 text-[12px] text-[#666] sm:text-[14px]">{row.note}</div>
                  </div>
                  <div className="mt-2 text-[13px] font-semibold text-[#555] sm:mt-0 sm:text-[17px]">Base: ${row.baseUsd.toFixed(2)}</div>
                  <div className="mt-1 text-[18px] font-bold tracking-[-0.04em] text-[#f05a00] sm:mt-0 sm:text-[22px]">{pricing.formatPrice(row.baseUsd)}</div>
                </div>
              ))}
            </div>
          </article>

          <aside className="space-y-4 sm:space-y-6">
            <article className="bg-transparent px-0 py-0 shadow-none ring-0 sm:rounded-[30px] sm:bg-white sm:px-7 sm:py-7 sm:shadow-[0_10px_36px_rgba(24,39,75,0.06)] sm:ring-1 sm:ring-black/5">
              <div className="flex items-center gap-3 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">
                <Package className="h-4 w-4" />
                Lecture rapide
              </div>
              <h2 className="mt-3 text-[22px] font-bold tracking-[-0.04em] text-[#222] sm:mt-4 sm:text-[28px]">Ce que comprend la page Tarifs</h2>
              <div className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
                {[
                  "Conversion automatique selon votre devise active.",
                  "Visibilite immediate sur la fenetre logistique disponible.",
                  "Comparaison simple entre petits achats et commandes de volume.",
                ].map((item) => (
                  <div key={item} className="rounded-[16px] bg-[#fafafa] px-4 py-3 text-[13px] leading-5 text-[#444] ring-1 ring-black/5 sm:rounded-[18px] sm:px-5 sm:py-4 sm:text-[15px] sm:leading-7">
                    {item}
                  </div>
                ))}
              </div>
            </article>

            <article className="bg-transparent px-0 py-0 shadow-none ring-0 sm:rounded-[30px] sm:bg-white sm:px-7 sm:py-7 sm:shadow-[0_10px_36px_rgba(24,39,75,0.06)] sm:ring-1 sm:ring-black/5">
              <div className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">Modes d&apos;expedition</div>
              <div className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
                {freightModes.map((mode) => {
                  const Icon = mode.icon;

                  return (
                    <div key={mode.title} className="rounded-[18px] border border-[#ececec] px-4 py-4 sm:rounded-[22px] sm:px-5 sm:py-5">
                      <div className="flex items-center gap-3 text-[#222]">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fff3ea] text-[#d85300] sm:h-11 sm:w-11">
                          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                        </div>
                        <div>
                          <div className="text-[16px] font-semibold sm:text-[19px]">{mode.title}</div>
                          <div className="text-[12px] text-[#777] sm:text-[14px]">Transit estime: {mode.eta}</div>
                        </div>
                      </div>
                      <p className="mt-3 text-[13px] leading-5 text-[#555] sm:mt-4 sm:text-[15px] sm:leading-7">{mode.description}</p>
                    </div>
                  );
                })}
              </div>
            </article>
          </aside>
        </section>

        <section className="bg-transparent px-0 py-0 shadow-none ring-0 sm:rounded-[30px] sm:bg-white sm:px-7 sm:py-7 sm:shadow-[0_10px_36px_rgba(24,39,75,0.06)] sm:ring-1 sm:ring-black/5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#d85300] sm:text-[13px] sm:tracking-[0.16em]">Action rapide</div>
              <h2 className="mt-2 text-[22px] font-bold tracking-[-0.04em] text-[#222] sm:mt-3 sm:text-[30px]">Passer du tarif affiche au devis fournisseur</h2>
              <p className="mt-2 max-w-[760px] text-[13px] leading-5 text-[#555] sm:text-[16px] sm:leading-8">
                Quand un prix vous convient, vous pouvez enchainer directement sur une demande de devis ou revenir vers les fiches produit pour comparer les MOQ et les paliers.
              </p>
            </div>
            <Link href="/quotes" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#ff6a00] px-5 text-[13px] font-semibold text-white transition hover:bg-[#ec6100] sm:h-14 sm:w-auto sm:gap-3 sm:px-8 sm:text-[17px]">
              Ouvrir la demande de devis
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </Link>
          </div>
        </section>
      </div>
    </InternalPageShell>
  );
}