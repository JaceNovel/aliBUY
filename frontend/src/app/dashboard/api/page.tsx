"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import Link from "next/link";
import { BookOpenText, FileCheck2, FileDown, KeyRound, RotateCcw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/Button";
import { CopyField } from "@/components/CopyField";
import { getApiKeys, regenerateApiSecret } from "@/lib/api";
import type { PartnerApiKeys } from "@/types/partner-dashboard";

const PARTNER_DOCS_URL = `${(process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.afripay.space").trim().replace(/\/$/, "")}/api/docs`;

type PartnerDocsPayload = {
  title?: string;
  introduction?: {
    description?: string;
    goal?: string;
  };
  authentication?: {
    description?: string;
    headers?: Record<string, string>;
  };
  base_url?: {
    production?: string;
  };
  guides?: Array<{
    title?: string;
    endpoint?: string;
    description?: string;
    curl?: string;
    response_example?: unknown;
  }>;
  security?: {
    rules?: string[];
  };
  best_practices?: string[];
  webhooks?: {
    events?: string[];
    payload?: unknown;
  };
};

function renderJsonBlock(value: unknown) {
  return JSON.stringify(value, null, 2);
}

async function copyTextToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "true");
  input.style.position = "fixed";
  input.style.left = "-9999px";
  document.body.appendChild(input);
  input.select();

  const copied = document.execCommand("copy");
  document.body.removeChild(input);

  if (!copied) {
    throw new Error("Copie indisponible.");
  }
}

