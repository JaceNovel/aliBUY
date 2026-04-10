"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpenText, FileCheck2, FileDown, KeyRound, ShieldCheck } from "lucide-react";

import { CopyField } from "@/components/CopyField";
import { getApiKeys } from "@/lib/api";
import type { PartnerApiKeys } from "@/types/partner-dashboard";

const PARTNER_DOCS_URL = `${(process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.afripay.space").trim().replace(/\/$/, "")}/api/docs`;

export default function DashboardApiPage() {
  const [keys, setKeys] = useState<PartnerApiKeys | null>(null);

  useEffect(() => {
    let alive = true;
    getApiKeys().then((payload) => {
      if (alive) {
        setKeys(payload);
      }
    }).catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <section>
        <div className="text-sm uppercase tracking-[0.24em] text-[#818cf8]">API Keys</div>
        <h2 className="mt-2 text-[30px] font-black tracking-[-0.05em] text-white">Clés d’accès partner</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#cbd5e1]">Votre intégration se pilote depuis cette page. Vous pouvez ouvrir la documentation technique, télécharger le PDF dropshipping AfriPay et récupérer une charte partenaire plus formelle avec les engagements, obligations et conditions de maintien du statut.</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <a
          href={PARTNER_DOCS_URL}
          target="_blank"
          rel="noreferrer"
          className="rounded-2xl border border-[#5b6bff]/25 bg-[linear-gradient(135deg,rgba(67,56,202,0.22),rgba(15,23,42,0.9))] p-5 shadow-[0_30px_70px_rgba(2,6,23,0.35)]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[#c7d2fe]">
            <BookOpenText className="h-5 w-5" />
          </div>
          <div className="mt-4 text-lg font-semibold text-white">Voir la documentation</div>
          <p className="mt-2 text-sm leading-7 text-[#cbd5e1]">Ouvrez la documentation d’intégration AfriPay pour brancher les produits, les commandes, les webhooks et les paiements côté serveur.</p>
        </a>

        <Link
          href="/api/partner/approval-guide"
          className="rounded-2xl border border-[#22c55e]/25 bg-[linear-gradient(135deg,rgba(34,197,94,0.18),rgba(15,23,42,0.9))] p-5 shadow-[0_30px_70px_rgba(2,6,23,0.35)]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[#bbf7d0]">
            <FileDown className="h-5 w-5" />
          </div>
          <div className="mt-4 text-lg font-semibold text-white">Télécharger le PDF dropshipping AfriPay</div>
          <p className="mt-2 text-sm leading-7 text-[#cbd5e1]">Récupérez votre document d’onboarding avec la reconnaissance partenaire, les félicitations officielles et les conditions de conformité à respecter.</p>
        </Link>

        <Link
          href="/api/partner/charter"
          className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(148,163,184,0.18),rgba(15,23,42,0.92))] p-5 shadow-[0_30px_70px_rgba(2,6,23,0.35)]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[#e2e8f0]">
            <FileCheck2 className="h-5 w-5" />
          </div>
          <div className="mt-4 text-lg font-semibold text-white">Télécharger la charte partenaire</div>
          <p className="mt-2 text-sm leading-7 text-[#cbd5e1]">Conservez une version plus formelle du cadre partenaire AfriPay avec reconnaissance, obligations de sécurité et conditions de conformité.</p>
        </Link>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_30px_70px_rgba(2,6,23,0.35)]">
          {!keys ? <div className="h-44 animate-pulse rounded-2xl bg-white/[0.04]" /> : (
            <>
              <CopyField label="APP_KEY" value={keys.appKey} hint="Header requis: X-APP-KEY" />
              <CopyField label="APP_SECRET" value={keys.revealableSecret ?? keys.maskedSecret} maskedValue={keys.maskedSecret} revealable hint="Le secret reste masqué par défaut. Évite de l’exposer dans du code client public." />
            </>
          )}
        </div>

        <div className="space-y-4 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(34,197,94,0.12),rgba(15,23,42,0.88))] p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#22c55e]/15 text-[#86efac]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-semibold text-white">Sécurité partner</div>
            <p className="mt-2 text-sm leading-7 text-[#cbd5e1]">Le secret n’est jamais affiché en clair par défaut. Pour un usage production, conserve-le côté serveur, ajoute une signature HMAC et restreins les IP autorisées.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0d162d] p-4 text-sm text-[#8ea0c0]">
            <div className="flex items-center gap-2 font-semibold text-white"><KeyRound className="h-4 w-4 text-[#818cf8]" /> Headers requis</div>
            <div className="mt-3 space-y-2 font-mono text-xs">
              <div>X-APP-KEY: ******</div>
              <div>X-APP-SECRET: ******</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}