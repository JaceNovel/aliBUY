import { Sparkles } from "lucide-react";

import { QuoteRequestForm } from "@/components/quote-request-form";
import { InternalPageShell } from "@/components/internal-page-shell";
import { getUserQuoteRequests } from "@/lib/customer-data-store";
import { getPricingContext } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/user-auth";

export default async function QuotesPage() {
  const pricing = await getPricingContext();
  const user = await getCurrentUser();
  const recentRequests = user ? await getUserQuoteRequests(user.id) : [];

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
          <QuoteRequestForm currencyCode={pricing.currency.code} shippingWindow={pricing.shippingWindow} />
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
              {recentRequests.length === 0 ? <div className="rounded-[16px] bg-[#fafafa] px-4 py-4 text-[14px] text-[#666] ring-1 ring-black/5">Aucune demande n&apos;a encore ete envoyee depuis ce compte.</div> : recentRequests.map((request) => (
                <div key={request.id} className="rounded-[16px] bg-[#fafafa] px-4 py-3.5 ring-1 ring-black/5 sm:rounded-[20px] sm:px-5 sm:py-4">
                  <div className="text-[15px] font-semibold leading-5 text-[#222] sm:text-[18px]">{request.productName}</div>
                  <div className="mt-1.5 text-[13px] text-[#666] sm:mt-2 sm:text-[15px]">{request.quantity}</div>
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