export default function DashboardApiPage() {
  const [keys, setKeys] = useState<PartnerApiKeys | null>(null);
  const [docs, setDocs] = useState<PartnerDocsPayload | null>(null);
  const [query, setQuery] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateMessage, setRegenerateMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getApiKeys().then((payload) => {
      if (alive) {
        setKeys(payload);
      }
    }).catch(() => undefined);

    fetch(PARTNER_DOCS_URL, { cache: "no-store" }).then(async (response) => {
      if (!response.ok) {
        throw new Error("Impossible de charger la documentation.");
      }

      return response.json() as Promise<PartnerDocsPayload>;
    }).then((payload) => {
      if (alive) {
        setDocs(payload);
      }
    }).catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  const guides = (docs?.guides ?? []).filter((guide) => {
    const haystack = [guide.title, guide.endpoint, guide.description].join(" ").toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });
  const revealableSecret = keys?.revealableSecret?.trim() ? keys.revealableSecret : undefined;
  const secretHint = revealableSecret
    ? "Le secret est masque par defaut. Vous pouvez l afficher ou le copier pour votre backend."
    : "Le secret historique n est pas disponible en clair. Regenerer un nouveau secret pour le copier a nouveau.";

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(129,140,248,0.2),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(15,23,42,0.88))] p-6 shadow-[0_30px_80px_rgba(2,6,23,0.42)] sm:p-7">
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr] xl:items-end">
          <div>
            <div className="text-sm uppercase tracking-[0.24em] text-[#a5b4fc]">API Console</div>
            <h2 className="mt-2 text-[32px] font-black tracking-[-0.06em] text-white">Documentation, credentials et guides d integration</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#cbd5e1]">La page a ete restructuree comme une vraie console developpeur: acces rapide aux cles, recherche dans les endpoints, guides techniques et documents partner sans cartes decoratives inutiles.</p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
            <label className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-[#0c152b] px-4 py-3 text-sm text-[#cbd5e1]">
              <Search className="h-4 w-4 text-[#a5b4fc]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher un endpoint, un guide ou une ressource"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#64748b]"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#94a3b8]">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">{docs?.base_url?.production ?? PARTNER_DOCS_URL}</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">{guides.length} guide(s)</span>
            </div>
          </div>
        </div>
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

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4 rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_30px_70px_rgba(2,6,23,0.35)]">
          {!keys ? <div className="h-44 animate-pulse rounded-2xl bg-white/[0.04]" /> : (
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
              <div className="flex flex-wrap items-center gap-3 rounded-[22px] border border-white/10 bg-[#0c152b] p-4 text-sm text-[#9fb0cd]">
                <Button
                  variant="secondary"
                  className="h-12 rounded-[16px] px-4"
                  disabled={regenerating}
                  onClick={async () => {
                    try {
                      setRegenerating(true);
                      setRegenerateMessage(null);
                      const payload = await regenerateApiSecret();
                      setKeys(payload);
                      const nextSecret = payload.revealableSecret?.trim();
                      if (nextSecret) {
                        await copyTextToClipboard(nextSecret);
                        setRegenerateMessage("Nouveau secret genere et copie. Remplace l ancien dans ton backend.");
                      } else {
                        setRegenerateMessage("Nouveau secret genere. Affiche-le puis copie-le pour remplacer l ancien dans ton backend.");
                      }
                    } catch {
                      setRegenerateMessage("La regeneration a echoue. Reessaie apres avoir recharge la session.");
                    } finally {
                      setRegenerating(false);
                    }
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                  {regenerating ? "Generation..." : revealableSecret ? "Regenerer le secret" : "Regenerer et copier le secret"}
                </Button>
                <div className="max-w-[420px] text-xs leading-6 text-[#8ea0c0]">Si le secret est masque et non copiable, regenere-le ici: le nouveau secret sera affiche et copie automatiquement pour ton backend.</div>
                {regenerateMessage ? <div className="w-full text-xs font-medium text-[#bbf7d0]">{regenerateMessage}</div> : null}
              </div>
            </>
          )}
        </div>

        <div className="grid gap-4">
          <div className="space-y-4 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(34,197,94,0.12),rgba(15,23,42,0.88))] p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#22c55e]/15 text-[#86efac]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-semibold text-white">Securite partner</div>
              <p className="mt-2 text-sm leading-7 text-[#cbd5e1]">Le secret reste un credential serveur. La console montre un masque de type ************************c68iqy et autorise la copie du vrai secret uniquement quand il existe ou vient d etre regenere.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0d162d] p-4 text-sm text-[#8ea0c0]">
              <div className="flex items-center gap-2 font-semibold text-white"><KeyRound className="h-4 w-4 text-[#818cf8]" /> Headers requis</div>
              <div className="mt-3 space-y-2 font-mono text-xs">
                {Object.entries(docs?.authentication?.headers ?? { "X-APP-KEY": "afripay_live_xxx", "X-APP-SECRET": "sk_live_xxx" }).map(([key, value]) => (
                  <div key={key}>{key}: {value}</div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_30px_70px_rgba(2,6,23,0.35)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a5b4fc]">Apercu docs</div>
            <div className="mt-3 text-2xl font-black tracking-[-0.04em] text-white">{docs?.title ?? "AfriPay API Documentation"}</div>
            <p className="mt-3 text-sm leading-7 text-[#cbd5e1]">{docs?.introduction?.description ?? "Charge les produits, cree les commandes, redirige le paiement et recois les evenements webhooks depuis une seule integration."}</p>
            <div className="mt-4 rounded-[22px] border border-white/10 bg-[#0c152b] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#86efac]">Objectif</div>
              <p className="mt-2 text-sm leading-7 text-[#cbd5e1]">{docs?.introduction?.goal ?? "Permettre une integration en moins d une heure."}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_30px_70px_rgba(2,6,23,0.35)]">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a5b4fc]">Navigation</div>
          <div className="mt-4 space-y-2 text-sm">
            <a href="#guides" className="block rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-3 text-white transition hover:bg-white/[0.06]">Guides techniques</a>
            <a href="#authentication" className="block rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-3 text-white transition hover:bg-white/[0.06]">Authentification</a>
            <a href="#webhooks" className="block rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-3 text-white transition hover:bg-white/[0.06]">Webhooks</a>
            <a href="#security" className="block rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-3 text-white transition hover:bg-white/[0.06]">Securite</a>
          </div>
        </div>

        <div className="space-y-4">
          <div id="guides" className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_30px_70px_rgba(2,6,23,0.35)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a5b4fc]">Guides techniques</div>
            <div className="mt-4 space-y-4">
              {guides.length > 0 ? guides.map((guide, index) => (
                <article key={`${guide.endpoint ?? guide.title ?? "guide"}-${index}`} className="rounded-[24px] border border-white/10 bg-[#0c152b] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{guide.title ?? "Guide API"}</h3>
                      <p className="mt-2 text-sm leading-7 text-[#cbd5e1]">{guide.description ?? ""}</p>
                    </div>
                    {guide.endpoint ? <span className="rounded-full border border-[#818cf8]/30 bg-[#818cf8]/10 px-3 py-1 font-mono text-xs text-[#c7d2fe]">{guide.endpoint}</span> : null}
                  </div>
                  {guide.curl ? <pre className="mt-4 overflow-x-auto rounded-[20px] border border-white/10 bg-[#09101f] p-4 text-xs leading-6 text-[#cbd5e1]">{guide.curl.replace(/^\+/gm, "")}</pre> : null}
                  {guide.response_example ? <pre className="mt-4 overflow-x-auto rounded-[20px] border border-white/10 bg-[#09101f] p-4 text-xs leading-6 text-[#8bd3ff]">{renderJsonBlock(guide.response_example)}</pre> : null}
                </article>
              )) : <div className="rounded-[20px] border border-white/10 bg-[#0c152b] p-5 text-sm text-[#8ea0c0]">Aucun guide ne correspond a cette recherche.</div>}
            </div>
          </div>

          <div id="authentication" className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_30px_70px_rgba(2,6,23,0.35)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a5b4fc]">Authentification</div>
            <p className="mt-3 text-sm leading-7 text-[#cbd5e1]">{docs?.authentication?.description ?? "Toutes les requetes doivent etre emises depuis votre backend avec des credentials partner valides."}</p>
            <pre className="mt-4 overflow-x-auto rounded-[20px] border border-white/10 bg-[#09101f] p-4 text-xs leading-6 text-[#cbd5e1]">{renderJsonBlock(docs?.authentication?.headers ?? { "X-APP-KEY": "afripay_live_xxx", "X-APP-SECRET": "sk_live_xxx" })}</pre>
          </div>

          <div id="webhooks" className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_30px_70px_rgba(2,6,23,0.35)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a5b4fc]">Webhooks</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(docs?.webhooks?.events ?? []).map((eventName) => (
                <span key={eventName} className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">{eventName}</span>
              ))}
            </div>
            {docs?.webhooks?.payload ? <pre className="mt-4 overflow-x-auto rounded-[20px] border border-white/10 bg-[#09101f] p-4 text-xs leading-6 text-[#8bd3ff]">{renderJsonBlock(docs.webhooks.payload)}</pre> : null}
          </div>

          <div id="security" className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_30px_70px_rgba(2,6,23,0.35)]">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a5b4fc]">Regles de securite</div>
              <div className="mt-4 space-y-2">
                {(docs?.security?.rules ?? []).map((rule) => (
                  <div key={rule} className="rounded-[18px] border border-white/10 bg-[#0c152b] px-4 py-3 text-sm text-[#cbd5e1]">{rule}</div>
                ))}
              </div>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_30px_70px_rgba(2,6,23,0.35)]">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a5b4fc]">Bonnes pratiques</div>
              <div className="mt-4 space-y-2">
                {(docs?.best_practices ?? []).map((practice) => (
                  <div key={practice} className="rounded-[18px] border border-white/10 bg-[#0c152b] px-4 py-3 text-sm text-[#cbd5e1]">{practice}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
