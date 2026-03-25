"use client";

import { Save, Sparkles } from "lucide-react";
import { useState } from "react";

type ProductOption = {
  slug: string;
  title: string;
  minUsd: number;
  supplierName: string;
};

type FreeDealAdminConfig = {
  id: string;
  enabled: boolean;
  pageTitle: string;
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  bannerText: string;
  ctaLabel: string;
  shareTitle: string;
  shareDescription: string;
  itemLimit: number;
  fixedPriceEur: number;
  referralGoal: number;
  dealTagText: string;
  productBadgeText: string;
  compareAtMultiplier: number;
  compareAtExtraEur: number;
  productSlugs: string[];
  updatedAt: string;
  createdAt: string;
};

function formatSlugList(value: string[]) {
  return value.join(", ");
}

function parseSlugList(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function AdminFreeDealsClient({
  initialConfig,
  productOptions,
  metrics,
}: {
  initialConfig: FreeDealAdminConfig;
  productOptions: ProductOption[];
  metrics: {
    totalClaims: number;
    blockedClaims: number;
    unlockedClaims: number;
    referralVisits: number;
  };
}) {
  const [config, setConfig] = useState(initialConfig);
  const [productSlugsText, setProductSlugsText] = useState(formatSlugList(initialConfig.productSlugs));
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const updateField = (key: keyof FreeDealAdminConfig, value: string | boolean | number) => {
    setConfig((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const fillWithCheapProducts = () => {
    const slugs = [...productOptions]
      .sort((left, right) => left.minUsd - right.minUsd)
      .slice(0, Math.max(config.itemLimit * 3, config.itemLimit))
      .map((product) => product.slug);

    setConfig((current) => ({
      ...current,
      productSlugs: slugs,
    }));
    setProductSlugsText(formatSlugList(slugs));
    setFeedback("Selection remplie avec les produits publies les moins chers.");
  };

  const saveConfig = async () => {
    setIsSaving(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/admin/free-deals", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ...config,
          productSlugs: parseSlugList(productSlugsText),
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.config) {
        setFeedback(payload?.message || "Impossible d'enregistrer l'offre gratuite.");
        return;
      }

      setConfig(payload.config);
      setProductSlugsText(formatSlugList(payload.config.productSlugs));
      setFeedback("Configuration de la page articles gratuits enregistree.");
    } catch {
      setFeedback("Impossible d'enregistrer l'offre gratuite.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[18px] border border-[#e7ebf1] bg-white px-5 py-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-[28px] font-black tracking-[-0.05em] text-[#101828]">Piloter la page articles gratuits</h1>
            <p className="mt-1 max-w-[760px] text-[14px] text-[#667085]">Cette page gere le lot fixe, la liste des produits, l'habillage marketing et la logique de debloquage par partage.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={fillWithCheapProducts} className="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] border border-[#d0d5dd] bg-white px-4 text-[14px] font-semibold text-[#101828] transition hover:border-[#ff5b4d] hover:text-[#ff5b4d]">
              <Sparkles className="h-4 w-4" />
              Auto-remplir avec les petits prix
            </button>
            <button type="button" onClick={saveConfig} disabled={isSaving} className="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] bg-[#ff5b4d] px-4 text-[14px] font-semibold text-white shadow-[0_10px_18px_rgba(255,91,77,0.18)] transition hover:bg-[#ef4b3d] disabled:cursor-not-allowed disabled:opacity-70">
              <Save className="h-4 w-4" />
              {isSaving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </div>
        {feedback ? <div className="mt-4 rounded-[12px] bg-[#f8fafc] px-4 py-3 text-[13px] font-medium text-[#344054]">{feedback}</div> : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        {[
          { label: "Achats total", value: String(metrics.totalClaims) },
          { label: "Acces bloques", value: String(metrics.blockedClaims) },
          { label: "Acces debloques", value: String(metrics.unlockedClaims) },
          { label: "Visites de partage", value: String(metrics.referralVisits) },
        ].map((card) => (
          <article key={card.label} className="rounded-[18px] border border-[#e7ebf1] bg-white px-5 py-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#ff5b4d]">{card.label}</div>
            <div className="mt-3 text-[30px] font-black tracking-[-0.05em] text-[#101828]">{card.value}</div>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="space-y-4 rounded-[18px] border border-[#e7ebf1] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <div>
            <h2 className="text-[20px] font-black text-[#101828]">Configuration marketing</h2>
            <p className="mt-1 text-[13px] text-[#667085]">Tout ce qui suit pilote la page publique et le message visible pendant le parcours.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
              <span>Activer l'offre</span>
              <select value={config.enabled ? "true" : "false"} onChange={(event) => updateField("enabled", event.target.value === "true")} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] bg-white px-4 text-[14px] outline-none focus:border-[#ff5b4d]">
                <option value="true">Active</option>
                <option value="false">Desactivee</option>
              </select>
            </label>

            <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
              <span>Titre SEO / page</span>
              <input value={config.pageTitle} onChange={(event) => updateField("pageTitle", event.target.value)} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#ff5b4d]" />
            </label>

            <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
              <span>Badge hero</span>
              <input value={config.heroBadge} onChange={(event) => updateField("heroBadge", event.target.value)} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#ff5b4d]" />
            </label>

            <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
              <span>Banniere haute</span>
              <input value={config.bannerText} onChange={(event) => updateField("bannerText", event.target.value)} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#ff5b4d]" />
            </label>

            <label className="space-y-2 text-[13px] font-semibold text-[#344054] md:col-span-2">
              <span>Titre hero</span>
              <input value={config.heroTitle} onChange={(event) => updateField("heroTitle", event.target.value)} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#ff5b4d]" />
            </label>

            <label className="space-y-2 text-[13px] font-semibold text-[#344054] md:col-span-2">
              <span>Texte hero</span>
              <textarea value={config.heroSubtitle} onChange={(event) => updateField("heroSubtitle", event.target.value)} className="min-h-[120px] w-full rounded-[12px] border border-[#dfe3ea] px-4 py-3 text-[14px] outline-none focus:border-[#ff5b4d]" />
            </label>

            <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
              <span>CTA principal</span>
              <input value={config.ctaLabel} onChange={(event) => updateField("ctaLabel", event.target.value)} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#ff5b4d]" />
            </label>

            <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
              <span>Tag carte</span>
              <input value={config.dealTagText} onChange={(event) => updateField("dealTagText", event.target.value)} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#ff5b4d]" />
            </label>

            <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
              <span>Badge produit</span>
              <input value={config.productBadgeText} onChange={(event) => updateField("productBadgeText", event.target.value)} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#ff5b4d]" />
            </label>

            <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
              <span>Titre partage</span>
              <input value={config.shareTitle} onChange={(event) => updateField("shareTitle", event.target.value)} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#ff5b4d]" />
            </label>

            <label className="space-y-2 text-[13px] font-semibold text-[#344054] md:col-span-2">
              <span>Texte partage</span>
              <textarea value={config.shareDescription} onChange={(event) => updateField("shareDescription", event.target.value)} className="min-h-[120px] w-full rounded-[12px] border border-[#dfe3ea] px-4 py-3 text-[14px] outline-none focus:border-[#ff5b4d]" />
            </label>
          </div>
        </article>

        <aside className="space-y-4">
          <article className="rounded-[18px] border border-[#e7ebf1] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <h2 className="text-[20px] font-black text-[#101828]">Regles du lot</h2>
            <div className="mt-4 grid gap-4">
              <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
                <span>Nombre exact d'articles</span>
                <input type="number" min={1} max={25} value={config.itemLimit} onChange={(event) => updateField("itemLimit", Number(event.target.value) || 1)} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#ff5b4d]" />
              </label>

              <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
                <span>Prix fixe EUR</span>
                <input type="number" min={0.5} step={0.01} value={config.fixedPriceEur} onChange={(event) => updateField("fixedPriceEur", Number(event.target.value) || 0.5)} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#ff5b4d]" />
              </label>

              <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
                <span>Objectif visites partage</span>
                <input type="number" min={1} max={500} value={config.referralGoal} onChange={(event) => updateField("referralGoal", Number(event.target.value) || 1)} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#ff5b4d]" />
              </label>

              <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
                <span>Multiplicateur prix barre</span>
                <input type="number" min={1} step={0.05} value={config.compareAtMultiplier} onChange={(event) => updateField("compareAtMultiplier", Number(event.target.value) || 1)} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#ff5b4d]" />
              </label>

              <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
                <span>Boost fixe du prix barre (EUR)</span>
                <input type="number" min={0} step={0.05} value={config.compareAtExtraEur} onChange={(event) => updateField("compareAtExtraEur", Number(event.target.value) || 0)} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#ff5b4d]" />
              </label>
            </div>
          </article>

          <article className="rounded-[18px] border border-[#e7ebf1] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <h2 className="text-[18px] font-black text-[#101828]">Reference des produits</h2>
            <div className="mt-3 max-h-[360px] overflow-y-auto rounded-[14px] bg-[#f8fafc] px-4 py-3 text-[12px] leading-6 text-[#475467]">
              {productOptions.map((product) => (
                <div key={product.slug}><span className="font-semibold">{product.slug}</span> - {product.title} - {product.supplierName} - des {product.minUsd.toFixed(2)} USD</div>
              ))}
            </div>
          </article>
        </aside>
      </section>

      <section className="rounded-[18px] border border-[#e7ebf1] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <h2 className="text-[20px] font-black text-[#101828]">Produits affiches sur la page gratuite</h2>
        <p className="mt-1 text-[13px] text-[#667085]">Collez les slugs separes par des virgules. Seuls ces produits seront visibles et eligibles au lot.</p>
        <label className="mt-4 block space-y-2 text-[13px] font-semibold text-[#344054]">
          <span>Slugs produits</span>
          <textarea value={productSlugsText} onChange={(event) => setProductSlugsText(event.target.value)} className="min-h-[140px] w-full rounded-[12px] border border-[#dfe3ea] px-4 py-3 text-[14px] outline-none focus:border-[#ff5b4d]" />
        </label>
      </section>
    </div>
  );
}
