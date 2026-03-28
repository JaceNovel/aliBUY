"use client";

import { useState } from "react";
import { Save, Sparkles } from "lucide-react";

import type { ModePromotionConfig } from "@/lib/mode-promotions-store";

type ProductOption = {
  slug: string;
  title: string;
  minUsd: number;
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

function formatHeroCoupons(value: ModePromotionConfig["heroSlides"][number]["coupons"]) {
  return value.map((coupon) => `${coupon.value} | ${coupon.limit} | ${coupon.code}`).join("\n");
}

function parseHeroCoupons(value: string) {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [amount = "", limit = "", code = ""] = entry.split("|").map((part) => part.trim());
      return { value: amount, limit, code };
    });
}

function formatCoupons(value: ModePromotionConfig["featureCoupons"]) {
  return value.map((coupon) => `${coupon.label} | ${coupon.value} | ${coupon.detail}`).join("\n");
}

function parseCoupons(value: string) {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [label = "", amount = "", detail = ""] = entry.split("|").map((part) => part.trim());
      return { label, value: amount, detail };
    });
}

export function AdminModePromotionsClient({ initialConfig, productOptions }: { initialConfig: ModePromotionConfig; productOptions: ProductOption[] }) {
  const [config, setConfig] = useState(initialConfig);
  const [featureCouponsText, setFeatureCouponsText] = useState(formatCoupons(initialConfig.featureCoupons));
  const [rushCouponsText, setRushCouponsText] = useState(formatCoupons(initialConfig.rushCoupons));
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const updateHeroSlide = (index: number, key: keyof ModePromotionConfig["heroSlides"][number], value: string) => {
    setConfig((current) => ({
      ...current,
      heroSlides: current.heroSlides.map((slide, slideIndex) => (slideIndex === index ? { ...slide, [key]: value } : slide)),
    }));
  };

  const updateHeroCoupons = (index: number, rawValue: string) => {
    setConfig((current) => ({
      ...current,
      heroSlides: current.heroSlides.map((slide, slideIndex) => (slideIndex === index ? { ...slide, coupons: parseHeroCoupons(rawValue) } : slide)),
    }));
  };

  const updateSlugGroup = (key: keyof Pick<ModePromotionConfig, "groupedOfferSlugs" | "dailyDealSlugs" | "premiumSelectionSlugs" | "choiceDealSlugs" | "trendPromoSlugs" | "flashRushSlugs" | "finalDropSlugs">, value: string) => {
    setConfig((current) => ({
      ...current,
      [key]: parseSlugList(value),
    }));
  };

  const fillWithCheapAliExpressProducts = () => {
    const cheapProducts = [...productOptions].sort((left, right) => left.minUsd - right.minUsd);
    const takeSlugs = (start: number, count: number) => cheapProducts.slice(start, start + count).map((product) => product.slug);

    setConfig((current) => ({
      ...current,
      groupedOfferSlugs: takeSlugs(0, 3),
      dailyDealSlugs: takeSlugs(3, 3),
      premiumSelectionSlugs: takeSlugs(0, 6),
      choiceDealSlugs: takeSlugs(0, 4),
      trendPromoSlugs: takeSlugs(4, 4),
      flashRushSlugs: takeSlugs(0, 6),
      finalDropSlugs: takeSlugs(6, 6),
    }));
    setFeedback("Sélections remplies avec les produits AliExpress publiés les moins chers.");
  };

  const saveConfig = async () => {
    setIsSaving(true);
    setFeedback(null);

    const payload: ModePromotionConfig = {
      ...config,
      featureCoupons: parseCoupons(featureCouponsText),
      rushCoupons: parseCoupons(rushCouponsText),
    };

    try {
      const response = await fetch("/api/admin/mode-promotions", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const next = await response.json().catch(() => null);

      if (!response.ok || !next) {
        setFeedback(typeof next?.message === "string" ? next.message : "Impossible d'enregistrer la page promo.");
        return;
      }

      setConfig(next);
      setFeatureCouponsText(formatCoupons(next.featureCoupons));
      setRushCouponsText(formatCoupons(next.rushCoupons));
      setFeedback("Configuration promo enregistrée.");
    } catch {
      setFeedback("Impossible d'enregistrer la page promo.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[18px] border border-[#e7ebf1] bg-white px-5 py-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-[28px] font-black tracking-[-0.05em] text-[#101828]">Piloter la page promo mode</h1>
            <p className="mt-1 text-[14px] text-[#667085]">Cette page pilote le hero, les coupons et les sélections produits visibles sur la page mode publique.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={fillWithCheapAliExpressProducts} className="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] border border-[#d0d5dd] bg-white px-4 text-[14px] font-semibold text-[#101828] transition hover:border-[#f84557] hover:text-[#f84557]">
              <Sparkles className="h-4 w-4" />
              Auto-remplir avec les petits prix AliExpress
            </button>
            <button type="button" onClick={saveConfig} disabled={isSaving} className="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] bg-[#f84557] px-4 text-[14px] font-semibold text-white shadow-[0_10px_18px_rgba(248,69,87,0.18)] transition hover:bg-[#ea3248] disabled:cursor-not-allowed disabled:opacity-70">
              <Save className="h-4 w-4" />
              {isSaving ? "Enregistrement..." : "Enregistrer la page promo"}
            </button>
          </div>
        </div>
        {feedback ? <div className="mt-4 rounded-[12px] bg-[#f8fafc] px-4 py-3 text-[13px] font-medium text-[#344054]">{feedback}</div> : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="space-y-4 rounded-[18px] border border-[#e7ebf1] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <div>
            <h2 className="text-[20px] font-black text-[#101828]">Hero promotionnel</h2>
            <p className="mt-1 text-[13px] text-[#667085]">Renseignez les slides principales. Les prix, images et liens viennent toujours du produit sélectionné.</p>
          </div>
          {config.heroSlides.map((slide, index) => (
            <div key={slide.id} className="rounded-[16px] border border-[#edf1f6] p-4">
              <div className="text-[14px] font-bold text-[#101828]">Slide {index + 1}</div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
                  <span>Titre</span>
                  <input value={slide.headline} onChange={(event) => updateHeroSlide(index, "headline", event.target.value)} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#f84557]" />
                </label>
                <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
                  <span>Préfixe deadline</span>
                  <input value={slide.deadlinePrefix} onChange={(event) => updateHeroSlide(index, "deadlinePrefix", event.target.value)} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#f84557]" />
                </label>
                <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
                  <span>Date de fin ISO</span>
                  <input value={slide.endsAt} onChange={(event) => updateHeroSlide(index, "endsAt", event.target.value)} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#f84557]" />
                </label>
                <label className="space-y-2 text-[13px] font-semibold text-[#344054]">
                  <span>Couleur accent</span>
                  <input value={slide.accentColor} onChange={(event) => updateHeroSlide(index, "accentColor", event.target.value)} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] px-4 text-[14px] outline-none focus:border-[#f84557]" />
                </label>
                <label className="space-y-2 text-[13px] font-semibold text-[#344054] md:col-span-2">
                  <span>Produit mis en avant</span>
                  <select value={slide.spotlightProductSlug} onChange={(event) => updateHeroSlide(index, "spotlightProductSlug", event.target.value)} className="h-11 w-full rounded-[12px] border border-[#dfe3ea] bg-white px-4 text-[14px] outline-none focus:border-[#f84557]">
                    <option value="">Sélection automatique</option>
                    {productOptions.map((product) => (
                      <option key={product.slug} value={product.slug}>{product.title} ({product.slug}) · dès {product.minUsd.toFixed(2)} USD</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-[13px] font-semibold text-[#344054] md:col-span-2">
                  <span>Coupons hero, une ligne par coupon</span>
                  <textarea value={formatHeroCoupons(slide.coupons)} onChange={(event) => updateHeroCoupons(index, event.target.value)} className="min-h-[110px] w-full rounded-[12px] border border-[#dfe3ea] px-4 py-3 text-[14px] outline-none focus:border-[#f84557]" />
                </label>
              </div>
            </div>
          ))}
        </article>

        <aside className="space-y-4">
          <article className="rounded-[18px] border border-[#e7ebf1] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <h2 className="text-[18px] font-black text-[#101828]">Coupons secondaires</h2>
            <label className="mt-4 block space-y-2 text-[13px] font-semibold text-[#344054]">
              <span>Bloc “Coupons, badges et sélections flash”</span>
              <textarea value={featureCouponsText} onChange={(event) => setFeatureCouponsText(event.target.value)} className="min-h-[110px] w-full rounded-[12px] border border-[#dfe3ea] px-4 py-3 text-[14px] outline-none focus:border-[#f84557]" />
            </label>
            <label className="mt-4 block space-y-2 text-[13px] font-semibold text-[#344054]">
              <span>Bloc “Promo AfriPay”</span>
              <textarea value={rushCouponsText} onChange={(event) => setRushCouponsText(event.target.value)} className="min-h-[110px] w-full rounded-[12px] border border-[#dfe3ea] px-4 py-3 text-[14px] outline-none focus:border-[#f84557]" />
            </label>
          </article>

          <article className="rounded-[18px] border border-[#e7ebf1] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <h2 className="text-[18px] font-black text-[#101828]">Référentiel slugs</h2>
            <div className="mt-3 max-h-[340px] overflow-y-auto rounded-[14px] bg-[#f8fafc] px-4 py-3 text-[12px] leading-6 text-[#475467]">
              {productOptions.map((product) => (
                <div key={product.slug}><span className="font-semibold">{product.slug}</span> · {product.title} · dès {product.minUsd.toFixed(2)} USD</div>
              ))}
            </div>
          </article>
        </aside>
      </section>

      <section className="rounded-[18px] border border-[#e7ebf1] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <h2 className="text-[20px] font-black text-[#101828]">Sélections produits de la page mode</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {[
            { key: "groupedOfferSlugs", label: "Offres groupées", description: "3 produits pour le bloc bundle" },
            { key: "dailyDealSlugs", label: "Deals du jour", description: "3 produits pour le bloc deal du jour" },
            { key: "premiumSelectionSlugs", label: "Sélection premium", description: "6 produits pour la grille premium" },
            { key: "choiceDealSlugs", label: "Choice promo", description: "4 produits pour les mini deals promo" },
            { key: "trendPromoSlugs", label: "Encore plus de promos", description: "4 cartes inspiration" },
            { key: "flashRushSlugs", label: "Mosaïque promo", description: "6 produits pour la vente éclair" },
            { key: "finalDropSlugs", label: "Dernières cartes promo", description: "6 produits pour le dernier drop" },
          ].map((field) => (
            <label key={field.key} className="space-y-2 text-[13px] font-semibold text-[#344054]">
              <span>{field.label}</span>
              <span className="block text-[12px] font-medium text-[#667085]">{field.description}</span>
              <textarea value={formatSlugList(config[field.key as keyof Pick<ModePromotionConfig, "groupedOfferSlugs" | "dailyDealSlugs" | "premiumSelectionSlugs" | "choiceDealSlugs" | "trendPromoSlugs" | "flashRushSlugs" | "finalDropSlugs">])} onChange={(event) => updateSlugGroup(field.key as keyof Pick<ModePromotionConfig, "groupedOfferSlugs" | "dailyDealSlugs" | "premiumSelectionSlugs" | "choiceDealSlugs" | "trendPromoSlugs" | "flashRushSlugs" | "finalDropSlugs">, event.target.value)} className="min-h-[92px] w-full rounded-[12px] border border-[#dfe3ea] px-4 py-3 text-[14px] outline-none focus:border-[#f84557]" />
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}