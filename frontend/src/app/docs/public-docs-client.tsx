"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpenText, FileCode2, Search, ShieldCheck, Webhook } from "lucide-react";

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

export function PublicDocsClient() {
  const [docs, setDocs] = useState<PartnerDocsPayload | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;

    fetch(PARTNER_DOCS_URL, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Impossible de charger la documentation.");
        }

        return response.json() as Promise<PartnerDocsPayload>;
      })
      .then((payload) => {
        if (alive) {
          setDocs(payload);
        }
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  const guides = useMemo(() => {
    return (docs?.guides ?? []).filter((guide) => {
      const haystack = [guide.title, guide.endpoint, guide.description].join(" ").toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    });
  }, [docs, query]);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f2e7dc_0%,#f7f3ee_16%,#f5f7fb_40%,#eef2f7_100%)] text-[#1f2937]">
      <section className="mx-auto max-w-[1320px] px-4 pb-8 pt-10 sm:px-6 lg:px-8 lg:pb-12 lg:pt-14">
        <div className="overflow-hidden rounded-[32px] border border-[#d8dee8] bg-[radial-gradient(circle_at_top_left,rgba(255,106,0,0.14),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.94))] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-end">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c2410c]">Docs Partenaires</div>
              <h1 className="mt-3 text-[34px] font-black tracking-[-0.06em] text-[#111827] sm:text-[44px]">Brancher le catalogue, les commandes et les webhooks AfriPay depuis une page publique dédiée</h1>
              <p className="mt-4 max-w-3xl text-[15px] leading-7 text-[#475467]">Cette version publique isole la documentation technique sur `/docs` avec recherche, exemples de requêtes, événements webhooks et règles de sécurité. Les clés partenaires restent dans l’espace dashboard.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/partnership" className="inline-flex h-12 items-center justify-center rounded-full bg-[#111827] px-6 text-[14px] font-semibold text-white transition hover:bg-[#1f2937]">Demander un accès partenaire</Link>
                <a href="#guides" className="inline-flex h-12 items-center justify-center rounded-full border border-[#d0d5dd] bg-white px-6 text-[14px] font-semibold text-[#111827] transition hover:border-[#111827]">Voir les guides</a>
              </div>
            </div>

            <div className="rounded-[24px] border border-[#d8dee8] bg-white/80 p-4 backdrop-blur">
              <label className="flex items-center gap-3 rounded-[18px] border border-[#d0d5dd] bg-white px-4 py-3 text-sm text-[#475467]">
                <Search className="h-4 w-4 text-[#c2410c]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rechercher un endpoint, un guide ou une ressource"
                  className="w-full bg-transparent text-sm text-[#111827] outline-none placeholder:text-[#98a2b3]"
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#667085]">
                <span className="rounded-full border border-[#e4e7ec] bg-[#f8fafc] px-3 py-1">{docs?.base_url?.production ?? PARTNER_DOCS_URL}</span>
                <span className="rounded-full border border-[#e4e7ec] bg-[#f8fafc] px-3 py-1">{guides.length} guide(s)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1320px] gap-4 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div className="rounded-[28px] border border-[#d8dee8] bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff1e8] text-[#c2410c]">
            <BookOpenText className="h-5 w-5" />
          </div>
          <div className="mt-4 text-lg font-semibold text-[#111827]">Documentation JSON source</div>
          <p className="mt-2 text-sm leading-7 text-[#475467]">La page se synchronise directement avec `/api/docs` pour rester alignée avec le backend Laravel.</p>
        </div>
        <div className="rounded-[28px] border border-[#d8dee8] bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef4ff] text-[#175cd3]">
            <FileCode2 className="h-5 w-5" />
          </div>
          <div className="mt-4 text-lg font-semibold text-[#111827]">Guides prêts à intégrer</div>
          <p className="mt-2 text-sm leading-7 text-[#475467]">Les exemples `curl`, réponses JSON et conventions d’authentification sont regroupés dans un seul flux lisible.</p>
        </div>
        <div className="rounded-[28px] border border-[#d8dee8] bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ecfdf3] text-[#039855]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="mt-4 text-lg font-semibold text-[#111827]">Clés gardées côté dashboard</div>
          <p className="mt-2 text-sm leading-7 text-[#475467]">Les secrets et la régénération restent côté espace partenaire. Cette page publique expose uniquement la documentation d’intégration.</p>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1320px] gap-4 px-4 py-8 sm:px-6 lg:grid-cols-[0.68fr_1.32fr] lg:px-8 lg:py-10">
        <div className="rounded-[28px] border border-[#d8dee8] bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c2410c]">Navigation</div>
          <div className="mt-4 space-y-2 text-sm">
            <a href="#guides" className="block rounded-[16px] border border-[#e4e7ec] bg-[#f8fafc] px-4 py-3 text-[#111827] transition hover:border-[#c2410c] hover:text-[#c2410c]">Guides techniques</a>
            <a href="#authentication" className="block rounded-[16px] border border-[#e4e7ec] bg-[#f8fafc] px-4 py-3 text-[#111827] transition hover:border-[#c2410c] hover:text-[#c2410c]">Authentification</a>
            <a href="#webhooks" className="block rounded-[16px] border border-[#e4e7ec] bg-[#f8fafc] px-4 py-3 text-[#111827] transition hover:border-[#c2410c] hover:text-[#c2410c]">Webhooks</a>
            <a href="#security" className="block rounded-[16px] border border-[#e4e7ec] bg-[#f8fafc] px-4 py-3 text-[#111827] transition hover:border-[#c2410c] hover:text-[#c2410c]">Sécurité</a>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[28px] border border-[#d8dee8] bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c2410c]">Aperçu</div>
            <div className="mt-3 text-2xl font-black tracking-[-0.04em] text-[#111827]">{docs?.title ?? "AfriPay API Documentation"}</div>
            <p className="mt-3 text-sm leading-7 text-[#475467]">{docs?.introduction?.description ?? "Charge les produits, crée les commandes et consomme les webhooks AfriPay depuis une seule intégration backend."}</p>
            <div className="mt-4 rounded-[22px] border border-[#e4e7ec] bg-[#f8fafc] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#039855]">Objectif</div>
              <p className="mt-2 text-sm leading-7 text-[#475467]">{docs?.introduction?.goal ?? "Permettre une intégration fiable sans dépendre du dashboard partenaire pour lire la doc."}</p>
            </div>
          </div>

          <div id="guides" className="rounded-[28px] border border-[#d8dee8] bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c2410c]">Guides techniques</div>
            <div className="mt-4 space-y-4">
              {guides.length > 0 ? guides.map((guide, index) => (
                <article key={`${guide.endpoint ?? guide.title ?? "guide"}-${index}`} className="rounded-[24px] border border-[#e4e7ec] bg-[#f8fafc] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-[#111827]">{guide.title ?? "Guide API"}</h2>
                      <p className="mt-2 text-sm leading-7 text-[#475467]">{guide.description ?? ""}</p>
                    </div>
                    {guide.endpoint ? <span className="rounded-full border border-[#fed7aa] bg-[#fff7ed] px-3 py-1 font-mono text-xs text-[#c2410c]">{guide.endpoint}</span> : null}
                  </div>
                  {guide.curl ? <pre className="mt-4 overflow-x-auto rounded-[20px] border border-[#e4e7ec] bg-[#101828] p-4 text-xs leading-6 text-[#e5e7eb]">{guide.curl.replace(/^\+/gm, "")}</pre> : null}
                  {guide.response_example ? <pre className="mt-4 overflow-x-auto rounded-[20px] border border-[#e4e7ec] bg-[#0f172a] p-4 text-xs leading-6 text-[#93c5fd]">{renderJsonBlock(guide.response_example)}</pre> : null}
                </article>
              )) : <div className="rounded-[20px] border border-[#e4e7ec] bg-[#f8fafc] p-5 text-sm text-[#667085]">Aucun guide ne correspond à cette recherche.</div>}
            </div>
          </div>

          <div id="authentication" className="rounded-[28px] border border-[#d8dee8] bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c2410c]">Authentification</div>
            <p className="mt-3 text-sm leading-7 text-[#475467]">{docs?.authentication?.description ?? "Toutes les requêtes doivent être émises depuis votre backend avec des credentials partenaires valides."}</p>
            <pre className="mt-4 overflow-x-auto rounded-[20px] border border-[#e4e7ec] bg-[#101828] p-4 text-xs leading-6 text-[#e5e7eb]">{renderJsonBlock(docs?.authentication?.headers ?? { "X-APP-KEY": "afripay_live_xxx", "X-APP-SECRET": "sk_live_xxx" })}</pre>
          </div>

          <div id="webhooks" className="rounded-[28px] border border-[#d8dee8] bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#c2410c]">
              <Webhook className="h-4 w-4" />
              Webhooks
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(docs?.webhooks?.events ?? []).map((eventName) => (
                <span key={eventName} className="rounded-full border border-[#b7ebcd] bg-[#ecfdf3] px-3 py-1 text-xs font-semibold text-[#027a48]">{eventName}</span>
              ))}
            </div>
            {docs?.webhooks?.payload ? <pre className="mt-4 overflow-x-auto rounded-[20px] border border-[#e4e7ec] bg-[#0f172a] p-4 text-xs leading-6 text-[#93c5fd]">{renderJsonBlock(docs.webhooks.payload)}</pre> : null}
          </div>

          <div id="security" className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[28px] border border-[#d8dee8] bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c2410c]">Règles de sécurité</div>
              <div className="mt-4 space-y-2">
                {(docs?.security?.rules ?? []).map((rule) => (
                  <div key={rule} className="rounded-[18px] border border-[#e4e7ec] bg-[#f8fafc] px-4 py-3 text-sm text-[#475467]">{rule}</div>
                ))}
              </div>
            </div>
            <div className="rounded-[28px] border border-[#d8dee8] bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c2410c]">Bonnes pratiques</div>
              <div className="mt-4 space-y-2">
                {(docs?.best_practices ?? []).map((practice) => (
                  <div key={practice} className="rounded-[18px] border border-[#e4e7ec] bg-[#f8fafc] px-4 py-3 text-sm text-[#475467]">{practice}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}