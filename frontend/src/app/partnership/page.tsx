import type { Metadata } from "next";

import { InternalPageShell } from "@/components/internal-page-shell";
import { PartnerApplicationForm } from "@/components/partner-application-form";
import { getCurrentPartnerPortalAccess, type PartnerPortalAccess } from "@/lib/partner-portal";
import { getPricingContext } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Devenir vendeur",
  description: "Déposez une demande partenaire AfriPay. L'accès dashboard et les API vendeur ne sont ouverts qu'après validation manuelle du compte.",
};

const steps = [
  {
    title: "1. Créez ou connectez votre compte",
    text: "La demande est rattachée à votre compte utilisateur. C’est ce compte exact qui portera ensuite l’accès vendeur et les API dédiées.",
  },
  {
    title: "2. Envoyez votre dossier partenaire",
    text: "Indiquez votre entreprise, votre site et votre modèle de vente. AfriPay vérifie chaque demande avant d’ouvrir un dashboard privé.",
  },
  {
    title: "3. Validation manuelle",
    text: "L’équipe approuve ou refuse le dossier depuis l’admin. Tant que le dossier n’est pas approuvé, `/dashboard` reste fermé et introuvable pour ce compte.",
  },
  {
    title: "4. Ouverture du portail vendeur",
    text: "Une fois approuvé, le compte reçoit son accès à un dashboard cloisonné, ses propres statistiques, son wallet et ses clés API dédiées.",
  },
];

export default async function PartnershipPage() {
  const fallbackAccess: PartnerPortalAccess = {
    status: "guest",
    hasDashboardAccess: false,
    email: null,
    request: null,
    partner: null,
  };

  const [pricing, access] = await Promise.all([
    getPricingContext(),
    getCurrentPartnerPortalAccess().catch(() => fallbackAccess),
  ]);

  return (
    <InternalPageShell pricing={pricing}>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[34px] border border-[#f0dccd] bg-[radial-gradient(circle_at_top_left,#fff0e2_0%,#fff9f3_35%,#ffffff_72%)] px-6 py-8 shadow-[0_26px_80px_rgba(17,24,39,0.08)] sm:px-8 sm:py-10">
          <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
            <div>
              <div className="inline-flex rounded-full border border-[#ffd7bc] bg-white/80 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">
                Partnership Program
              </div>
              <h1 className="mt-4 max-w-[720px] text-[34px] font-black tracking-[-0.06em] text-[#101828] sm:text-[46px]">
                Devenir vendeur AfriPay avec un dashboard privé et des API propres à votre compte
              </h1>
              <p className="mt-4 max-w-[760px] text-[16px] leading-8 text-[#5f6470]">
                Cette page est la seule entrée publique pour déposer une demande partenaire. Le dashboard vendeur, ses routes et ses données restent masqués jusqu’à validation manuelle du compte par l’équipe AfriPay.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-[#f0ded0] bg-white/85 px-5 py-4">
                  <div className="text-[12px] uppercase tracking-[0.14em] text-[#667085]">Accès après validation</div>
                  <div className="mt-2 text-[19px] font-bold text-[#111827]">`/dashboard` réservé au compte approuvé</div>
                </div>
                <div className="rounded-[22px] border border-[#f0ded0] bg-white/85 px-5 py-4">
                  <div className="text-[12px] uppercase tracking-[0.14em] text-[#667085]">Isolation</div>
                  <div className="mt-2 text-[19px] font-bold text-[#111827]">API, wallet et commandes séparés par partenaire</div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-[#efe3d6] bg-white/90 p-6 shadow-[0_18px_40px_rgba(17,24,39,0.06)]">
              <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#111827]">Comment ça marche</div>
              <div className="mt-5 space-y-4">
                {steps.map((step) => (
                  <div key={step.title} className="rounded-[20px] border border-[#edf1f6] bg-[#fbfcfd] px-4 py-4">
                    <div className="text-[16px] font-bold text-[#111827]">{step.title}</div>
                    <div className="mt-2 text-[14px] leading-7 text-[#5f6470]">{step.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <PartnerApplicationForm initialAccess={access} loginHref="/login?next=/partnership" />
      </div>
    </InternalPageShell>
  );
}