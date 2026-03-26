"use client";

import Image from "next/image";
import { LoaderCircle, Save, Search, Sparkles, Trash2, WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ProductOption = {
  slug: string;
  title: string;
  minUsd: number;
  supplierName: string;
  image: string;
};

type ImportedOption = {
  id: string;
  slug: string;
  title: string;
  minUsd: number;
  supplierName: string;
  image: string;
  publishedToSite: boolean;
  query: string;
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

function formatUsd(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function AdminFreeDealsClient({
  initialConfig,
  productOptions,
  importedOptions,
  metrics,
}: {
  initialConfig: FreeDealAdminConfig;
  productOptions: ProductOption[];
  importedOptions: ImportedOption[];
  metrics: {
    totalClaims: number;
    blockedClaims: number;
    unlockedClaims: number;
    referralVisits: number;
  };
}) {
  const router = useRouter();
  const [config, setConfig] = useState(initialConfig);
  const [productSlugsText, setProductSlugsText] = useState(formatSlugList(initialConfig.productSlugs));
  const [importForm, setImportForm] = useState({ query: "", limit: 18, maxUsd: 5 });
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const selectedSlugs = useMemo(() => parseSlugList(productSlugsText), [productSlugsText]);
  const selectedSlugSet = useMemo(() => new Set(selectedSlugs), [selectedSlugs]);
  const selectedProducts = useMemo(
    () => productOptions
      .filter((product) => selectedSlugSet.has(product.slug))
      .sort((left, right) => left.minUsd - right.minUsd),
    [productOptions, selectedSlugSet],
  );
  const importCandidates = useMemo(
    () => [...importedOptions].sort((left, right) => {
      if (left.publishedToSite !== right.publishedToSite) {
        return left.publishedToSite ? -1 : 1;
      }

      return left.minUsd - right.minUsd;
    }),
    [importedOptions],
  );

  const updateField = (key: keyof FreeDealAdminConfig, value: string | boolean | number) => {
    setConfig((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const syncSelectedSlugs = (nextSlugs: string[]) => {
    setConfig((current) => ({
      ...current,
      productSlugs: nextSlugs,
    }));
    setProductSlugsText(formatSlugList(nextSlugs));
  };

  const toggleSelectedProduct = (slug: string) => {
    const nextSlugs = selectedSlugSet.has(slug)
      ? selectedSlugs.filter((entry) => entry !== slug)
      : [...selectedSlugs, slug];

    syncSelectedSlugs(nextSlugs);
  };

  const fillWithCheapProducts = () => {
    const slugs = [...productOptions]
      .sort((left, right) => left.minUsd - right.minUsd)
      .slice(0, Math.max(config.itemLimit * 3, config.itemLimit))
      .map((product) => product.slug);

    syncSelectedSlugs(slugs);
    setFeedback("Selection remplie avec les produits publies les moins chers.");
  };

  const importFreeDealProducts = async () => {
    if (!importForm.query.trim()) {
      setFeedback("Saisis une recherche Alibaba pour importer des produits gratuits.");
      return;
    }

    setIsImporting(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/admin/free-deals/import", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(importForm),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.config) {
        setFeedback(payload?.message || "Import Alibaba impossible pour l'offre gratuite.");
        return;
      }

      setConfig(payload.config);
      setProductSlugsText(formatSlugList(payload.config.productSlugs));
      setFeedback(
        payload?.warningMessage
          || `Import terminé: ${payload?.importedCount ?? 0}/${payload?.targetImportCount ?? importForm.limit} produits publiés et rattachés à la page gratuite.`,
      );
      router.refresh();
    } catch {
      setFeedback("Import Alibaba impossible pour l'offre gratuite.");
    } finally {
      setIsImporting(false);
    }
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
      setFeedback("Configuration de la page produits gratuits enregistrée.");
      router.refresh();
    } catch {
      setFeedback("Impossible d'enregistrer l'offre gratuite.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[24px] border border-[#ffd4c0] bg-[linear-gradient(135deg,#ff0f73_0%,#ff6036_55%,#ffb100_100%)] p-6 text-white shadow-[0_16px_40px_rgba(255,91,77,0.18)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-[780px]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/80">Produits gratuits</div>
            <h1 className="mt-3 text-[30px] font-black tracking-[-0.06em]">Acquisition client par lot promo</h1>
            <p className="mt-3 text-[15px] leading-7 text-white/90">
              Cette section pilote la page spéciale accessible depuis la recherche “gratuit”, “produit gratuit” ou “article gratuit”.
              Tu importes ici des produits Alibaba très bon marché, tu décides lesquels apparaissent sur la page et tu règles tout le marketing.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px]">
            {[
              { label: "Achats", value: String(metrics.totalClaims) },
              { label: "Accès bloqués", value: String(metrics.blockedClaims) },
              { label: "Débloqués", value: String(metrics.unlockedClaims) },
              { label: "Visites partagées", value: String(metrics.referralVisits) },
            ].map((card) => (
              <article key={card.label} className="rounded-[20px] bg-white/14 px-4 py-4 backdrop-blur">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">{card.label}</div>
                <div className="mt-2 text-[28px] font-black tracking-[-0.05em]">{card.value}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {feedback ? <div className="rounded-[16px] border border-[#ffd6bf] bg-[#fff7f2] px-4 py-3 text-[14px] font-medium text-[#8a4b16]">{feedback}</div> : null}

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-[22px] border border-[#e7ebf1] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#ff6a00]">Import dédié</div>
              <h2 className="mt-2 text-[24px] font-black tracking-[-0.05em] text-[#101828]">Importer directement pour l’offre gratuite</h2>
              <p className="mt-2 text-[14px] leading-7 text-[#667085]">
                Cette recherche publie automatiquement les produits sur le site et ne rattache a la campagne que les articles les moins chers, cibles sous 5 USD.
              </p>
            </div>
            <button type="button" onClick={fillWithCheapProducts} className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border border-[#d0d5dd] px-4 text-[14px] font-semibold text-[#101828] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
              <WandSparkles className="h-4 w-4" />
              Auto cheap
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_120px_140px_auto]">
            <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
              <span>Recherche Alibaba</span>
              <input
                value={importForm.query}
                onChange={(event) => setImportForm((current) => ({ ...current, query: event.target.value }))}
                placeholder="Ex: écouteurs, coques, petit accessoire"
                className="h-12 w-full rounded-[14px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#ff6a00]"
              />
            </label>
            <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
              <span>Nombre</span>
              <input
                type="number"
                min={1}
                max={60}
                value={importForm.limit}
                onChange={(event) => setImportForm((current) => ({ ...current, limit: Number(event.target.value) || 12 }))}
                className="h-12 w-full rounded-[14px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#ff6a00]"
              />
            </label>
            <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
              <span>Prix max USD</span>
              <input
                type="number"
                min={0.2}
                step={0.1}
                value={importForm.maxUsd}
                onChange={(event) => setImportForm((current) => ({ ...current, maxUsd: Number(event.target.value) || 5 }))}
                className="h-12 w-full rounded-[14px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#ff6a00]"
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={importFreeDealProducts}
                disabled={isImporting}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[#111827] px-5 text-[14px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isImporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {isImporting ? "Import..." : "Importer"}
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              { label: "Titre page", value: config.pageTitle },
              { label: "Forfait", value: `${config.fixedPriceEur} EUR` },
              { label: "Sélection", value: `${selectedSlugs.length} produit(s)` },
            ].map((item) => (
              <div key={item.label} className="rounded-[18px] bg-[#f8fafc] px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">{item.label}</div>
                <div className="mt-2 text-[18px] font-black tracking-[-0.04em] text-[#101828]">{item.value}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[22px] border border-[#e7ebf1] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#ff6a00]">Aperçu campagne</div>
          <h2 className="mt-2 text-[24px] font-black tracking-[-0.05em] text-[#101828]">{config.heroTitle}</h2>
          <p className="mt-2 text-[14px] leading-7 text-[#667085]">{config.heroSubtitle}</p>

          <div className="mt-5 rounded-[24px] bg-[linear-gradient(135deg,#ff0f73_0%,#ff6036_62%,#ffb100_100%)] px-5 py-5 text-white">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">{config.bannerText}</div>
            <div className="mt-3 text-[29px] font-black tracking-[-0.05em]">{config.fixedPriceEur} EUR</div>
            <div className="mt-1 text-[14px] text-white/85">{config.itemLimit} article(s) au choix · partage {config.referralGoal} visites</div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-white px-3 py-1 text-[12px] font-bold text-[#ff285e]">{config.dealTagText}</span>
              <span className="rounded-full bg-white/16 px-3 py-1 text-[12px] font-bold text-white">{config.productBadgeText}</span>
              <span className="rounded-full bg-white/16 px-3 py-1 text-[12px] font-bold text-white">{config.ctaLabel}</span>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {selectedProducts.slice(0, 4).map((product) => (
              <div key={product.slug} className="flex items-center gap-3 rounded-[18px] bg-[#f8fafc] px-3 py-3">
                <div className="relative h-14 w-14 overflow-hidden rounded-[14px] bg-[#eef2f6]">
                  <Image src={product.image} alt={product.title} fill className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 text-[14px] font-semibold text-[#101828]">{product.title}</div>
                  <div className="text-[12px] text-[#667085]">{product.supplierName}</div>
                </div>
                <div className="text-[12px] font-semibold text-[#ff6a00]">{formatUsd(product.minUsd)}</div>
              </div>
            ))}
            {selectedProducts.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-[#d0d5dd] px-4 py-4 text-[14px] text-[#667085]">
                Aucun produit encore rattaché à la campagne.
              </div>
            ) : null}
          </div>
        </article>
      </section>

      <section className="rounded-[22px] border border-[#e7ebf1] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#ff6a00]">Produits de la campagne</div>
            <h2 className="mt-2 text-[24px] font-black tracking-[-0.05em] text-[#101828]">Sélectionner les produits gratuits visibles</h2>
            <p className="mt-2 text-[14px] leading-7 text-[#667085]">
              Les produits importés ici servent uniquement à nourrir la page spéciale. Tu peux en ajouter ou retirer à tout moment.
            </p>
          </div>
          <button type="button" onClick={saveConfig} disabled={isSaving} className="inline-flex h-12 items-center justify-center gap-2 rounded-[14px] bg-[#ff5b4d] px-5 text-[14px] font-semibold text-white transition hover:bg-[#ef4b3d] disabled:cursor-not-allowed disabled:opacity-70">
            {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? "Enregistrement..." : "Enregistrer la campagne"}
          </button>
        </div>

        <div className="mt-5">
          <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">Articles actuellement affichés sur la page</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {selectedProducts.length > 0 ? selectedProducts.map((product) => (
              <article key={product.slug} className="overflow-hidden rounded-[20px] border border-[#eef2f6] bg-[#fcfdfd]">
                <div className="relative aspect-[1.02] bg-[#f3f6fa]">
                  <Image src={product.image} alt={product.title} fill className="object-cover" />
                  <div className="absolute left-3 top-3 rounded-full bg-[#111827] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                    Sur la page
                  </div>
                </div>
                <div className="space-y-3 px-4 py-4">
                  <div className="line-clamp-2 min-h-[40px] text-[15px] font-black leading-5 tracking-[-0.03em] text-[#101828]">{product.title}</div>
                  <div className="text-[12px] text-[#667085]">{product.supplierName}</div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[13px] font-semibold text-[#ff6a00]">{formatUsd(product.minUsd)}</div>
                    <button
                      type="button"
                      onClick={() => toggleSelectedProduct(product.slug)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#111827] px-4 text-[12px] font-semibold text-white transition hover:bg-black"
                    >
                      <Trash2 className="h-4 w-4" />
                      Retirer
                    </button>
                  </div>
                </div>
              </article>
            )) : (
              <div className="rounded-[18px] border border-dashed border-[#d0d5dd] px-4 py-4 text-[14px] text-[#667085] sm:col-span-2 xl:col-span-4">
                Aucun article n&apos;est encore selectionne pour la page gratuite.
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {importCandidates.map((product) => {
            const isSelected = selectedSlugSet.has(product.slug);
            const isCheapEnough = product.minUsd <= importForm.maxUsd;

            return (
              <article key={product.id} className="overflow-hidden rounded-[22px] border border-[#eef2f6] bg-white shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
                <div className="relative aspect-[0.95] bg-[#f4f6fb]">
                  <Image src={product.image} alt={product.title} fill className="object-cover" />
                  <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#15b86c] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                      {product.publishedToSite ? "SITE" : "IMPORTE"}
                    </span>
                    <span className="rounded-full bg-[#111827] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                      {config.productBadgeText}
                    </span>
                  </div>
                </div>
                <div className="space-y-3 px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">{product.query || "import direct"}</div>
                  <div className="line-clamp-2 min-h-[44px] text-[16px] font-black leading-6 tracking-[-0.03em] text-[#101828]">{product.title}</div>
                  <div className="text-[13px] text-[#667085]">{product.supplierName}</div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[13px] font-semibold text-[#ff6a00]">{formatUsd(product.minUsd)}</div>
                    <button
                      type="button"
                      disabled={!product.publishedToSite || !isCheapEnough}
                      onClick={() => toggleSelectedProduct(product.slug)}
                      className={[
                        "inline-flex h-10 items-center justify-center rounded-full px-4 text-[12px] font-semibold transition",
                        !product.publishedToSite || !isCheapEnough
                          ? "cursor-not-allowed bg-[#eef2f6] text-[#98a2b3]"
                          : isSelected
                            ? "bg-[#111827] text-white hover:bg-black"
                            : "bg-[#fff1e8] text-[#ff6a00] hover:bg-[#ffe3d2]",
                      ].join(" ")}
                    >
                      {!product.publishedToSite ? "Publier d'abord" : !isCheapEnough ? "Trop cher" : isSelected ? "Retirer" : "Ajouter"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="space-y-4 rounded-[22px] border border-[#e7ebf1] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#ff6a00]">Marketing page</div>
            <h2 className="mt-2 text-[24px] font-black tracking-[-0.05em] text-[#101828]">Personnaliser la bannière et les messages</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
              <span>Activer l'offre</span>
              <select value={config.enabled ? "true" : "false"} onChange={(event) => updateField("enabled", event.target.value === "true")} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] bg-white px-4 text-[14px] outline-none focus:border-[#ff5b4d]">
                <option value="true">Active</option>
                <option value="false">Desactivée</option>
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
              <span>Bannière haute</span>
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
          <article className="rounded-[22px] border border-[#e7ebf1] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            <h2 className="text-[22px] font-black tracking-[-0.05em] text-[#101828]">Règles de l’offre</h2>
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
                <span>Multiplicateur prix barré</span>
                <input type="number" min={1} step={0.05} value={config.compareAtMultiplier} onChange={(event) => updateField("compareAtMultiplier", Number(event.target.value) || 1)} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#ff5b4d]" />
              </label>

              <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
                <span>Boost fixe prix barré (EUR)</span>
                <input type="number" min={0} step={0.05} value={config.compareAtExtraEur} onChange={(event) => updateField("compareAtExtraEur", Number(event.target.value) || 0)} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#ff5b4d]" />
              </label>
            </div>
          </article>

          <article className="rounded-[22px] border border-[#e7ebf1] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            <h2 className="text-[22px] font-black tracking-[-0.05em] text-[#101828]">Slugs reliés</h2>
            <p className="mt-2 text-[13px] leading-6 text-[#667085]">Tu peux encore affiner la sélection manuellement si besoin.</p>
            <textarea value={productSlugsText} onChange={(event) => setProductSlugsText(event.target.value)} className="mt-4 min-h-[180px] w-full rounded-[14px] border border-[#dfe3ea] px-4 py-3 text-[14px] outline-none focus:border-[#ff5b4d]" />
          </article>
        </aside>
      </section>
    </div>
  );
}
