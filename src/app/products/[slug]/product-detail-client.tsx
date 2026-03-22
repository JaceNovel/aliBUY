"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Heart, Minus, Play, Plus, ShieldCheck, ShoppingCart, X } from "lucide-react";
import { useState } from "react";

type DetailVariantGroup = {
  label: string;
  values: string[];
};

type DetailTier = {
  quantityLabel: string;
  priceUsd: number;
  formattedPrice: string;
  note?: string;
};

type DetailSpec = {
  label: string;
  value: string;
};

type RelatedProduct = {
  slug: string;
  title: string;
  image: string;
  formattedPrice: string;
  moqLabel: string;
};

type ProductDetailClientProps = {
  product: {
    slug: string;
    title: string;
    shortTitle: string;
    locale: string;
    currencyCode: string;
    moq: number;
    packaging: string;
    itemWeightGrams: number;
    lotCbm: string;
    supplierName: string;
    supplierLocation: string;
    responseTime: string;
    yearsInBusiness: number;
    transactionsLabel: string;
    soldLabel: string;
    customizationLabel: string;
    shippingLabel: string;
    gallery: string[];
    videoUrl?: string;
    videoPoster?: string;
    overview: string[];
    tiers: DetailTier[];
    variantGroups: DetailVariantGroup[];
    specs: DetailSpec[];
    formattedPriceRange: string;
    moqLabel: string;
    badge?: string;
  };
  relatedProducts: RelatedProduct[];
};

