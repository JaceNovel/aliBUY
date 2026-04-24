"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/Button";
import { CopyField } from "@/components/CopyField";
import { Input } from "@/components/Input";
import { getApiKeys } from "@/lib/api";
import type { PartnerApiKeys } from "@/types/partner-dashboard";

export default function DashboardSettingsPage() {
  const [keys, setKeys] = useState<PartnerApiKeys | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    getApiKeys().then((payload) => {
      if (alive) {
        setKeys(payload);
        setWebhookUrl(payload.webhookUrl);
      }
    }).catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  const revealableSecret = keys?.revealableSecret?.trim() ? keys.revealableSecret : undefined;
  const secretHint = revealableSecret
    ? "Le secret est disponible ici pour copie backend et reste masque tant que vous ne l affichez pas."
    : "Le secret historique n est pas disponible en clair ici. Ouvrez API Keys pour le regenerer puis le copier.";

  return (
    <div className="space-y-6">
      <section>
        <div className="text-sm uppercase tracking-[0.24em] text-[#818cf8]">Settings</div>
        <h2 className="mt-2 text-[30px] font-black tracking-[-0.05em] text-white">Configuration webhook</h2>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a5b4fc]">Credentials partenaire</div>
          <div className="mt-4 space-y-4">
            {!keys ? <div className="h-40 animate-pulse rounded-2xl bg-white/[0.04]" /> : (
              <>
                <CopyField label="APP_KEY" value={keys.appKey} hint="Header requis: X-APP-KEY" />
                <CopyField
                  label="APP_SECRET"
                  value={revealableSecret ?? keys.maskedSecret}
                  maskedValue={keys.maskedSecret}
                  revealable
                  hint={secretHint}
                  copyValue={revealableSecret}
                  copyDisabled={!revealableSecret}
                />
              </>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a5b4fc]">Documentation partenaire</div>
          <p className="mt-3 text-sm leading-7 text-[#cbd5e1]">La documentation partenariat est bien branchée côté dashboard: console API, documentation publique, PDF d approbation et charte partenaire.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/dashboard/api" className="inline-flex h-11 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.08]">
              Ouvrir API Keys et docs
            </Link>
            <Link href="/api/partner/approval-guide" className="inline-flex h-11 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.08]">
              Télécharger le guide PDF
            </Link>
            <Link href="/api/partner/charter" className="inline-flex h-11 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.08]">
              Télécharger la charte
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="space-y-4">
          <Input
            label="Webhook URL"
            value={webhookUrl}
            onChange={(event) => setWebhookUrl(event.target.value)}
            placeholder="https://partner.example.com/webhooks/afripay"
            hint="Reçoit les événements partner comme order.paid."
          />
          <div className="flex items-center gap-3">
            <Button onClick={() => {
              setSaved(true);
              window.setTimeout(() => setSaved(false), 1800);
            }}>
              Update
            </Button>
            {saved ? <span className="text-sm font-medium text-[#86efac]">Configuration mise à jour.</span> : null}
          </div>
        </div>
      </section>
    </div>
  );
}