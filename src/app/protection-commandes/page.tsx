import Link from "next/link";
import {
  ArrowRight,
  CircleDollarSign,
  ShieldCheck,
  Truck,
  Wrench,
} from "lucide-react";

import { InternalPageShell } from "@/components/internal-page-shell";
import { getMessages } from "@/lib/messages";
import { getPricingContext } from "@/lib/pricing";

const protectionSections = [
  {
    id: "paiements-securises",
    title: "Paiements securises",
    description:
      "Chaque commande passe par un circuit controle avec verification du montant, validation de la commande et confirmation avant la remise finale.",
    bullets: [
      "Verification du paiement avant lancement fournisseur.",
      "Historique clair des etapes de commande.",
      "Confirmation finale avant remise ou livraison.",
    ],
    ctaLabel: "Voir mes commandes",
    href: "/orders",
    icon: ShieldCheck,
  },
  {
    id: "remboursements",
    title: "Politique de remboursement",
    description:
      "En cas d'incident documente, l'equipe peut analyser le dossier, verifier les preuves disponibles et traiter une issue adaptee a la commande concernee.",
    bullets: [
      "Analyse des preuves de paiement et de livraison.",
      "Traitement des ecarts constates sur la commande.",
      "Suivi des decisions depuis votre espace client.",
    ],
    ctaLabel: "Consulter les preuves",
    href: "/orders/remittance-proof",
    icon: CircleDollarSign,
  },
  {
    id: "logistique",
    title: "Services logistiques",
    description:
      "Le suivi logistique couvre l'acheminement, les confirmations d'etapes et la consultation des informations utiles jusqu'a la reception.",
    bullets: [
      "Suivi du transit et des statuts de commande.",
      "Acces aux preuves de livraison quand elles existent.",
      "Coordination des echanges depuis la messagerie liee a la commande.",
    ],
    ctaLabel: "Suivre une commande",
    href: "/orders/tracking",
    icon: Truck,
  },
  {
    id: "apres-vente",
    title: "Protections apres-vente",
    description:
      "Apres la reception, vous gardez des points d'action pour confirmer la livraison, signaler un besoin et poursuivre les echanges sur votre dossier.",
    bullets: [
      "Confirmation de reception depuis votre compte.",
      "Conversation support rattachee a la commande.",
      "Suivi simple des actions post-livraison.",
    ],
    ctaLabel: "Ouvrir mes messages",
    href: "/messages",
    icon: Wrench,
  },
] as const;

