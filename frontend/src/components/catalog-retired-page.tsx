import Link from "next/link";
import { Sparkles } from "lucide-react";

import { InternalPageShell } from "@/components/internal-page-shell";

type CatalogRetiredPageProps = {
  pricing: {
    countryCode: string;
    countryLabel: string;
    currency: { code: string };
    flagEmoji: string;
    languageCode: string;
    languageLabel: string;
    locale: string;
  };
  label: string;
  badge?: string;
  title: string;
  description: string;
  primaryHref?: string;
  primaryLabel?: string;
};

export function CatalogRetiredPage({
  pricing,
  label,
  badge = "Catalogue retire",
  title,
  description,
  primaryHref = "/quotes",
  primaryLabel = "Demander un devis",
}: CatalogRetiredPageProps) {
  return (
    <InternalPageShell pricing={pricing}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#666]">
          <Link href="/" className="transition hover:text-[#ff6a00]">Accueil</Link>
          <span>/</span>
          <span className="font-medium text-[#222]">{label}</span>
        </div>

        <section className="rounded-[30px] bg-white px-6 py-6 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 lg:px-8 lg:py-7">
          <div className="flex flex-col gap-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#fff2e9] px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#d85300]">
                <Sparkles className="h-4 w-4" />
                {badge}
              </div>
              <h1 className="mt-4 text-[28px] font-bold tracking-[-0.05em] text-[#222] sm:text-[34px] lg:text-[42px]">
                {title}
              </h1>
              <p className="mt-3 max-w-[760px] text-[16px] leading-8 text-[#555]">
                {description}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[30px] bg-[linear-gradient(135deg,#fff4ea_0%,#fff 54%,#f6f8fc_100%)] px-6 py-8 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 lg:px-8">
          <div className="max-w-[820px]">
            <h2 className="text-[24px] font-bold tracking-[-0.04em] text-[#222] sm:text-[30px]">Le parcours public passe desormais par la demande</h2>
            <p className="mt-3 text-[16px] leading-8 text-[#555]">
              Les fiches produit publiques ont ete retirees. Pour lancer une recherche produit ou une demande commerciale, utilisez le devis AfriPay et notre accompagnement direct.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={primaryHref} className="inline-flex h-12 items-center justify-center rounded-full bg-[#ff6a00] px-6 text-[15px] font-semibold text-white transition hover:bg-[#e55e00]">
              {primaryLabel}
            </Link>
          </div>
        </section>
      </div>
    </InternalPageShell>
  );
}
