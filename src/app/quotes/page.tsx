import { FileUp, PackageSearch, Send, Sparkles } from "lucide-react";

import { InternalPageShell } from "@/components/internal-page-shell";
import { getPricingContext } from "@/lib/pricing";

const recentRequests = [
  { title: "Souris gaming personnalisables", qty: "2 000 pieces", status: "Analyse fournisseurs" },
  { title: "Bureaux gaming LED fibre carbone", qty: "120 sets", status: "Devis recus" },
  { title: "Kits casques VR pour salle d'arcade", qty: "40 unites", status: "En attente" },
];

export default async function QuotesPage() {
  const pricing = await getPricingContext();

  return (
    <InternalPageShell pricing={pricing}>
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr] xl:gap-6">
        <section className="rounded-[22px] bg-white px-4 py-5 shadow-[0_8px_30px_rgba(24,39,75,0.05)] ring-1 ring-black/5 sm:rounded-[30px] sm:px-8 sm:py-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#fff2e9] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#d85300] sm:px-4 sm:py-2 sm:text-[13px] sm:tracking-[0.16em]">
            <Sparkles className="h-4 w-4" />
            Demande de devis
          </div>
          <h1 className="mt-4 text-[26px] font-bold tracking-[-0.05em] text-[#222] sm:mt-5 sm:text-[42px]">Decrivez votre besoin fournisseur</h1>
          <p className="mt-2.5 max-w-[760px] text-[14px] leading-6 text-[#555] sm:mt-3 sm:text-[17px] sm:leading-8">
            Envoyez une demande claire a plusieurs fournisseurs en une seule fois. AfriPay regroupe vos specifications, votre cible prix et votre fenetre logistique.
          </p>

          <div className="mt-5 grid gap-4 sm:mt-8 sm:gap-5 md:grid-cols-2">
            <label className="space-y-1.5 sm:space-y-2 text-[13px] font-semibold text-[#333] sm:text-[15px]">
              <span>Nom du produit</span>
              <input className="h-11 w-full rounded-[14px] border border-[#dde2ea] px-3.5 text-[14px] outline-none focus:border-[#ff6a00] sm:h-14 sm:rounded-[16px] sm:px-5 sm:text-[16px]" defaultValue="Souris gaming RGB" />
            </label>
            <label className="space-y-1.5 sm:space-y-2 text-[13px] font-semibold text-[#333] sm:text-[15px]">
              <span>Quantite cible</span>
              <input className="h-11 w-full rounded-[14px] border border-[#dde2ea] px-3.5 text-[14px] outline-none focus:border-[#ff6a00] sm:h-14 sm:rounded-[16px] sm:px-5 sm:text-[16px]" defaultValue="2000 pieces" />
            </label>
            <label className="space-y-1.5 sm:space-y-2 text-[13px] font-semibold text-[#333] sm:text-[15px] md:col-span-2">
              <span>Specifications</span>
              <textarea className="min-h-[132px] w-full rounded-[14px] border border-[#dde2ea] px-3.5 py-3 text-[14px] outline-none focus:border-[#ff6a00] sm:min-h-[180px] sm:rounded-[16px] sm:px-5 sm:py-4 sm:text-[16px]" defaultValue="Capteur optique haute precision, logo personnalise, emballage OEM, connectivite USB-C ou 2.4G, echantillon requis avant production de masse." />
            </label>
            <label className="space-y-1.5 sm:space-y-2 text-[13px] font-semibold text-[#333] sm:text-[15px]">
              <span>Budget cible</span>
              <input className="h-11 w-full rounded-[14px] border border-[#dde2ea] px-3.5 text-[14px] outline-none focus:border-[#ff6a00] sm:h-14 sm:rounded-[16px] sm:px-5 sm:text-[16px]" defaultValue={`${pricing.currency.code} 8.00 / unite max`} />
            </label>
            <label className="space-y-1.5 sm:space-y-2 text-[13px] font-semibold text-[#333] sm:text-[15px]">
              <span>Fenetre logistique</span>
              <input className="h-11 w-full rounded-[14px] border border-[#dde2ea] px-3.5 text-[14px] outline-none focus:border-[#ff6a00] sm:h-14 sm:rounded-[16px] sm:px-5 sm:text-[16px]" defaultValue={pricing.shippingWindow} />
            </label>
          </div>

          <div className="mt-5 grid gap-3 sm:mt-6 sm:gap-4 sm:grid-cols-2">
            <button className="flex h-11 items-center justify-center gap-2.5 rounded-[14px] border border-dashed border-[#cfd6e1] bg-[#fafafa] px-3 text-[13px] font-semibold text-[#333] transition hover:border-[#ff6a00] hover:text-[#ff6a00] sm:h-14 sm:gap-3 sm:rounded-[18px] sm:text-[16px]">
              <FileUp className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="sm:hidden">Cahier des charges</span>
              <span className="hidden sm:inline">Ajouter un cahier des charges</span>
            </button>
            <button className="flex h-11 items-center justify-center gap-2.5 rounded-[14px] border border-dashed border-[#cfd6e1] bg-[#fafafa] px-3 text-[13px] font-semibold text-[#333] transition hover:border-[#ff6a00] hover:text-[#ff6a00] sm:h-14 sm:gap-3 sm:rounded-[18px] sm:text-[16px]">
              <PackageSearch className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="sm:hidden">References produit</span>
              <span className="hidden sm:inline">Ajouter des references produit</span>
            </button>
          </div>

          <button className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-full bg-[#ff6a00] px-5 text-[14px] font-semibold text-white transition hover:bg-[#ef6100] sm:mt-8 sm:h-14 sm:w-auto sm:gap-3 sm:px-8 sm:text-[18px]">
            <Send className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="sm:hidden">Envoyer le devis</span>
            <span className="hidden sm:inline">Envoyer ma demande de devis</span>
          </button>
        </section>

        <aside className="space-y-4 sm:space-y-6">
          <article className="rounded-[22px] bg-[linear-gradient(145deg,#22120d_0%,#552313_48%,#d34a00_100%)] px-4 py-5 text-white shadow-[0_20px_48px_rgba(66,31,12,0.2)] sm:rounded-[28px] sm:px-7 sm:py-7">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70 sm:text-[13px] sm:tracking-[0.18em]">Contexte actif</div>
            <div className="mt-4 text-[24px] font-bold tracking-[-0.05em] sm:mt-5 sm:text-[32px]">{pricing.flagEmoji} {pricing.countryLabel}</div>
            <div className="mt-2 text-[13px] text-white/78 sm:mt-3 sm:text-[16px]">{pricing.languageLabel} · {pricing.currency.code}</div>
            <div className="mt-4 rounded-[16px] bg-white/10 px-3.5 py-3 text-[13px] leading-5 text-white/86 sm:mt-6 sm:rounded-[18px] sm:px-4 sm:py-4 sm:text-[15px] sm:leading-7">
              Vos devis utilisent automatiquement votre contexte pays, devise et delai logistique.
            </div>
          </article>

          <article className="rounded-[22px] bg-white px-4 py-5 shadow-[0_8px_30px_rgba(24,39,75,0.05)] ring-1 ring-black/5 sm:rounded-[28px] sm:px-7 sm:py-7">
            <h2 className="text-[20px] font-bold tracking-[-0.04em] text-[#222] sm:text-[24px]">Demandes recentes</h2>
            <div className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
              {recentRequests.map((request) => (
                <div key={request.title} className="rounded-[16px] bg-[#fafafa] px-4 py-3.5 ring-1 ring-black/5 sm:rounded-[20px] sm:px-5 sm:py-4">
                  <div className="text-[15px] font-semibold leading-5 text-[#222] sm:text-[18px]">{request.title}</div>
                  <div className="mt-1.5 text-[13px] text-[#666] sm:mt-2 sm:text-[15px]">{request.qty}</div>
                  <div className="mt-2.5 inline-flex rounded-full bg-[#fff2e9] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#d85300] sm:mt-3 sm:px-3 sm:text-[12px] sm:tracking-[0.12em]">
                    {request.status}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </div>
    </InternalPageShell>
  );
}