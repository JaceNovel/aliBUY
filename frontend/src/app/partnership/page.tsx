import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, Shield, Sparkles } from "lucide-react";

import { InternalPageShell } from "@/components/internal-page-shell";
import { PartnerApplicationForm } from "@/components/partner-application-form";
import { getCurrentPartnerPortalAccess, type PartnerPortalAccess } from "@/lib/partner-portal";
import { getPricingContext } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Devenir Partenaire",
  description: "Déposez une demande partenaire AfriPay. L'accès dashboard et les API vendeur ne sont ouverts qu'après validation manuelle du compte.",
};

const highlights = [
  {
    icon: Shield,
    title: "API sécurisée",
    text: "Une intégration propre, protégée et pensée pour vos flux e-commerce.",
  },
  {
    icon: Sparkles,
    title: "Validation manuelle",
    text: "Chaque demande est vérifiée avant ouverture du dashboard privé.",
  },
  {
    icon: CheckCircle2,
    title: "Outils performants",
    text: "Dashboard, wallet, statistiques et clés API dédiées à votre compte.",
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
      <div className="space-y-8">
        <section className="overflow-hidden rounded-[36px] border border-[#dfe9f2] bg-[linear-gradient(180deg,#f7fbff_0%,#f3f9ff_44%,#ffffff_100%)] px-6 py-8 shadow-[0_26px_80px_rgba(17,24,39,0.08)] sm:px-8 sm:py-10 lg:px-10">
          <div className="grid gap-8 xl:grid-cols-[1.08fr_0.92fr] xl:items-center">
            <div className="relative">
              <div className="absolute -left-10 top-2 h-28 w-28 rounded-full bg-[#d6f2eb] blur-3xl" />
              <div className="absolute left-28 top-16 h-20 w-20 rounded-full bg-[#dbeefe] blur-2xl" />
              <div className="relative inline-flex rounded-full border border-[#d7e6f1] bg-white/90 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#119b6a]">
                Partnership Program
              </div>
              <h1 className="relative mt-4 max-w-[760px] text-[40px] font-black tracking-[-0.06em] text-[#142133] sm:text-[56px]">
                Devenir Partenaire
              </h1>
              <p className="mt-4 max-w-[760px] text-[18px] leading-8 text-[#506172]">
                Intégrez notre API et développons ensemble votre activité e-commerce en Afrique.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {highlights.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div key={item.title} className="rounded-[24px] border border-[#e4edf4] bg-white/90 p-5 shadow-[0_12px_28px_rgba(17,24,39,0.04)]">
                      <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#eef8ff] text-[#5ab2d1]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="mt-4 text-[17px] font-bold text-[#142133]">{item.title}</div>
                      <p className="mt-2 text-[14px] leading-7 text-[#5e6b79]">{item.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[30px] border border-[#dde8f0] bg-white/90 p-6 shadow-[0_18px_40px_rgba(17,24,39,0.06)] sm:p-7">
              <div className="flex items-center justify-between gap-3 rounded-[22px] border border-[#e6edf3] bg-[#f8fbfe] px-5 py-4">
                <div>
                  <div className="text-[12px] uppercase tracking-[0.14em] text-[#7b8c99]">Accès après validation</div>
                  <div className="mt-1 text-[18px] font-bold text-[#142133]">`/dashboard` réservé au compte approuvé</div>
                </div>
                <ArrowRight className="h-5 w-5 text-[#119b6a]" />
              </div>

              <div className="mt-4 space-y-4">
                <div className="rounded-[24px] border border-[#e6edf3] bg-[#fafdff] px-5 py-5">
                  <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#119b6a]">Fonctionnement</div>
                  <p className="mt-3 text-[15px] leading-8 text-[#5e6b79]">
                    Cette page est l’entrée publique pour déposer une demande partenaire. Le dashboard vendeur, ses routes et ses données restent masqués jusqu’à validation manuelle du compte.
                  </p>
                </div>
                <div className="rounded-[24px] border border-[#e6edf3] bg-[#fafdff] px-5 py-5">
                  <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#119b6a]">Après approbation</div>
                  <p className="mt-3 text-[15px] leading-8 text-[#5e6b79]">
                    Une fois approuvé, le compte reçoit son espace privé, ses statistiques, son wallet et ses clés API dédiées.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <PartnerApplicationForm
          initialAccess={access}
          loginHref="/login?next=/partner"
          registerHref="/register?next=/partner"
          goLiveHref="/dasboard"
        />
      </div>
    </InternalPageShell>
  );
}