export function ProductDetailClient({ product, relatedProducts }: ProductDetailClientProps) {
  const [activeImage, setActiveImage] = useState(0);
  const [activeMedia, setActiveMedia] = useState<"photo" | "video">("photo");
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoritePulse, setFavoritePulse] = useState(false);
  const [shippingMethod, setShippingMethod] = useState<"air" | "sea" | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>(() => {
    return Object.fromEntries(product.variantGroups.map((group) => [group.label, group.values[0] ?? ""]));
  });
  const mixGroup = product.variantGroups[0];
  const modalGroups = product.variantGroups.slice(1);
  const [mixQuantities, setMixQuantities] = useState<Record<string, number>>(() => {
    return Object.fromEntries((mixGroup?.values ?? []).map((value, index) => [value, index === 0 ? 0 : 0]));
  });
  const characteristicRows = [
    [
      { label: product.specs[0]?.label ?? "Type", value: product.shortTitle },
      { label: product.specs[1]?.label ?? "Matériau", value: product.specs[1]?.value ?? product.customizationLabel },
    ],
    [
      { label: product.specs[2]?.label ?? "Tension", value: product.specs[2]?.value ?? product.shippingLabel },
      { label: product.specs[3]?.label ?? "Compatibilité", value: product.specs[3]?.value ?? product.overview[0] },
    ],
    [
      { label: "Emballage", value: product.packaging },
      { label: "Poids de l'article", value: `${product.itemWeightGrams} g` },
    ],
    [
      { label: "CBM d'un lot", value: product.lotCbm },
      { label: "Livraison", value: product.shippingLabel },
    ],
  ];
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat(product.locale, {
      style: "currency",
      currency: product.currencyCode,
      minimumFractionDigits: amount >= 100 ? 0 : 2,
      maximumFractionDigits: amount >= 100 ? 0 : 2,
    }).format(amount);
  };
  const getTierMinimum = (label: string) => {
    const normalized = label.replace(/\s/g, "");
    if (normalized.startsWith(">=") || normalized.includes("+")) {
      const match = normalized.match(/(\d+)/);
      return match ? Number(match[1]) : 0;
    }

    const rangeMatch = normalized.match(/(\d+)-(\d+)/);
    if (rangeMatch) {
      return Number(rangeMatch[1]);
    }

    const singleMatch = normalized.match(/(\d+)/);
    return singleMatch ? Number(singleMatch[1]) : 0;
  };
  const totalSelectedQuantity = Object.values(mixQuantities).reduce((sum, quantity) => sum + quantity, 0);
  const totalWeightKg = (product.itemWeightGrams * totalSelectedQuantity) / 1000;
  const exceedsSeaThreshold = totalWeightKg > 5;
  const sortedTiers = [...product.tiers].sort((left, right) => getTierMinimum(left.quantityLabel) - getTierMinimum(right.quantityLabel));
  const activeTier = [...sortedTiers].reverse().find((tier) => totalSelectedQuantity >= getTierMinimum(tier.quantityLabel)) ?? sortedTiers[0];
  const currentUnitPrice = activeTier?.priceUsd ?? 0;
  const subtotal = currentUnitPrice * totalSelectedQuantity;
  const updateMixQuantity = (value: string, delta: number) => {
    setMixQuantities((current) => {
      const nextValue = Math.max(0, (current[value] ?? 0) + delta);
      return {
        ...current,
        [value]: nextValue,
      };
    });
  };
  const toggleFavorite = () => {
    setIsFavorite((current) => !current);
    setFavoritePulse(true);
    window.setTimeout(() => {
      setFavoritePulse(false);
    }, 320);
  };
  const canSubmitOrder = totalSelectedQuantity > 0 && shippingMethod !== null;

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#666]">
        <Link href="/" className="transition hover:text-[#ff6a00]">Accueil</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>Produits</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-[#222]">{product.shortTitle}</span>
      </div>

      <section className="rounded-[30px] bg-white px-4 py-4 shadow-[0_18px_48px_rgba(24,39,75,0.06)] ring-1 ring-black/5 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
        <div className="grid gap-6 xl:grid-cols-[88px_580px_minmax(0,1fr)]">
          <div className="order-2 flex gap-3 overflow-x-auto xl:order-1 xl:flex-col xl:overflow-visible">
            {product.gallery.map((image, index) => {
              const isActive = activeImage === index;

              return (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => {
                    setActiveMedia("photo");
                    setActiveImage(index);
                  }}
                  className={[
                    "relative h-[70px] min-w-[70px] overflow-hidden rounded-[18px] bg-[#f6f6f6] ring-1 transition sm:h-[82px] sm:min-w-[82px]",
                    isActive && activeMedia === "photo" ? "ring-[#ff6a00] shadow-[0_12px_28px_rgba(255,106,0,0.16)]" : "ring-black/5 hover:ring-[#ffb48a]",
                  ].join(" ")}
                >
                  <Image src={image} alt={`${product.shortTitle} ${index + 1}`} fill sizes="82px" className="object-cover" />
                </button>
              );
            })}

            {product.videoUrl ? (
              <button
                type="button"
                onClick={() => setActiveMedia("video")}
                className={[
                  "relative h-[70px] min-w-[70px] overflow-hidden rounded-[18px] bg-[#111] ring-1 transition sm:h-[82px] sm:min-w-[82px]",
                  activeMedia === "video" ? "ring-[#ff6a00] shadow-[0_12px_28px_rgba(255,106,0,0.16)]" : "ring-black/5 hover:ring-[#ffb48a]",
                ].join(" ")}
              >
                {product.videoPoster ? (
                  <Image src={product.videoPoster} alt={`${product.shortTitle} video`} fill sizes="82px" className="object-cover opacity-75" />
                ) : null}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#111] shadow-[0_8px_18px_rgba(0,0,0,0.2)]">
                    <Play className="ml-0.5 h-4 w-4 fill-current" />
                  </div>
                </div>
              </button>
            ) : null}
          </div>

          <div className="order-1 xl:order-2">
            <div className="relative mx-auto max-w-[580px] overflow-hidden rounded-[28px] bg-[#f4f4f4] ring-1 ring-black/5">
              {product.badge ? (
                <div className="absolute left-5 top-5 z-10 rounded-full bg-[#de0505] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white">
                  {product.badge}
                </div>
              ) : null}
              <div className="absolute right-4 top-4 z-10 inline-flex items-center gap-1 rounded-full bg-white/90 p-1 shadow-[0_6px_14px_rgba(0,0,0,0.08)]">
                <button
                  type="button"
                  onClick={() => setActiveMedia("photo")}
                  className={[
                    "rounded-full px-3 py-1.5 text-[12px] font-medium transition",
                    activeMedia === "photo" ? "bg-[#ff6a00] text-white" : "text-[#555]",
                  ].join(" ")}
                >
                  Photos
                </button>
                {product.videoUrl ? (
                  <button
                    type="button"
                    onClick={() => setActiveMedia("video")}
                    className={[
                      "rounded-full px-3 py-1.5 text-[12px] font-medium transition",
                      activeMedia === "video" ? "bg-[#ff6a00] text-white" : "text-[#555]",
                    ].join(" ")}
                  >
                    Vidéo
                  </button>
                ) : null}
              </div>

              <div className="relative aspect-[1/0.88] w-full">
                {activeMedia === "video" && product.videoUrl ? (
                  <video
                    key={product.videoUrl}
                    controls
                    poster={product.videoPoster}
                    className="h-full w-full object-cover"
                    preload="metadata"
                  >
                    <source src={product.videoUrl} type="video/mp4" />
                  </video>
                ) : (
                  <Image src={product.gallery[activeImage] ?? product.gallery[0]} alt={product.title} fill sizes="(min-width: 1280px) 34vw, 88vw" className="object-cover" />
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[18px] bg-[#faf7f3] px-4 py-4 ring-1 ring-[#f1dfd2]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9f6d4b]">Ventes</div>
                <div className="mt-2 text-[15px] font-semibold text-[#222]">{product.soldLabel}</div>
              </div>
              <div className="rounded-[18px] bg-[#f6f8fb] px-4 py-4 ring-1 ring-[#e3e9f3]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6e7f9a]">Personnalisation</div>
                <div className="mt-2 text-[15px] font-semibold text-[#222]">{product.customizationLabel}</div>
              </div>
              <div className="rounded-[18px] bg-[#fff7ef] px-4 py-4 ring-1 ring-[#ffe0c2]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#cf6b16]">Livraison</div>
                <div className="mt-2 text-[15px] font-semibold text-[#222]">{product.shippingLabel}</div>
              </div>
            </div>

            <article className="mt-4 overflow-hidden rounded-[26px] border border-[#e8e8e8] bg-white">
              <div className="border-b border-[#ececec] px-5 py-4">
                <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#8a8a8a]">Attributs</div>
                <h2 className="mt-2 text-[20px] font-bold tracking-[-0.04em] text-[#222] sm:text-[24px]">Caractéristiques du produit</h2>
              </div>

              <div>
                {characteristicRows.map((row, index) => (
                  <div key={`characteristic-row-${index}`} className={["grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[180px_minmax(0,1fr)_180px_minmax(0,1fr)]", index > 0 ? "border-t border-[#ececec]" : ""].join(" ")}>
                    <div className="bg-[#f5f5f5] px-5 py-4 text-[14px] text-[#444]">{row[0].label}</div>
                    <div className="px-5 py-4 text-[14px] font-semibold text-[#222]">{row[0].value}</div>
                    <div className="bg-[#f5f5f5] px-5 py-4 text-[14px] text-[#444]">{row[1].label}</div>
                    <div className="px-5 py-4 text-[14px] font-semibold text-[#222]">{row[1].value}</div>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="order-3 min-w-0 rounded-[28px] border border-[#ededed] bg-white px-5 py-5 xl:px-6 xl:py-6">
            <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#d85a00]">
              <ShieldCheck className="h-4 w-4" />
              Fournisseur vérifié AfriPay
            </div>
            <h1 className="mt-3 text-[24px] font-bold leading-[1.12] tracking-[-0.04em] text-[#222] lg:text-[34px]">
              {product.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-[14px] text-[#666]">
              <span>{product.supplierLocation}</span>
              <span className="h-1 w-1 rounded-full bg-[#bbb]" />
              <span>{product.transactionsLabel}</span>
            </div>

            <div className="mt-6 rounded-[24px] bg-[#fff8f2] px-5 py-5 ring-1 ring-[#ffe3cb]">
              <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#b66724]">Prix de référence</div>
              <div className="mt-2 text-[28px] font-bold tracking-[-0.05em] text-[#f05a00] sm:text-[34px] lg:text-[42px]">
                {product.formattedPriceRange}
              </div>
              <div className="mt-2 text-[14px] text-[#6e5b4b]">{product.moqLabel}</div>

              <div className="mt-5 overflow-hidden rounded-[18px] border border-[#ffd7b7] bg-white">
                {product.tiers.map((tier, index) => (
                  <div key={tier.quantityLabel} className={["grid grid-cols-1 gap-1 px-4 py-3 text-[14px] sm:grid-cols-[1.1fr_0.8fr_1fr] sm:gap-3", index > 0 ? "border-t border-[#f4e2d5]" : ""].join(" ")}>
                    <div className="font-semibold text-[#222]">{tier.quantityLabel}</div>
                    <div className="font-bold text-[#f05a00]">{tier.formattedPrice}</div>
                    <div className="text-left text-[#666] sm:text-right">{tier.note ?? "Tarif usine"}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {product.variantGroups.map((group) => (
                <div key={group.label}>
                  <div className="text-[14px] font-semibold text-[#222]">{group.label}</div>
                  <div className="mt-2 flex flex-wrap gap-2.5">
                    {group.values.map((value) => {
                      const isSelected = selectedVariants[group.label] === value;

                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setSelectedVariants((current) => ({ ...current, [group.label]: value }))}
                          className={[
                            "rounded-full border px-4 py-2 text-[14px] font-medium transition",
                            isSelected ? "border-[#ff6a00] bg-[#fff4eb] text-[#d85a00]" : "border-[#dedede] bg-white text-[#333] hover:border-[#ffb48a]",
                          ].join(" ")}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setIsOrderModalOpen(true)}
                className="inline-flex h-13 items-center justify-center gap-3 rounded-full bg-[#ff6a00] px-6 text-[16px] font-semibold text-white transition hover:bg-[#eb6200]"
              >
                <ShoppingCart className="h-4 w-4" />
                Commander
              </button>
              <button
                type="button"
                onClick={toggleFavorite}
                className={[
                  "inline-flex h-13 items-center justify-center gap-3 rounded-full border px-6 text-[16px] font-semibold transition",
                  isFavorite ? "border-[#ff6a00] bg-[#fff1e7] text-[#ff6a00]" : "border-[#222] text-[#222] hover:border-[#ff6a00] hover:text-[#ff6a00]",
                ].join(" ")}
              >
                <Heart className={[
                  "h-4 w-4 transition duration-300",
                  isFavorite ? "fill-current" : "fill-transparent",
                  favoritePulse ? "scale-[1.35]" : "scale-100",
                ].join(" ")} />
                {isFavorite ? "Ajouté aux favoris" : "Ajouter aux favoris"}
              </button>
            </div>
          </div>

        </div>
      </section>

      <section>
        <article className="rounded-[30px] bg-white px-4 py-5 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 sm:px-6 sm:py-6">
          <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#777]">Points forts</div>
          <h2 className="mt-2 text-[28px] font-bold tracking-[-0.04em] text-[#222]">Résumé de l&apos;offre</h2>
          <div className="mt-5 grid gap-3">
            {product.overview.map((point) => (
              <div key={point} className="flex items-start gap-3 rounded-[18px] bg-[#fafafa] px-4 py-4 ring-1 ring-black/5">
                <div className="mt-1 h-2.5 w-2.5 rounded-full bg-[#ff6a00]" />
                <p className="text-[15px] leading-7 text-[#444]">{point}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-[30px] bg-white px-4 py-5 shadow-[0_12px_36px_rgba(24,39,75,0.06)] ring-1 ring-black/5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#777]">Suggestions</div>
            <h2 className="mt-2 text-[28px] font-bold tracking-[-0.04em] text-[#222]">Produits associés</h2>
          </div>
          <Link href="/" className="text-[14px] font-semibold text-[#222] transition hover:text-[#ff6a00]">Retour à la sélection</Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {relatedProducts.map((relatedProduct) => (
            <Link key={relatedProduct.slug} href={`/products/${relatedProduct.slug}`} className="group overflow-hidden rounded-[24px] bg-white ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-[0_16px_34px_rgba(24,39,75,0.12)]">
              <div className="relative aspect-square bg-[#f4f4f4]">
                <Image src={relatedProduct.image} alt={relatedProduct.title} fill sizes="(min-width: 1280px) 18vw, (min-width: 768px) 35vw, 90vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
              </div>
              <div className="p-4">
                <div className="line-clamp-2 min-h-[48px] text-[16px] font-semibold leading-6 text-[#222]">{relatedProduct.title}</div>
                <div className="mt-3 text-[17px] font-bold tracking-[-0.03em] text-[#f05a00]">{relatedProduct.formattedPrice}</div>
                <div className="mt-2 text-[13px] text-[#666]">{relatedProduct.moqLabel}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>

    {isOrderModalOpen ? (
      <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/35 p-4">
        <div className="relative flex max-h-[92vh] w-full max-w-[760px] flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_30px_80px_rgba(0,0,0,0.24)]">
          <div className="flex items-start justify-between border-b border-[#ececec] px-4 py-4 sm:px-6 sm:py-5">
            <div>
              <h2 className="text-[24px] font-bold tracking-[-0.05em] text-[#222] sm:text-[32px]">Sélectionnez les options et la quantité</h2>
              <div className="mt-2 text-[14px] text-[#666]">Choisissez votre mix et voyez le prix unitaire évoluer selon la quantité totale.</div>
            </div>
            <button type="button" onClick={() => setIsOrderModalOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e2e2e2] text-[#444] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            <div className="inline-flex rounded-[6px] bg-[#ff5b1f] px-3 py-1 text-[13px] font-semibold text-white">Prix inférieur à celui des produits similaires</div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {sortedTiers.map((tier) => {
                const isActive = activeTier?.quantityLabel === tier.quantityLabel;

                return (
                  <div key={tier.quantityLabel} className={["rounded-[18px] border px-4 py-4", isActive ? "border-[#ff6a00] bg-[#fff6ef]" : "border-[#ececec] bg-white"].join(" ")}>
                    <div className="text-[14px] text-[#666]">{tier.quantityLabel}</div>
                    <div className={["mt-2 text-[22px] font-bold tracking-[-0.04em]", isActive ? "text-[#ff5b1f]" : "text-[#222]"].join(" ")}>{tier.formattedPrice}</div>
                  </div>
                );
              })}
            </div>

            {modalGroups.map((group) => (
              <div key={group.label} className="mt-7">
                <div className="text-[16px] font-semibold text-[#222]">{group.label}: <span className="font-medium">{selectedVariants[group.label]}</span></div>
                <div className="mt-3 flex flex-wrap gap-2.5">
                  {group.values.map((value) => {
                    const isSelected = selectedVariants[group.label] === value;

                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setSelectedVariants((current) => ({ ...current, [group.label]: value }))}
                        className={[
                          "rounded-[12px] border px-4 py-2 text-[15px] transition",
                          isSelected ? "border-[#222] bg-white text-[#111] shadow-[inset_0_0_0_1px_#111]" : "border-[#d7dbe2] bg-white text-[#444] hover:border-[#ffb48a]",
                        ].join(" ")}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="mt-8">
              <div className="text-[18px] font-semibold text-[#222]">Mode d&apos;expédition</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setShippingMethod("air")}
                  className={[
                    "rounded-[18px] border px-4 py-4 text-left transition",
                    shippingMethod === "air" ? "border-[#ff6a00] bg-[#fff5ed] shadow-[inset_0_0_0_1px_#ff6a00]" : "border-[#e5e5e5] bg-white hover:border-[#ffb48a]",
                  ].join(" ")}
                >
                  <div className="text-[17px] font-semibold text-[#222]">Par avion</div>
                  <div className="mt-1 text-[14px] text-[#666]">Plus rapide pour les colis legers et les urgences.</div>
                </button>
                <button
                  type="button"
                  onClick={() => setShippingMethod("sea")}
                  className={[
                    "rounded-[18px] border px-4 py-4 text-left transition",
                    shippingMethod === "sea" ? "border-[#ff6a00] bg-[#fff5ed] shadow-[inset_0_0_0_1px_#ff6a00]" : "border-[#e5e5e5] bg-white hover:border-[#ffb48a]",
                  ].join(" ")}
                >
                  <div className="text-[17px] font-semibold text-[#222]">Par bateau</div>
                  <div className="mt-1 text-[14px] text-[#666]">Mieux adapte aux commandes lourdes et gros volumes.</div>
                </button>
              </div>
              <div className="mt-3 rounded-[16px] border border-[#ececec] bg-[#fafafa] px-4 py-3 text-[14px] text-[#555]">
                Poids estime du colis: <span className="font-semibold text-[#222]">{totalWeightKg.toFixed(totalWeightKg >= 10 ? 0 : 2)} kg</span>
              </div>
              {exceedsSeaThreshold ? (
                <div className="mt-3 rounded-[16px] border border-[#ffd4b5] bg-[#fff4ea] px-4 py-3 text-[14px] font-medium text-[#c85a11]">
                  Ce colis depasse 5 kg, expédition maritime recommandée.
                </div>
              ) : null}
            </div>

            {mixGroup ? (
              <div className="mt-8">
                <div className="text-[18px] font-semibold text-[#222]">{mixGroup.label}</div>
                <div className="mt-4 space-y-4">
                  {mixGroup.values.map((value, index) => (
                    <div key={value} className="grid grid-cols-[60px_minmax(0,1fr)] items-center gap-4 rounded-[18px] border border-[#ececec] px-3 py-3 sm:grid-cols-[60px_minmax(0,1fr)_110px_126px]">
                      <div className="relative h-[52px] w-[52px] overflow-hidden rounded-[12px] bg-[#f4f4f4] ring-1 ring-black/5">
                        <Image src={product.gallery[index % product.gallery.length] ?? product.gallery[0]} alt={value} fill sizes="52px" className="object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[18px] font-medium text-[#222]">{value}</div>
                      </div>
                      <div className="text-left text-[18px] font-semibold tracking-[-0.03em] text-[#222] sm:text-right sm:text-[20px]">{formatMoney(currentUnitPrice)}</div>
                      <div className="flex items-center justify-start gap-2 sm:justify-end">
                        <button type="button" onClick={() => updateMixQuantity(value, -1)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d8dde6] text-[#444] transition hover:border-[#ff6a00] hover:text-[#ff6a00] disabled:cursor-not-allowed disabled:opacity-40" disabled={(mixQuantities[value] ?? 0) <= 0}>
                          <Minus className="h-4 w-4" />
                        </button>
                        <div className="min-w-[24px] text-center text-[22px] font-medium text-[#222]">{mixQuantities[value] ?? 0}</div>
                        <button type="button" onClick={() => updateMixQuantity(value, 1)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d8dde6] text-[#444] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-[#ececec] bg-white px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[14px] font-semibold text-[#666]">Sous-total</div>
                <div className="mt-1 text-[28px] font-bold tracking-[-0.04em] text-[#222]">
                  {formatMoney(subtotal)}
                  <span className="ml-2 text-[18px] font-medium text-[#666]">({formatMoney(currentUnitPrice)}/pièce)</span>
                </div>
                <div className="mt-1 text-[14px] text-[#666]">Quantité totale: {totalSelectedQuantity} pièce(s)</div>
                <div className="mt-1 text-[14px] text-[#666]">Expédition: {shippingMethod === "air" ? "Par avion" : shippingMethod === "sea" ? "Par bateau" : "à choisir"}</div>
              </div>
              <div className="grid gap-3 sm:min-w-[360px] sm:grid-cols-2">
                <button type="button" disabled={!canSubmitOrder} className="inline-flex h-13 items-center justify-center rounded-full bg-[#ff5b1f] px-6 text-[18px] font-semibold text-white transition hover:bg-[#ec510f] disabled:cursor-not-allowed disabled:bg-[#ffc09f]">
                  Commander
                </button>
                <button type="button" disabled={!canSubmitOrder} className="inline-flex h-13 items-center justify-center rounded-full border border-[#222] px-6 text-[18px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00] disabled:cursor-not-allowed disabled:border-[#d8d8d8] disabled:text-[#b0b0b0]">
                  Ajouter au panier
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}