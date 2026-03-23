"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Heart, Minus, Play, Plus, Share2, ShieldCheck, ShoppingCart, Store, TicketPercent, Truck, X } from "lucide-react";
import { useRef, useState } from "react";

import { useCart } from "@/components/cart-provider";

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
  const router = useRouter();
  const { addItem } = useCart();
  const [activeImage, setActiveImage] = useState(0);
  const [activeMedia, setActiveMedia] = useState<"photo" | "video">("photo");
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"overview" | "details" | "related">("overview");
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoritePulse, setFavoritePulse] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [sharePulse, setSharePulse] = useState(false);
  const [shippingMethod, setShippingMethod] = useState<"air" | "sea" | null>(null);
  const touchStartXRef = useRef<number | null>(null);
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
  const characteristics = characteristicRows.flat();
  const paymentMethods = [
    {
      label: "PayPal",
      icon: "https://img.icons8.com/?size=100&id=13611&format=png&color=000000",
      alt: "Icône PayPal",
    },
    {
      label: "Mobile Money",
      icon: "https://img.icons8.com/?size=100&id=YsVvEs0F7slI&format=png&color=000000",
      alt: "Icône Mobile Money",
    },
    {
      label: "Carte bancaire",
      icon: "https://img.icons8.com/?size=100&id=44779&format=png&color=000000",
      alt: "Icône carte bancaire",
    },
  ];
  const mobileServices = [
    product.shippingLabel,
    product.overview[0] ?? "Support fournisseur dédié.",
    product.overview[1] ?? "Suivi de commande et assistance après-vente.",
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
  const openOrderModal = () => {
    setIsOrderModalOpen(true);
  };
  const addSelectionToCart = () => {
    if (!canSubmitOrder) {
      return;
    }

    addItem(product.slug, totalSelectedQuantity);
    setIsOrderModalOpen(false);
    setShareFeedback("Produit ajouté au panier sourcing.");
  };
  const proceedToCheckout = () => {
    if (!canSubmitOrder) {
      return;
    }

    addItem(product.slug, totalSelectedQuantity);
    setIsOrderModalOpen(false);
    router.push("/cart");
  };
  const goToNextImage = () => {
    setActiveMedia("photo");
    setActiveImage((current) => (current + 1) % product.gallery.length);
  };
  const goToPreviousImage = () => {
    setActiveMedia("photo");
    setActiveImage((current) => (current - 1 + product.gallery.length) % product.gallery.length);
  };
  const handleImageTouchStart = (clientX: number) => {
    touchStartXRef.current = clientX;
  };
  const handleImageTouchEnd = (clientX: number) => {
    if (touchStartXRef.current === null || activeMedia !== "photo" || product.gallery.length < 2) {
      touchStartXRef.current = null;
      return;
    }

    const deltaX = clientX - touchStartXRef.current;
    touchStartXRef.current = null;

    if (Math.abs(deltaX) < 40) {
      return;
    }

    if (deltaX < 0) {
      goToNextImage();
      return;
    }

    goToPreviousImage();
  };
  const triggerShareFeedback = (message: string) => {
    setSharePulse(true);
    setShareFeedback(message);
    window.setTimeout(() => {
      setSharePulse(false);
    }, 320);
    window.setTimeout(() => {
      setShareFeedback((current) => (current === message ? null : current));
    }, 1800);
  };
  const shareProduct = async () => {
    const shareUrl = typeof window !== "undefined" ? window.location.href : `/products/${product.slug}`;

    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await navigator.share({
          title: product.title,
          text: product.shortTitle,
          url: shareUrl,
        });
        triggerShareFeedback("Produit partagé");
        return;
      }

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        triggerShareFeedback("Lien copié");
        return;
      }

      triggerShareFeedback("Partage indisponible");
    } catch {
      triggerShareFeedback("Partage annulé");
    }
  };

  return (
    <>
    <div className="space-y-6 pb-28 sm:pb-0">
      <div className="space-y-4 sm:hidden">
        <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_18px_42px_rgba(24,39,75,0.08)] ring-1 ring-black/5">
          <div
            className="relative aspect-[1/0.92] w-full overflow-hidden bg-[#f4f4f4]"
            onTouchStart={(event) => handleImageTouchStart(event.touches[0]?.clientX ?? 0)}
            onTouchEnd={(event) => handleImageTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
          >
            {product.badge ? (
              <div className="absolute left-3 top-3 z-10 rounded-full bg-[#de0505] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white">
                {product.badge}
              </div>
            ) : null}
            <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
              <button
                type="button"
                onClick={toggleFavorite}
                className={[
                  "relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white text-[#222] shadow-[0_10px_22px_rgba(0,0,0,0.14)] transition duration-300 active:scale-90",
                  favoritePulse ? "scale-[1.08] shadow-[0_14px_28px_rgba(255,106,0,0.22)]" : "scale-100",
                ].join(" ")}
              >
                <span
                  className={[
                    "absolute inset-0 rounded-full bg-[#ff6a00]/12 transition duration-300",
                    favoritePulse ? "scale-[1.35] opacity-100" : "scale-75 opacity-0",
                  ].join(" ")}
                />
                <span
                  className={[
                    "absolute h-7 w-7 rounded-full border border-[#ff6a00]/35 transition duration-300",
                    favoritePulse ? "scale-[1.85] opacity-100" : "scale-75 opacity-0",
                  ].join(" ")}
                />
                <Heart className={[
                  "relative z-[1] h-5 w-5 transition duration-300",
                  isFavorite ? "fill-current text-[#ff6a00]" : "fill-transparent",
                  favoritePulse ? "scale-[1.28] rotate-[-10deg]" : "scale-100 rotate-0",
                ].join(" ")} />
              </button>
              <button
                type="button"
                onClick={shareProduct}
                className={[
                  "relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white text-[#222] shadow-[0_10px_22px_rgba(0,0,0,0.14)] transition duration-300 active:scale-90",
                  sharePulse ? "scale-[1.08] shadow-[0_14px_28px_rgba(34,34,34,0.20)]" : "scale-100",
                ].join(" ")}
              >
                <span
                  className={[
                    "absolute inset-0 rounded-full bg-[#222]/8 transition duration-300",
                    sharePulse ? "scale-[1.35] opacity-100" : "scale-75 opacity-0",
                  ].join(" ")}
                />
                <span
                  className={[
                    "absolute h-7 w-7 rounded-full border border-[#222]/20 transition duration-300",
                    sharePulse ? "scale-[1.85] opacity-100" : "scale-75 opacity-0",
                  ].join(" ")}
                />
                <Share2 className={[
                  "relative z-[1] h-5 w-5 transition duration-300",
                  sharePulse ? "scale-[1.22] rotate-[14deg]" : "scale-100 rotate-0",
                ].join(" ")} />
              </button>
            </div>
            {shareFeedback ? (
              <div className="absolute right-3 top-[112px] z-10 rounded-full bg-[#222]/90 px-3 py-1.5 text-[11px] font-semibold text-white shadow-[0_10px_22px_rgba(0,0,0,0.16)] backdrop-blur-sm">
                {shareFeedback}
              </div>
            ) : null}

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
              <Image
                src={product.gallery[activeImage] ?? product.gallery[0]}
                alt={product.title}
                fill
                sizes="100vw"
                className="object-cover"
              />
            )}

            <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center px-3">
              <div className="inline-flex items-center gap-1 rounded-full bg-[#2f2d2a]/92 p-1 text-white shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() => setActiveMedia("photo")}
                  className={[
                    "rounded-full px-3 py-1.5 text-[11px] font-semibold transition",
                    activeMedia === "photo" ? "bg-white text-[#222]" : "text-white/82",
                  ].join(" ")}
                >
                  Photos {activeImage + 1}/{product.gallery.length}
                </button>
                <button
                  type="button"
                  onClick={() => setMobileTab("overview")}
                  className={[
                    "rounded-full px-3 py-1.5 text-[11px] font-semibold transition",
                    mobileTab === "overview" ? "bg-white text-[#222]" : "text-white/82",
                  ].join(" ")}
                >
                  Points forts
                </button>
                <button
                  type="button"
                  onClick={() => setMobileTab("details")}
                  className={[
                    "rounded-full px-3 py-1.5 text-[11px] font-semibold transition",
                    mobileTab === "details" ? "bg-white text-[#222]" : "text-white/82",
                  ].join(" ")}
                >
                  Service
                </button>
              </div>
            </div>

            {activeMedia === "photo" && product.gallery.length > 1 ? (
              <div className="absolute inset-x-0 bottom-16 z-10 flex justify-center gap-1.5 px-3">
                {product.gallery.map((image, index) => (
                  <button
                    key={`${image}-dot-${index}`}
                    type="button"
                    aria-label={`Afficher la photo ${index + 1}`}
                    onClick={() => {
                      setActiveMedia("photo");
                      setActiveImage(index);
                    }}
                    className={[
                      "h-1.5 rounded-full transition-all duration-300",
                      activeImage === index ? "w-5 bg-white" : "w-1.5 bg-white/55",
                    ].join(" ")}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex gap-2 overflow-x-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                    "relative h-[60px] min-w-[60px] overflow-hidden rounded-[14px] bg-[#f6f6f6] ring-1 transition",
                    isActive && activeMedia === "photo" ? "ring-[#ff6a00] shadow-[0_10px_18px_rgba(255,106,0,0.15)]" : "ring-black/5",
                  ].join(" ")}
                >
                  <Image src={image} alt={`${product.shortTitle} ${index + 1}`} fill sizes="60px" className="object-cover" />
                </button>
              );
            })}
            {product.videoUrl ? (
              <button
                type="button"
                onClick={() => setActiveMedia("video")}
                className={[
                  "relative h-[60px] min-w-[60px] overflow-hidden rounded-[14px] bg-[#111] ring-1 transition",
                  activeMedia === "video" ? "ring-[#ff6a00] shadow-[0_10px_18px_rgba(255,106,0,0.15)]" : "ring-black/5",
                ].join(" ")}
              >
                {product.videoPoster ? (
                  <Image src={product.videoPoster} alt={`${product.shortTitle} video`} fill sizes="60px" className="object-cover opacity-75" />
                ) : null}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#111]">
                    <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
                  </div>
                </div>
              </button>
            ) : null}
          </div>
        </section>

        <section className="rounded-[26px] bg-white px-3 py-4 shadow-[0_16px_34px_rgba(24,39,75,0.06)] ring-1 ring-black/5">
          <div className="grid grid-cols-2 gap-2 rounded-[22px] bg-[#f7f4f1] p-2">
            {product.tiers.slice(0, 2).map((tier, index) => (
              <div key={tier.quantityLabel} className="rounded-[18px] bg-white px-3 py-3 text-[#222] shadow-[0_8px_18px_rgba(17,24,39,0.05)]">
                <div className="text-[13px] font-black tracking-[-0.04em] text-[#111]">
                  {tier.formattedPrice}
                </div>
                <div className="mt-1 text-[11px] text-[#555]">
                  {index === 0 ? `Commande minimale : ${product.moq} unité` : tier.quantityLabel}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#fff1ea] px-3 py-2 text-[11px] font-semibold text-[#e25c12] ring-1 ring-[#ffd9c1]">
            <TicketPercent className="h-4 w-4" />
            Réduction disponible sur la première commande
          </div>

          <div className="mt-3 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-[18px] font-semibold leading-6 tracking-[-0.04em] text-[#222]">
                {product.title}
              </h1>
            </div>
            <button type="button" className="mt-1 text-[#222]">
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-3 inline-flex items-center rounded-full bg-[#fff5e8] px-3 py-2 text-[11px] font-semibold text-[#b77518] ring-1 ring-[#f3dfb8]">
            N°19 des plus populaires dans sa catégorie
          </div>

          <div className="mt-3 rounded-[18px] bg-[#faf7f3] px-3 py-3 text-[11px] text-[#666] ring-1 ring-[#efe7df]">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-medium text-[#444]">Paiements pris en charge :</span>
              {paymentMethods.map((method) => (
                <div key={method.label} className="inline-flex items-center gap-1.5 rounded-[10px] bg-white px-2.5 py-1.5 ring-1 ring-black/5">
                  <Image src={method.icon} alt={method.alt} width={16} height={16} unoptimized className="h-4 w-4 object-contain" />
                  <span className="font-semibold text-[#2e3b52]">{method.label}</span>
                </div>
              ))}
              <div className="inline-flex items-center gap-1.5 rounded-[10px] bg-white px-2.5 py-1.5 ring-1 ring-black/5">
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff6a00] px-1 text-[9px] font-black text-white">
                  3X
                </span>
                <span className="font-semibold text-[#2e3b52]">Paiement en 3X</span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-b border-[#eee7e0] pb-3 text-center">
            {[
              { key: "overview", label: "Aperçu" },
              { key: "details", label: "Détails" },
              { key: "related", label: "Autres produits" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setMobileTab(tab.key as "overview" | "details" | "related")}
                className={[
                  "pb-2 text-[13px] font-semibold transition",
                  mobileTab === tab.key ? "border-b-2 border-[#222] text-[#222]" : "text-[#7a726b]",
                ].join(" ")}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {mobileTab === "overview" ? (
            <div className="space-y-4 pt-4">
              <div className="rounded-[20px] bg-[#fbfbfb] px-4 py-4 ring-1 ring-black/5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#777]">Points forts</div>
                <div className="mt-3 space-y-3">
                  {product.overview.map((point) => (
                    <div key={point} className="flex items-start gap-3">
                      <div className="mt-1 h-2.5 w-2.5 rounded-full bg-[#ff6a00]" />
                      <p className="text-[14px] leading-6 text-[#444]">{point}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[20px] bg-white px-4 py-4 ring-1 ring-black/5">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#fff3ea] text-[#d85a00]">
                    <Store className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#d85a00]">Verified Fournisseur</div>
                    <div className="mt-1 text-[18px] font-bold tracking-[-0.04em] text-[#222]">{product.supplierName}</div>
                    <div className="mt-1 text-[13px] text-[#666]">{product.supplierLocation} · {product.yearsInBusiness} ans</div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {mobileTab === "details" ? (
            <div className="space-y-4 pt-4">
              <div className="rounded-[20px] bg-[#fafafa] px-4 py-4 ring-1 ring-black/5">
                <h2 className="text-[17px] font-bold tracking-[-0.04em] text-[#222]">Caractéristiques</h2>
                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 rounded-[18px] bg-white px-4 py-4 ring-1 ring-[#eee]">
                  {characteristics.slice(0, 6).map((item) => (
                    <div key={`${item.label}-${item.value}`} className="min-w-0">
                      <div className="text-[11px] text-[#888]">{item.label}</div>
                      <div className="mt-1 text-[14px] font-semibold leading-5 text-[#222]">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[20px] bg-white px-4 py-4 ring-1 ring-black/5">
                <div className="text-[17px] font-bold tracking-[-0.04em] text-[#222]">Service</div>
                <div className="mt-3 space-y-3">
                  {mobileServices.map((item) => (
                    <div key={item} className="rounded-[16px] bg-[#fafafa] px-3 py-3 ring-1 ring-[#efefef]">
                      <div className="flex items-start gap-3">
                        <Truck className="mt-0.5 h-4 w-4 text-[#222]" />
                        <div className="text-[14px] leading-5 text-[#222]">{item}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[20px] bg-white px-4 py-4 ring-1 ring-black/5">
                <div className="text-[17px] font-bold tracking-[-0.04em] text-[#222]">Adresse de livraison {product.currencyCode}</div>
                <div className="mt-3 rounded-[18px] bg-[#fafafa] px-4 py-4 ring-1 ring-[#efefef]">
                  <div className="text-[12px] text-[#777]">Temps de traitement</div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[16px] font-black text-[#111]">{product.responseTime}</div>
                      <div className="mt-1 text-[13px] text-[#666]">1 unité</div>
                    </div>
                    <div>
                      <div className="text-[16px] font-black text-[#111]">Fixe</div>
                      <div className="mt-1 text-[13px] text-[#666]">1+ unité</div>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-[14px] leading-6 text-[#444]">
                  Frais d&apos;expédition et date de livraison fixes. Passez commande maintenant pour finaliser votre achat.
                </p>
              </div>
            </div>
          ) : null}

          {mobileTab === "related" ? (
            <div className="space-y-4 pt-4">
              <div className="text-[17px] font-bold tracking-[-0.04em] text-[#222]">Autres produits du moment</div>
              <div className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {relatedProducts.map((relatedProduct) => (
                  <Link key={relatedProduct.slug} href={`/products/${relatedProduct.slug}`} className="group min-w-[164px] snap-start overflow-hidden rounded-[20px] bg-white p-2.5 shadow-[0_14px_28px_rgba(17,24,39,0.08)] ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(17,24,39,0.12)]">
                    <div className="relative aspect-[0.95] overflow-hidden rounded-[16px] bg-[#f4f4f4]">
                      <Image src={relatedProduct.image} alt={relatedProduct.title} fill sizes="44vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    </div>
                    <div className="mt-2 line-clamp-2 min-h-[34px] text-[12px] font-semibold leading-4 text-[#222]">{relatedProduct.title}</div>
                    <div className="mt-2 text-[14px] font-bold text-[#f05a00]">{relatedProduct.formattedPrice}</div>
                    <div className="mt-1 text-[10px] text-[#666]">{relatedProduct.moqLabel}</div>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <div className="hidden sm:block">
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

      <div className="fixed inset-x-0 bottom-[72px] z-[95] border-t border-black/10 bg-white/96 px-4 py-3 backdrop-blur sm:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openOrderModal}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-[#222] bg-white px-4 text-[15px] font-semibold text-[#222]"
          >
            Ajouter au panier
          </button>
          <button
            type="button"
            onClick={openOrderModal}
            className="inline-flex h-12 flex-[1.08] items-center justify-center rounded-full bg-[#e85b0c] px-4 text-[15px] font-semibold text-white shadow-[0_14px_26px_rgba(232,91,12,0.28)]"
          >
            Commander
          </button>
        </div>
      </div>
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
                <button type="button" onClick={proceedToCheckout} disabled={!canSubmitOrder} className="inline-flex h-13 items-center justify-center rounded-full bg-[#ff5b1f] px-6 text-[18px] font-semibold text-white transition hover:bg-[#ec510f] disabled:cursor-not-allowed disabled:bg-[#ffc09f]">
                  Commander
                </button>
                <button type="button" onClick={addSelectionToCart} disabled={!canSubmitOrder} className="inline-flex h-13 items-center justify-center rounded-full border border-[#222] px-6 text-[18px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00] disabled:cursor-not-allowed disabled:border-[#d8d8d8] disabled:text-[#b0b0b0]">
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