export default async function OrderProtectionPage() {
  const pricing = await getPricingContext();
  const messages = getMessages(pricing.languageCode);

  return (
    <InternalPageShell pricing={pricing}>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#666] sm:text-[13px]">
          <Link href="/" className="transition hover:text-[#ff6a00]">Accueil</Link>
          <span>/</span>
          <span className="font-medium text-[#222]">{messages.nav.orderProtection}</span>
        </div>

        <section className="overflow-hidden rounded-[22px] bg-[linear-gradient(135deg,#171717_0%,#402013_45%,#ff6a00_100%)] px-3.5 py-5 text-white shadow-[0_18px_42px_rgba(17,24,39,0.16)] sm:rounded-[32px] sm:px-8 sm:py-10 sm:shadow-[0_24px_70px_rgba(17,24,39,0.18)] lg:px-10">
          <div className="grid gap-4 sm:gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <div className="inline-flex max-w-full items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/84 sm:px-4 sm:py-2 sm:text-[12px]">
                <ShieldCheck className="h-4 w-4" />
                {messages.nav.orderProtection}
              </div>
              <h1 className="mt-3 max-w-[780px] text-[24px] font-black leading-[1.08] tracking-[-0.05em] sm:mt-5 sm:text-[54px]">
                Paiement, suivi, livraison et assistance regroupes sur une meme page.
              </h1>
              <p className="mt-2 max-w-[760px] text-[13px] leading-6 text-white/82 sm:mt-4 sm:text-[17px] sm:leading-8">
                Cette page centralise les garanties visibles pour vos commandes afin que chaque action importante reste accessible en un clic: paiement, remboursement, logistique et apres-vente.
              </p>
            </div>

            <article className="rounded-[18px] bg-white/10 p-3.5 backdrop-blur-sm ring-1 ring-white/15 sm:rounded-[26px] sm:p-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/74 sm:text-[13px]">Acces rapides</div>
              <div className="mt-3 grid gap-2 sm:mt-4 sm:gap-3">
                {protectionSections.map((section) => (
                  <Link
                    key={section.id}
                    href={`#${section.id}`}
                    className="flex min-w-0 items-center justify-between rounded-[16px] bg-black/12 px-3.5 py-3 text-[12px] font-semibold text-white transition hover:bg-black/18 sm:rounded-[18px] sm:px-4 sm:text-[14px]"
                  >
                    <span className="pr-3">{section.title}</span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </Link>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
          {protectionSections.map((section) => {
            const Icon = section.icon;

            return (
              <Link
                key={section.id}
                href={`#${section.id}`}
                className="rounded-[20px] bg-white p-4 shadow-[0_12px_32px_rgba(17,24,39,0.06)] ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(17,24,39,0.12)] sm:rounded-[26px] sm:p-6"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#fff1e8] text-[#ff6a00] sm:h-12 sm:w-12">
                  <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <h2 className="mt-3 text-[17px] font-bold tracking-[-0.03em] text-[#222] sm:mt-4 sm:text-[20px]">{section.title}</h2>
                <p className="mt-2 text-[12px] leading-6 text-[#5f6470] sm:mt-3 sm:text-[14px] sm:leading-7">{section.description}</p>
              </Link>
            );
          })}
        </section>

        <section className="space-y-4 sm:space-y-5">
          {protectionSections.map((section) => {
            const Icon = section.icon;

            return (
              <article
                key={section.id}
                id={section.id}
                className="rounded-[22px] bg-white px-4 py-4 shadow-[0_14px_34px_rgba(17,24,39,0.06)] ring-1 ring-black/5 sm:rounded-[30px] sm:px-8 sm:py-8"
              >
                <div className="flex flex-col gap-5 sm:gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 max-w-[780px]">
                    <div className="flex items-center gap-3 text-[#ff6a00]">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fff1e8] sm:h-11 sm:w-11">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] sm:text-[13px]">Protection active</div>
                    </div>
                    <h3 className="mt-3 text-[20px] font-bold tracking-[-0.03em] text-[#222] sm:mt-4 sm:text-[28px]">{section.title}</h3>
                    <p className="mt-2 text-[13px] leading-6 text-[#5f6470] sm:mt-3 sm:text-[15px] sm:leading-8">{section.description}</p>
                    <div className="mt-4 grid gap-3 sm:mt-5 sm:grid-cols-3">
                      {section.bullets.map((bullet) => (
                        <div key={bullet} className="rounded-[15px] bg-[#faf7f3] px-3.5 py-3 text-[12px] leading-5 text-[#3f3f46] ring-1 ring-black/5 sm:rounded-[18px] sm:px-4 sm:text-[14px] sm:leading-6">
                          {bullet}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="w-full min-w-0 rounded-[18px] bg-[#111827] p-4 text-white shadow-[0_18px_40px_rgba(17,24,39,0.18)] sm:max-w-[280px] sm:rounded-[24px] sm:p-5">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/64">Action</div>
                    <div className="mt-2 text-[20px] font-bold tracking-[-0.04em] sm:mt-3 sm:text-[22px]">{section.title}</div>
                    <p className="mt-2 text-[13px] leading-6 text-white/72 sm:mt-3 sm:text-[14px] sm:leading-7">
                      Ouvrez la zone la plus utile pour poursuivre votre commande sans chercher dans plusieurs pages.
                    </p>
                    <Link
                      href={section.href}
                      className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#ff6a00] px-5 text-[13px] font-semibold text-white transition hover:bg-[#eb6200] sm:mt-5 sm:h-12 sm:text-[14px]"
                    >
                      {section.ctaLabel}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </InternalPageShell>
  );
}