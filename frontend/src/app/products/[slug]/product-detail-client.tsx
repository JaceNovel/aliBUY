"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, ExternalLink, Heart, Minus, Play, Plus, Share2, ShieldCheck, ShoppingCart, Store, TicketPercent, Truck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useCart } from "@/components/cart-provider";
import { isSupportedDirectDeliveryCountry } from "@/lib/alibaba-sourcing";
import { CURRENCY_CONFIG, type CurrencyCode } from "@/lib/pricing-options";
import { getApplicableVariantPricing, getDisplayPriceTiers, resolveProductPriceSummaryUsd, resolveProductUnitPriceUsd } from "@/lib/product-variant-pricing";

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

type DetailVariantPrice = {
  selections: Record<string, string>;
  priceUsd: number;
  minPriceUsd?: number;
  maxPriceUsd?: number;
  minimumQuantity?: number;
  maximumQuantity?: number;
  quantityLabel?: string;
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
};

type ProductDetailClientProps = {
  product: {
    slug: string;
    title: string;
    shortTitle: string;
    locale: string;
    currencyCode: string;
    countryCode: string;
    categoryTitle: string;
    moq: number;
    moqVerified?: boolean;
    packaging: string;
    packageDimensionsCm?: {
      lengthCm: number;
      widthCm: number;
      heightCm: number;
    };
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
    variantPricing: DetailVariantPrice[];
    specs: DetailSpec[];
    formattedPriceRange: string;
    badge?: string;
    sourceUrl?: string;
  };
  relatedProducts: RelatedProduct[];
  initialIsFavorite: boolean | null;
};

export function ProductDetailClient({ product, relatedProducts, initialIsFavorite }: ProductDetailClientProps) {
    const selectedCurrency = CURRENCY_CONFIG[(product.currencyCode as CurrencyCode)] ?? CURRENCY_CONFIG.USD;
  const router = useRouter();
  const { addItem } = useCart();
  const [activeImage, setActiveImage] = useState(0);
  const [activeMedia, setActiveMedia] = useState<"photo" | "video">("photo");
  const [isImageLightboxOpen, setIsImageLightboxOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"overview" | "details" | "related">("overview");
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite ?? false);
  const [favoritePulse, setFavoritePulse] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [sharePulse, setSharePulse] = useState(false);
  const [shippingMethod, setShippingMethod] = useState<"air" | "sea" | null>(null);
  const [orderQuantity, setOrderQuantity] = useState(Math.max(product.moq, 1));
  const touchStartXRef = useRef<number | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});

  useEffect(() => {
    router.prefetch("/cart");
  }, [router]);

  useEffect(() => {
    if (initialIsFavorite !== null) {
      setIsFavorite(initialIsFavorite);
      return;
    }

    let isCancelled = false;

    const hydrateFavorite = async () => {
      try {
        const response = await fetch(`/api/favorites?productSlug=${encodeURIComponent(product.slug)}`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok || isCancelled || typeof payload?.isFavorite !== "boolean") {
          return;
        }

        setIsFavorite(payload.isFavorite);
      } catch {
        // Ignore non-critical hydration errors for favorite state.
      }
    };

    void hydrateFavorite();

    return () => {
      isCancelled = true;
    };
  }, [initialIsFavorite, product.slug]);
  const mixGroup = product.variantGroups[0];
  const modalGroups = product.variantGroups.slice(1);
  const hasVariantChoices = product.variantGroups.length > 0;
  const requiredVariantLabels = product.variantGroups.map((group) => group.label);
  const variantSelectionInstruction = requiredVariantLabels.join(", ");
  const freeShippingThresholdLabel = new Intl.NumberFormat(product.locale, {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(20000);
  const [mixQuantities, setMixQuantities] = useState<Record<string, number>>(() => {
    return Object.fromEntries((mixGroup?.values ?? []).map((value, index) => [value, index === 0 ? 0 : 0]));
  });
  const resolveVariantGroupSelection = (group: DetailVariantGroup, fallbackToFirstValue = false) => {
    const selectedValue = selectedVariants[group.label];
    if (selectedValue && group.values.includes(selectedValue)) {
      return selectedValue;
    }

    return fallbackToFirstValue ? group.values[0] ?? "" : "";
  };
  const lowerTitle = product.title.toLowerCase();
  const referenceCode = product.title.match(/\b[A-Z0-9]{3,}(?:[- ][A-Z0-9]{2,})?\b/)?.[0] ?? product.shortTitle.match(/\b[A-Z0-9]{3,}(?:[- ][A-Z0-9]{2,})?\b/)?.[0] ?? "Selon catalogue";
  const inferredType = /keyboard|clavier/.test(lowerTitle)
    ? /mouse|souris/.test(lowerTitle)
      ? "Combo clavier et souris"
      : "Clavier"
    : /mouse|souris/.test(lowerTitle)
      ? "Souris gaming"
      : "Accessoire informatique";
  const inferredConnection = /tri-mode/.test(lowerTitle)
    ? "Tri-mode"
    : /bluetooth|bt/.test(lowerTitle)
      ? "Bluetooth"
      : /wireless|2\.4g/.test(lowerTitle)
        ? "Sans fil"
        : /wired|usb/.test(lowerTitle)
          ? "Filaire"
            : "Selon catalogue";
          const inferredSensor = product.title.match(/PAW\s?\d+/i)?.[0]?.toUpperCase() ?? product.title.match(/\d{4,5}\s?DPI/i)?.[0]?.toUpperCase() ?? "Selon catalogue";
  const inferredUse = /office/.test(lowerTitle) && /gaming/.test(lowerTitle)
    ? "Gaming et bureautique"
    : /gaming/.test(lowerTitle)
      ? "Gaming"
      : /office/.test(lowerTitle)
        ? "Bureautique"
        : "Usage polyvalent";
    const weightLabel = product.itemWeightGrams > 0 ? `${product.itemWeightGrams} g` : "Selon catalogue";
  const dimensionsLabel = product.packageDimensionsCm
    ? `${product.packageDimensionsCm.lengthCm} x ${product.packageDimensionsCm.widthCm} x ${product.packageDimensionsCm.heightCm} cm`
    : product.packaging;
  const displayShippingLabel = /^(Expédition|Expedition)\s+[A-Z]{2,3}$/i.test(product.shippingLabel) ? "Expédition" : product.shippingLabel;
  const sourceProductUrl = (() => {
    if (typeof product.sourceUrl === "string" && product.sourceUrl.trim()) {
      return product.sourceUrl.trim();
    }

    return /^\d{12,20}$/.test(product.slug) ? `https://www.aliexpress.com/item/${product.slug}.html` : "";
  })();
  const parsedLotCbm = Number(product.lotCbm.replace(",", "."));
  const lotLabel = Number.isFinite(parsedLotCbm) && parsedLotCbm > 0 ? `${product.lotCbm} m3` : "Selon catalogue";
  const characteristicRows = [
    [
      { label: "Type", value: product.specs[0]?.value ?? inferredType },
      { label: "Référence", value: referenceCode },
    ],
    [
      { label: "Connexion", value: product.specs[1]?.value ?? inferredConnection },
      { label: "Capteur", value: product.specs[2]?.value ?? inferredSensor },
    ],
    [
      { label: "Dimensions", value: dimensionsLabel },
      { label: "Emballage", value: product.packaging },
    ],
    [
      { label: "Poids", value: weightLabel },
      { label: "Usage", value: product.specs[3]?.value ?? inferredUse },
    ],
    [
      { label: "Support", value: product.responseTime || "Selon disponibilite" },
      { label: "Volume", value: lotLabel },
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
  const formatMoney = (amount: number) => {
    const localizedAmount = amount * selectedCurrency.rateFromUsd;

    return new Intl.NumberFormat(product.locale, {
      style: "currency",
      currency: selectedCurrency.code,
      minimumFractionDigits: localizedAmount >= 100 ? 0 : 2,
      maximumFractionDigits: localizedAmount >= 100 ? 0 : 2,
    }).format(localizedAmount);
  };
  const formatPriceSummary = (summary: { minUsd: number; maxUsd?: number; exact: boolean }) => {
    if (typeof summary.maxUsd === "number" && summary.maxUsd > summary.minUsd) {
      return `${formatMoney(summary.minUsd)} - ${formatMoney(summary.maxUsd)}`;
    }

    return formatMoney(summary.minUsd);
  };
  const normalizeTierPriceUsd = (priceUsd: number) => {
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
      return 0;
    }

    // Some imported tiers may be persisted in XOF and then interpreted as USD.
    // For XOF storefronts, normalize tiny outlier values back to USD scale.
    if (selectedCurrency.code === "XOF" && priceUsd < 0.01) {
      return priceUsd * CURRENCY_CONFIG.XOF.rateFromUsd;
    }

    return priceUsd;
  };
  const normalizedProductTiers = product.tiers.map((tier) => ({
    ...tier,
    priceUsd: normalizeTierPriceUsd(tier.priceUsd),
  }));
  const productWithNormalizedTiers = {
    ...product,
    tiers: normalizedProductTiers,
    variantPricing: product.variantPricing,
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
  const totalSelectedQuantity = mixGroup
    ? Object.values(mixQuantities).reduce((sum, quantity) => sum + quantity, 0)
    : orderQuantity;
  const totalWeightKg = (product.itemWeightGrams * totalSelectedQuantity) / 1000;
  const totalWeightLabel = product.itemWeightGrams > 0 ? `${totalWeightKg.toFixed(totalWeightKg >= 10 ? 0 : 2)} kg` : "Selon catalogue";
  const exceedsSeaThreshold = product.itemWeightGrams > 0 && totalWeightKg > 5;
  const modalSelections = Object.fromEntries(
    modalGroups.flatMap((group) => {
      const value = resolveVariantGroupSelection(group);
      return value ? [[group.label, value] as const] : [];
    }),
  );
  const previewModalSelections = Object.fromEntries(
    modalGroups.flatMap((group) => {
      const value = resolveVariantGroupSelection(group, true);
      return value ? [[group.label, value] as const] : [];
    }),
  );
  const previewSelection = mixGroup
    ? {
        [mixGroup.label]: Object.entries(mixQuantities).find(([, quantity]) => quantity > 0)?.[0] ?? mixGroup.values[0] ?? "",
        ...previewModalSelections,
      }
    : previewModalSelections;
  const missingVariantGroups = modalGroups.filter((group) => !resolveVariantGroupSelection(group));
  const hasAllRequiredVariantSelections = missingVariantGroups.length === 0;
  const displayTiers = getDisplayPriceTiers(productWithNormalizedTiers, previewSelection).map((tier) => ({
    ...tier,
    formattedPrice: formatMoney(tier.priceUsd),
  }));
  const sortedTiers = [...displayTiers].sort((left, right) => getTierMinimum(left.quantityLabel) - getTierMinimum(right.quantityLabel));
  const activeTier = [...sortedTiers].reverse().find((tier) => totalSelectedQuantity >= getTierMinimum(tier.quantityLabel)) ?? sortedTiers[0];
  const hasVariantSpecificPricing = getApplicableVariantPricing(productWithNormalizedTiers, previewSelection).length > 0;
  const currentPriceSummary = resolveProductPriceSummaryUsd(productWithNormalizedTiers, {
    quantity: hasVariantSpecificPricing ? Math.max(1, mixGroup ? (mixQuantities[previewSelection[mixGroup.label]] ?? 1) : totalSelectedQuantity) : totalSelectedQuantity,
    selection: previewSelection,
  });
  const currentUnitPrice = resolveProductUnitPriceUsd(productWithNormalizedTiers, {
    quantity: hasVariantSpecificPricing ? Math.max(1, mixGroup ? (mixQuantities[previewSelection[mixGroup.label]] ?? 1) : totalSelectedQuantity) : totalSelectedQuantity,
    selection: previewSelection,
  });
  const subtotal = mixGroup
    ? mixGroup.values.reduce((sum, value) => {
        const quantity = mixQuantities[value] ?? 0;
        if (quantity <= 0) {
          return sum;
        }

        const selection = {
          [mixGroup.label]: value,
          ...modalSelections,
        };
        const variantRules = getApplicableVariantPricing(productWithNormalizedTiers, selection);
        const unitPrice = resolveProductUnitPriceUsd(productWithNormalizedTiers, {
          quantity: variantRules.length > 0 ? quantity : totalSelectedQuantity,
          selection,
        });

        return sum + (unitPrice * quantity);
      }, 0)
    : currentUnitPrice * totalSelectedQuantity;
  const subtotalRange = mixGroup
    ? mixGroup.values.reduce((acc, value) => {
        const quantity = mixQuantities[value] ?? 0;
        if (quantity <= 0) {
          return acc;
        }

        const selection = {
          [mixGroup.label]: value,
          ...modalSelections,
        };
        const summary = resolveProductPriceSummaryUsd({
          ...product,
          tiers: product.tiers,
          variantPricing: product.variantPricing,
        }, {
          quantity: getApplicableVariantPricing({ ...product, tiers: product.tiers, variantPricing: product.variantPricing }, selection).length > 0
            ? Math.max(1, quantity)
            : Math.max(1, totalSelectedQuantity),
          selection,
        });

        return {
          minUsd: acc.minUsd + (summary.minUsd * quantity),
          maxUsd: acc.maxUsd + ((summary.maxUsd ?? summary.minUsd) * quantity),
        };
      }, { minUsd: 0, maxUsd: 0 })
    : {
        minUsd: currentPriceSummary.minUsd * totalSelectedQuantity,
        maxUsd: (currentPriceSummary.maxUsd ?? currentPriceSummary.minUsd) * totalSelectedQuantity,
      };
  const hasSubtotalRange = subtotalRange.maxUsd > subtotalRange.minUsd;
  const dynamicPriceLabel = formatPriceSummary(currentPriceSummary);
  const supportsDirectAliExpressDelivery = isSupportedDirectDeliveryCountry(product.countryCode);
  const shippingChoices = supportsDirectAliExpressDelivery
    ? [
        {
          key: "air" as const,
          title: "Express",
          description: "Livraison rapide a domicile avec suivi prioritaire.",
          feeLabel: "+2,99 €",
          summaryLabel: "Express (+2,99 €)",
        },
        {
          key: "sea" as const,
          title: "Standard",
          description: "Livraison standard offerte pour la France.",
          feeLabel: "Gratuit",
          summaryLabel: "Standard (Gratuit)",
        },
      ]
    : [
        {
          key: "air" as const,
          title: "Avion",
          description: "Transport aerien pour les colis urgents ou de faible poids.",
          feeLabel: "Rapide",
          summaryLabel: "Avion",
        },
        {
          key: "sea" as const,
          title: "Bateau",
          description: "Transport maritime mieux adapte aux commandes lourdes et gros volumes.",
          feeLabel: "Economique",
          summaryLabel: "Bateau",
        },
      ];
  const selectedShippingChoice = shippingChoices.find((option) => option.key === shippingMethod) ?? null;
  const dynamicPriceHint = hasVariantSpecificPricing
    ? currentPriceSummary.exact
      ? `Prix fixe pour ${Object.entries(previewSelection).map(([, value]) => value).filter(Boolean).join(" · ") || "la variante choisie"}`
      : `Plage de prix pour ${Object.entries(previewSelection).map(([, value]) => value).filter(Boolean).join(" · ") || "la variante choisie"}`
    : product.shippingLabel || product.overview[0] || "Prix public mis a jour selon le catalogue";
  const updateMixQuantity = (value: string, delta: number) => {
    setMixQuantities((current) => {
      const nextValue = Math.max(0, (current[value] ?? 0) + delta);
      return {
        ...current,
        [value]: nextValue,
      };
    });
  };
  const updateOrderQuantity = (delta: number) => {
    setOrderQuantity((current) => Math.max(product.moq, current + delta));
  };
  const handleVariantPreviewSelection = (group: DetailVariantGroup, value: string) => {
    if (mixGroup && group.label === mixGroup.label) {
      setMixQuantities(Object.fromEntries(mixGroup.values.map((entry) => [entry, entry === value ? Math.max(orderQuantity, product.moq, 1) : 0])));
      setIsOrderModalOpen(true);
      return;
    }

    setSelectedVariants((current) => ({ ...current, [group.label]: value }));
  };
  const toggleFavorite = async () => {
    if (favoriteBusy) {
      return;
    }

    const nextFavorite = !isFavorite;
    setFavoriteBusy(true);
    setFavoritePulse(true);
    setIsFavorite(nextFavorite);

    try {
      const response = await fetch("/api/favorites", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ productSlug: product.slug }),
      });

      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/products/${product.slug}`)}`);
        return;
      }

      const payload = await response.json().catch(() => null);
      if (!response.ok || typeof payload?.isFavorite !== "boolean") {
        setIsFavorite(!nextFavorite);
        return;
      }

      setIsFavorite(payload.isFavorite);
      router.prefetch("/favorites");
    } finally {
      window.setTimeout(() => {
        setFavoritePulse(false);
      }, 320);
      setFavoriteBusy(false);
    }
  };
  const canSubmitOrder = totalSelectedQuantity > 0 && shippingMethod !== null && hasAllRequiredVariantSelections;
  const buildOrderSelections = () => {
    if (!mixGroup) {
      return [{ quantity: orderQuantity, selectedVariants: modalSelections }];
    }

    return mixGroup.values
      .map((value) => ({
        quantity: mixQuantities[value] ?? 0,
        selectedVariants: {
          [mixGroup.label]: value,
          ...modalSelections,
        },
      }))
      .filter((entry) => entry.quantity > 0);
  };
  const openOrderModal = () => {
    setIsOrderModalOpen(true);
  };
  const addSelectionToCart = () => {
    if (!canSubmitOrder) {
      return;
    }

    buildOrderSelections().forEach((entry) => {
      addItem(product.slug, entry.quantity, entry.selectedVariants);
    });
    setIsOrderModalOpen(false);
    setShareFeedback("Produit ajouté au panier sourcing.");
  };
  const proceedToCheckout = () => {
    if (!canSubmitOrder) {
      return;
    }

    buildOrderSelections().forEach((entry) => {
      addItem(product.slug, entry.quantity, entry.selectedVariants);
    });
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
    type ShareCapableNavigator = Navigator & {
      clipboard?: Clipboard;
      share?: (data?: ShareData) => Promise<void>;
    };

    const shareUrl = typeof window !== "undefined" ? window.location.href : `/products/${product.slug}`;
    const browserNavigator: ShareCapableNavigator | undefined = typeof window !== "undefined"
      ? (window.navigator as ShareCapableNavigator)
      : undefined;
    const clipboard = browserNavigator?.clipboard;

    try {
      if (browserNavigator?.share) {
        await browserNavigator.share({
          title: product.title,
          text: product.shortTitle,
          url: shareUrl,
        });
        triggerShareFeedback("Produit partagé");
        return;
      }

      if (clipboard?.writeText) {
        await clipboard.writeText(shareUrl);
        triggerShareFeedback("Lien copié");
        return;
      }

      triggerShareFeedback("Partage indisponible");
    } catch {
      triggerShareFeedback("Partage annulé");
    }
  };

  const openImageLightbox = () => {
    if (activeMedia !== "photo" || product.gallery.length === 0) {
      return;
    }

    setIsImageLightboxOpen(true);
  };

  useEffect(() => {
    if (!isImageLightboxOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsImageLightboxOpen(false);
        return;
      }

      if (event.key === "ArrowRight" && product.gallery.length > 1) {
        event.preventDefault();
        setActiveMedia("photo");
        setActiveImage((current) => (current + 1) % product.gallery.length);
        return;
      }

      if (event.key === "ArrowLeft" && product.gallery.length > 1) {
        event.preventDefault();
        setActiveMedia("photo");
        setActiveImage((current) => (current - 1 + product.gallery.length) % product.gallery.length);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isImageLightboxOpen, product.gallery.length]);

  const offerMetrics = [
    { label: "Ventes", value: product.soldLabel },
    { label: "MOQ", value: product.moqVerified ? `${product.moq} pcs` : `${product.moq} min.` },
    { label: "Expédition", value: displayShippingLabel },
    { label: "Personnalisation", value: product.customizationLabel },
  ];
  const supplierMetrics = [
    { label: "Transactions", value: product.transactionsLabel },
    { label: "Implantation", value: product.supplierLocation || "Réseau fournisseur vérifié" },
    { label: "Réponse", value: product.responseTime || "Sous 24 h" },
    { label: "Expérience", value: `${product.yearsInBusiness}+ ans` },
  ];
  const serviceHighlights = [
    {
      title: "Achat accompagné",
      description: product.overview[1] ?? "Assistance AfriPay dédiée avant et après validation.",
    },
    {
      title: "Logistique cadrée",
      description: `Livraison gratuite dès ${freeShippingThresholdLabel} selon le poids et la zone.`,
    },
    {
      title: "Sélection fiable",
      description: product.shippingLabel || "Produit importé avec contrôle des informations clés.",
    },
  ];
  const mobileSectionTabs = [
    { key: "overview" as const, label: "Vue d'ensemble" },
    { key: "details" as const, label: "Fiche & service" },
    { key: "related" as const, label: "Produits liés" },
  ];

  return (
    <>
    <div className="space-y-8 pb-28 sm:space-y-10 sm:pb-0">
      <section className="relative overflow-hidden rounded-[32px] border border-white/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(255,245,238,0.92)_45%,rgba(245,241,237,0.96))] px-3 py-3 shadow-[0_24px_80px_rgba(34,22,10,0.08)] sm:px-5 sm:py-5 lg:px-6 lg:py-6">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-16 top-0 h-52 w-52 rounded-full bg-[#ffb06f]/18 blur-3xl" />
          <div className="absolute right-0 top-10 h-64 w-64 rounded-full bg-[#f4d9bc]/18 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-white/35 blur-3xl" />
        </div>

        <div className="relative flex flex-wrap items-center gap-2 text-[12px] font-medium text-[#706458]">
          <Link href="/" className="transition hover:text-[#ff6a00]">Accueil</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span>Produits</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="max-w-[220px] truncate text-[#221d17]">{product.shortTitle}</span>
        </div>

        <div className="relative mt-4 grid gap-4 xl:grid-cols-[92px_minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div className="order-2 flex gap-2 overflow-x-auto pb-1 xl:order-1 xl:flex-col xl:overflow-visible xl:pb-0">
            {product.videoUrl ? (
              <button
                type="button"
                onClick={() => setActiveMedia("video")}
                className={[
                  "relative h-[68px] min-w-[68px] overflow-hidden rounded-[20px] bg-[#16120f] ring-1 transition sm:h-[76px] sm:min-w-[76px]",
                  activeMedia === "video" ? "ring-[#d96a1b] shadow-[0_16px_30px_rgba(217,106,27,0.22)]" : "ring-black/10 hover:ring-[#f0b481]",
                ].join(" ")}
              >
                {product.videoPoster ? (
                  <Image src={product.videoPoster} alt={`${product.shortTitle} video`} fill sizes="76px" className="object-cover opacity-75" />
                ) : null}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#16120f] shadow-[0_10px_22px_rgba(0,0,0,0.22)]">
                    <Play className="ml-0.5 h-4 w-4 fill-current" />
                  </div>
                </div>
              </button>
            ) : null}
            {product.gallery.map((image, index) => {
              const isActive = activeImage === index && activeMedia === "photo";

              return (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => {
                    setActiveMedia("photo");
                    setActiveImage(index);
                  }}
                  className={[
                    "relative h-[68px] min-w-[68px] overflow-hidden rounded-[20px] bg-white ring-1 transition sm:h-[76px] sm:min-w-[76px]",
                    isActive ? "ring-[#d96a1b] shadow-[0_16px_30px_rgba(217,106,27,0.18)]" : "ring-black/8 hover:ring-[#f0b481]",
                  ].join(" ")}
                >
                  <Image src={image} alt={`${product.shortTitle} ${index + 1}`} fill sizes="76px" className="object-cover" />
                </button>
              );
            })}
          </div>

          <div className="order-1 xl:order-2">
            <div
              className="relative overflow-hidden rounded-[30px] border border-white/70 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.85),rgba(243,236,229,0.96)_52%,rgba(232,226,220,0.98))] shadow-[0_30px_70px_rgba(38,25,12,0.12)]"
              onTouchEnd={(event) => handleImageTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
            >
              {product.badge ? (
                <div className="absolute left-4 top-4 z-10 rounded-full bg-[#aa2014] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white shadow-[0_12px_30px_rgba(170,32,20,0.28)] sm:left-5 sm:top-5 sm:text-[11px]">
                  {product.badge}
                </div>
              ) : null}

              <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleFavorite}
                  className={[
                    "relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/65 bg-white/85 text-[#221d17] shadow-[0_16px_32px_rgba(34,29,23,0.12)] backdrop-blur transition duration-300 active:scale-95",
                    favoritePulse ? "scale-[1.06] shadow-[0_18px_34px_rgba(217,106,27,0.22)]" : "",
                  ].join(" ")}
                >
                  <Heart className={[
                    "h-4.5 w-4.5 transition duration-300",
                    isFavorite ? "fill-current text-[#d96a1b]" : "fill-transparent",
                    favoritePulse ? "scale-[1.24]" : "",
                  ].join(" ")} />
                </button>
                <button
                  type="button"
                  onClick={shareProduct}
                  className={[
                    "relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/65 bg-white/85 text-[#221d17] shadow-[0_16px_32px_rgba(34,29,23,0.12)] backdrop-blur transition duration-300 active:scale-95",
                    sharePulse ? "scale-[1.06]" : "",
                  ].join(" ")}
                >
                  <Share2 className={["h-4.5 w-4.5 transition duration-300", sharePulse ? "scale-[1.18] rotate-[10deg]" : ""].join(" ")} />
                </button>
              </div>

              {shareFeedback ? (
                <div className="absolute right-4 top-[68px] z-10 rounded-full bg-[#221d17]/90 px-3 py-1.5 text-[11px] font-semibold text-white shadow-[0_14px_26px_rgba(0,0,0,0.22)] backdrop-blur">
                  {shareFeedback}
                </div>
              ) : null}

              <div className="absolute inset-x-0 top-0 z-[1] flex items-center justify-between px-4 pt-16 sm:px-5 sm:pt-18">
                <div className="inline-flex rounded-full border border-white/65 bg-white/74 p-1 text-[11px] font-semibold text-[#5f5449] shadow-[0_10px_22px_rgba(34,29,23,0.08)] backdrop-blur">
                  <button
                    type="button"
                    onClick={() => setActiveMedia("photo")}
                    className={["rounded-full px-3 py-1.5 transition", activeMedia === "photo" ? "bg-[#221d17] text-white" : ""].join(" ")}
                  >
                    Photos
                  </button>
                  {product.videoUrl ? (
                    <button
                      type="button"
                      onClick={() => setActiveMedia("video")}
                      className={["rounded-full px-3 py-1.5 transition", activeMedia === "video" ? "bg-[#221d17] text-white" : ""].join(" ")}
                    >
                      Video
                    </button>
                  ) : null}
                </div>

                {activeMedia === "photo" && product.gallery.length > 1 ? (
                  <div className="rounded-full border border-white/65 bg-white/74 px-3 py-1.5 text-[11px] font-semibold text-[#221d17] shadow-[0_10px_22px_rgba(34,29,23,0.08)] backdrop-blur">
                    {activeImage + 1}/{product.gallery.length}
                  </div>
                ) : null}
              </div>

              <div className="relative aspect-[1/1.04] w-full sm:aspect-[1/0.92]">
                {activeMedia === "video" && product.videoUrl ? (
                  <video
                    key={product.videoUrl}
                    controls
                    poster={product.videoPoster}
                    className="h-full w-full bg-black object-contain"
                    preload="metadata"
                    playsInline
                  >
                    <source src={product.videoUrl} type="video/mp4" />
                  </video>
                ) : (
                  <button type="button" onClick={openImageLightbox} className="relative block h-full w-full cursor-zoom-in">
                    <Image
                      src={product.gallery[activeImage] ?? product.gallery[0]}
                      alt={product.title}
                      fill
                      priority
                      sizes="(min-width: 1280px) 40vw, 100vw"
                      className="object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#1c1712]/32 via-transparent to-transparent" />
                  </button>
                )}
              </div>

              {activeMedia === "photo" && product.gallery.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={goToPreviousImage}
                    className="absolute left-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/80 text-[#221d17] shadow-[0_14px_30px_rgba(34,29,23,0.14)] backdrop-blur transition hover:bg-white sm:inline-flex"
                    aria-label="Image précédente"
                  >
                    <ChevronRight className="h-4.5 w-4.5 rotate-180" />
                  </button>
                  <button
                    type="button"
                    onClick={goToNextImage}
                    className="absolute right-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/80 text-[#221d17] shadow-[0_14px_30px_rgba(34,29,23,0.14)] backdrop-blur transition hover:bg-white sm:inline-flex"
                    aria-label="Image suivante"
                  >
                    <ChevronRight className="h-4.5 w-4.5" />
                  </button>
                </>
              ) : null}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {offerMetrics.map((item, index) => (
                <div
                  key={item.label}
                  className={[
                    "rounded-[20px] border px-4 py-4 backdrop-blur",
                    index === 0 ? "border-[#f1d2b8] bg-[#fff6ee]" : "border-white/65 bg-white/72",
                  ].join(" ")}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b7a69]">{item.label}</div>
                  <div className="mt-2 text-[14px] font-semibold leading-5 text-[#221d17] sm:text-[15px]">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="order-3 min-w-0">
            <div className="rounded-[30px] border border-[#ead9cb] bg-[linear-gradient(180deg,rgba(255,251,247,0.98),rgba(255,246,239,0.95))] p-5 shadow-[0_24px_70px_rgba(80,45,15,0.08)] sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#f1cfb1] bg-white/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b46520]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Selection verifiee
                </span>
                <span className="inline-flex rounded-full border border-white/80 bg-white/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#66584a]">
                  {product.categoryTitle}
                </span>
              </div>

              <h1 className="mt-4 text-[27px] font-bold leading-[1.02] tracking-[-0.06em] text-[#1f1914] sm:text-[34px] lg:text-[42px]">
                {product.title}
              </h1>

              <p className="mt-3 max-w-[58ch] text-[14px] leading-6 text-[#685b4f] sm:text-[15px]">
                {product.overview[0] ?? "Produit sélectionné pour une présentation plus claire, plus haut de gamme et plus rassurante à l’achat."}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3 text-[13px] text-[#66584a]">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/72 px-3 py-2">
                  <Store className="h-4 w-4 text-[#d96a1b]" />
                  {product.supplierName}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/72 px-3 py-2">
                  <Truck className="h-4 w-4 text-[#d96a1b]" />
                  {displayShippingLabel}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/72 px-3 py-2">
                  <TicketPercent className="h-4 w-4 text-[#d96a1b]" />
                  Offre adaptée à la première commande
                </div>
              </div>

              <div className="mt-6 rounded-[28px] border border-[#efcfb4] bg-[#201813] p-5 text-white shadow-[0_24px_60px_rgba(25,14,6,0.24)] sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d9b89d]">Prix premium sourcing</div>
                    <div className="mt-2 text-[32px] font-bold tracking-[-0.07em] text-white sm:text-[40px]">
                      {dynamicPriceLabel}
                    </div>
                    <div className="mt-2 max-w-[42ch] text-[13px] leading-6 text-[#d8cbc1] sm:text-[14px]">{dynamicPriceHint}</div>
                  </div>
                  <div className="rounded-[18px] border border-white/12 bg-white/8 px-4 py-3 text-right">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d9b89d]">Unité estimée</div>
                    <div className="mt-1 text-[22px] font-bold tracking-[-0.05em] text-white">{formatMoney(currentUnitPrice)}</div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[20px] border border-white/12 bg-white/8 px-4 py-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d9b89d]">Poids importé</div>
                    <div className="mt-2 text-[20px] font-semibold tracking-[-0.04em] text-white">{weightLabel}</div>
                  </div>
                  <div className="rounded-[20px] border border-white/12 bg-white/8 px-4 py-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d9b89d]">Volume logistique</div>
                    <div className="mt-2 text-[20px] font-semibold tracking-[-0.04em] text-white">{lotLabel}</div>
                  </div>
                </div>

                <div className="mt-5 rounded-[20px] border border-white/12 bg-white/8 p-4 text-[13px] leading-6 text-[#efe3da]">
                  Livraison gratuite à partir de <span className="font-semibold text-white">{freeShippingThresholdLabel}</span>. Les expéditions lourdes peuvent basculer vers un mode plus adapté pour préserver coût et délai.
                </div>

                <div className="mt-5 space-y-2.5">
                  {sortedTiers.map((tier, index) => (
                    <div
                      key={tier.quantityLabel}
                      className={[
                        "grid gap-1 rounded-[18px] border px-4 py-3 text-[13px] sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-3",
                        activeTier?.quantityLabel === tier.quantityLabel
                          ? "border-[#efcfb4] bg-[#fff4eb] text-[#1f1914]"
                          : "border-white/10 bg-white/6 text-white",
                      ].join(" ")}
                    >
                      <div className={activeTier?.quantityLabel === tier.quantityLabel ? "font-semibold" : "font-medium text-[#f2e5db]"}>{tier.quantityLabel}</div>
                      <div className={activeTier?.quantityLabel === tier.quantityLabel ? "font-bold text-[#d96a1b]" : "font-bold text-white"}>{tier.formattedPrice}</div>
                      <div className={["text-[12px]", activeTier?.quantityLabel === tier.quantityLabel ? "text-[#5f5449]" : "text-[#d8cbc1]"].join(" ")}>
                        {tier.note ?? (index === 0 ? "Niveau d'entrée" : "Tarif quantitatif")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {hasVariantChoices ? (
                  <div className="rounded-[22px] border border-[#efcfb4] bg-white/72 px-4 py-4 text-[14px] leading-6 text-[#6c5239]">
                    Les options obligatoires ne sont pas présélectionnées. Le client doit choisir <span className="font-semibold text-[#1f1914]">{variantSelectionInstruction}</span> avant validation pour garder un achat clair et sans ambiguïté.
                  </div>
                ) : null}

                {product.variantGroups.length > 0 ? (
                  <div className="rounded-[24px] border border-[#ead9cb] bg-white/72 p-4 sm:p-5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f7b67]">Configuration</div>
                    <div className="mt-4 space-y-4">
                      {product.variantGroups.map((group) => (
                        <div key={`preview-${group.label}`}>
                          <div className="flex items-center justify-between gap-4">
                            <div className="text-[15px] font-semibold text-[#1f1914]">{group.label}</div>
                            <div className="text-[12px] text-[#76685c]">
                              {mixGroup && group.label === mixGroup.label
                                ? `${totalSelectedQuantity} sélection${totalSelectedQuantity > 1 ? "s" : ""}`
                                : resolveVariantGroupSelection(group) || "A choisir"}
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {group.values.map((value) => {
                              const isSelected = mixGroup && group.label === mixGroup.label
                                ? (mixQuantities[value] ?? 0) > 0
                                : selectedVariants[group.label] === value;

                              return (
                                <button
                                  key={`${group.label}-${value}`}
                                  type="button"
                                  onClick={() => handleVariantPreviewSelection(group, value)}
                                  className={[
                                    "rounded-full border px-3.5 py-2 text-[13px] font-medium transition sm:px-4",
                                    isSelected
                                      ? "border-[#d96a1b] bg-[#fff2e6] text-[#c25b14] shadow-[0_10px_22px_rgba(217,106,27,0.12)]"
                                      : "border-[#e6ddd5] bg-white text-[#2c241e] hover:border-[#efcfb4]",
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
                  </div>
                ) : null}

                {!mixGroup ? (
                  <div className="rounded-[24px] border border-[#ead9cb] bg-white/72 px-4 py-4 sm:px-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f7b67]">Quantité</div>
                        <div className="mt-2 text-[15px] text-[#5f5449]">{product.moqVerified ? `Minimum ${product.moq} ${product.moq > 1 ? "pieces" : "piece"}` : "Minimum à confirmer"}</div>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-[#e3d8cf] bg-white px-2 py-2 shadow-[0_10px_20px_rgba(34,29,23,0.05)]">
                        <button type="button" onClick={() => updateOrderQuantity(-1)} disabled={orderQuantity <= product.moq} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d8cfc7] text-[#54493f] transition hover:border-[#d96a1b] hover:text-[#d96a1b] disabled:cursor-not-allowed disabled:opacity-40">
                          <Minus className="h-4 w-4" />
                        </button>
                        <div className="min-w-[44px] text-center text-[22px] font-semibold tracking-[-0.04em] text-[#1f1914]">{orderQuantity}</div>
                        <button type="button" onClick={() => updateOrderQuantity(1)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d8cfc7] text-[#54493f] transition hover:border-[#d96a1b] hover:text-[#d96a1b]">
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={openOrderModal}
                    className="inline-flex h-13 items-center justify-center gap-3 rounded-full bg-[#d96a1b] px-6 text-[16px] font-semibold text-white shadow-[0_16px_30px_rgba(217,106,27,0.26)] transition hover:bg-[#c65f16]"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Commander maintenant
                  </button>
                  <button
                    type="button"
                    onClick={toggleFavorite}
                    className={[
                      "inline-flex h-13 items-center justify-center gap-3 rounded-full border px-6 text-[16px] font-semibold transition",
                      isFavorite
                        ? "border-[#d96a1b] bg-[#fff1e6] text-[#d96a1b]"
                        : "border-[#2b241e] bg-white/72 text-[#2b241e] hover:border-[#d96a1b] hover:text-[#d96a1b]",
                    ].join(" ")}
                  >
                    <Heart className={["h-4 w-4", isFavorite ? "fill-current" : "fill-transparent"].join(" ")} />
                    {isFavorite ? "Ajouté aux favoris" : "Ajouter aux favoris"}
                  </button>
                </div>

                {hasVariantChoices ? (
                  <div className="text-[13px] leading-5 text-[#6d5c4f]">
                    La fenêtre de commande centralise le choix final, les quantités et le mode d’expédition pour éviter les erreurs de sélection.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:hidden">
        <div className="flex gap-2 overflow-x-auto rounded-full border border-white/70 bg-white/72 p-1.5 shadow-[0_14px_34px_rgba(34,29,23,0.08)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {mobileSectionTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setMobileTab(tab.key)}
              className={[
                "whitespace-nowrap rounded-full px-4 py-2 text-[12px] font-semibold transition",
                mobileTab === tab.key ? "bg-[#221d17] text-white" : "text-[#6d5f52]",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {mobileTab === "overview" ? (
          <section className="grid gap-4">
            <article className="rounded-[28px] border border-white/70 bg-white/76 p-5 shadow-[0_20px_50px_rgba(34,29,23,0.08)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a7a6b]">Narratif produit</div>
              <h2 className="mt-3 text-[26px] font-bold tracking-[-0.06em] text-[#1f1914]">Pourquoi cette offre attire</h2>
              <div className="mt-5 space-y-3">
                {product.overview.map((point) => (
                  <div key={point} className="rounded-[20px] border border-[#f1e1d4] bg-[#fff8f3] px-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 h-2.5 w-2.5 rounded-full bg-[#d96a1b]" />
                      <p className="text-[14px] leading-6 text-[#4d433a]">{point}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(34,24,19,0.98),rgba(52,39,31,0.96))] p-5 text-white shadow-[0_22px_56px_rgba(25,14,6,0.18)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d1b59c]">Réseau fournisseur</div>
              <div className="mt-3 text-[24px] font-bold tracking-[-0.05em]">AfriPay+ sourcing</div>
              <div className="mt-2 text-[14px] leading-6 text-[#dfd3ca]">{product.transactionsLabel}</div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {supplierMetrics.slice(0, 4).map((item) => (
                  <div key={item.label} className="rounded-[18px] border border-white/10 bg-white/6 px-4 py-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d1b59c]">{item.label}</div>
                    <div className="mt-2 text-[14px] font-semibold leading-5 text-white">{item.value}</div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        ) : null}

        {mobileTab === "details" ? (
          <section className="grid gap-4">
            <article className="rounded-[28px] border border-white/70 bg-white/76 p-5 shadow-[0_20px_50px_rgba(34,29,23,0.08)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a7a6b]">Fiche technique</div>
                  <h2 className="mt-2 text-[24px] font-bold tracking-[-0.05em] text-[#1f1914]">Caractéristiques clés</h2>
                </div>
                {sourceProductUrl ? (
                  <a href={sourceProductUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#ead9cb] bg-white text-[#3d342d] transition hover:border-[#d96a1b] hover:text-[#d96a1b]" aria-label="Ouvrir la fiche AliExpress">
                    <ExternalLink className="h-4.5 w-4.5" />
                  </a>
                ) : null}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {characteristics.slice(0, 8).map((item) => (
                  <div key={`${item.label}-${item.value}`} className="rounded-[18px] border border-[#eee2d7] bg-[#fff8f3] px-4 py-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8f7b67]">{item.label}</div>
                    <div className="mt-2 text-[14px] font-semibold leading-5 text-[#1f1914]">{item.value}</div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[28px] border border-white/70 bg-white/76 p-5 shadow-[0_20px_50px_rgba(34,29,23,0.08)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a7a6b]">Services inclus</div>
              <h2 className="mt-2 text-[24px] font-bold tracking-[-0.05em] text-[#1f1914]">Expérience plus rassurante</h2>
              <div className="mt-5 space-y-3">
                {serviceHighlights.map((item) => (
                  <div key={item.title} className="rounded-[20px] border border-[#eee2d7] bg-[#fff8f3] px-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#221d17] text-white">
                        <Truck className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-[15px] font-semibold text-[#1f1914]">{item.title}</div>
                        <div className="mt-1 text-[14px] leading-6 text-[#5a4e44]">{item.description}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        ) : null}

        {mobileTab === "related" ? (
          <section className="grid gap-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a7a6b]">Suggestions</div>
                <h2 className="mt-2 text-[24px] font-bold tracking-[-0.05em] text-[#1f1914]">Produits associés</h2>
              </div>
              <Link href="/" className="text-[13px] font-semibold text-[#2b241e] transition hover:text-[#d96a1b]">Retour</Link>
            </div>
            <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {relatedProducts.map((relatedProduct) => (
                <Link key={relatedProduct.slug} href={`/products/${relatedProduct.slug}`} className="group min-w-[190px] snap-start overflow-hidden rounded-[24px] border border-white/70 bg-white/78 p-2.5 shadow-[0_18px_42px_rgba(34,29,23,0.09)] transition hover:-translate-y-1">
                  <div className="relative aspect-[0.95] overflow-hidden rounded-[18px] bg-[#efe8e2]">
                    <Image src={relatedProduct.image} alt={relatedProduct.title} fill sizes="56vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                  </div>
                  <div className="px-1 pb-1 pt-3">
                    <div className="line-clamp-2 min-h-[42px] text-[13px] font-semibold leading-5 text-[#1f1914]">{relatedProduct.title}</div>
                    <div className="mt-2 text-[16px] font-bold tracking-[-0.04em] text-[#d96a1b]">{relatedProduct.formattedPrice}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <div className="hidden gap-4 sm:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section className="space-y-4">
          <article className="rounded-[30px] border border-white/70 bg-white/76 p-6 shadow-[0_22px_60px_rgba(34,29,23,0.08)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a7a6b]">Résumé de l&apos;offre</div>
            <h2 className="mt-3 text-[32px] font-bold tracking-[-0.06em] text-[#1f1914]">Une présentation plus désirée, plus lisible, plus vendable</h2>
            <div className="mt-6 grid gap-3">
              {product.overview.map((point) => (
                <div key={point} className="rounded-[22px] border border-[#efe2d6] bg-[#fff8f3] px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-[#d96a1b]" />
                    <p className="text-[15px] leading-7 text-[#4d433a]">{point}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="overflow-hidden rounded-[30px] border border-white/70 bg-white/76 shadow-[0_22px_60px_rgba(34,29,23,0.08)]">
            <div className="flex items-center justify-between gap-4 border-b border-[#eee4db] px-6 py-5">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a7a6b]">Fiche technique</div>
                <h2 className="mt-2 text-[30px] font-bold tracking-[-0.05em] text-[#1f1914]">Caractéristiques structurées</h2>
              </div>
              {sourceProductUrl ? (
                <a href={sourceProductUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-[#ead9cb] bg-white px-4 py-2 text-[13px] font-semibold text-[#2c241e] transition hover:border-[#d96a1b] hover:text-[#d96a1b]">
                  Source fournisseur
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
            </div>
            <div className="grid gap-px bg-[#eee4db] sm:grid-cols-2">
              {characteristics.slice(0, 8).map((item) => (
                <div key={`${item.label}-${item.value}`} className="bg-white px-6 py-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f7b67]">{item.label}</div>
                  <div className="mt-2 text-[16px] font-semibold leading-6 text-[#1f1914]">{item.value}</div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <aside className="space-y-4">
          <article className="rounded-[30px] border border-white/70 bg-[linear-gradient(180deg,rgba(34,24,19,0.98),rgba(52,39,31,0.96))] p-6 text-white shadow-[0_24px_64px_rgba(25,14,6,0.18)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d1b59c]">Partenaire sourcing</div>
            <h2 className="mt-3 text-[30px] font-bold tracking-[-0.05em]">Confiance, cadence, clarté</h2>
            <div className="mt-3 text-[14px] leading-6 text-[#dfd3ca]">
              {product.supplierName} avec un cadrage logistique pensé pour une prise de décision plus simple côté client.
            </div>
            <div className="mt-6 grid gap-3">
              {supplierMetrics.map((item) => (
                <div key={item.label} className="rounded-[20px] border border-white/10 bg-white/6 px-4 py-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d1b59c]">{item.label}</div>
                  <div className="mt-2 text-[16px] font-semibold leading-6 text-white">{item.value}</div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[30px] border border-white/70 bg-white/76 p-6 shadow-[0_22px_60px_rgba(34,29,23,0.08)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a7a6b]">Paiement & service</div>
            <h2 className="mt-3 text-[28px] font-bold tracking-[-0.05em] text-[#1f1914]">Réassurance premium</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {paymentMethods.map((method) => (
                <div key={method.label} className="inline-flex items-center gap-2 rounded-full border border-[#ead9cb] bg-white px-3 py-2 text-[12px] font-semibold text-[#2c241e]">
                  <Image src={method.icon} alt={method.alt} width={16} height={16} unoptimized className="h-4 w-4 object-contain" />
                  {method.label}
                </div>
              ))}
              <div className="inline-flex items-center gap-2 rounded-full border border-[#ead9cb] bg-white px-3 py-2 text-[12px] font-semibold text-[#2c241e]">
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#d96a1b] px-1 text-[9px] font-black text-white">3X</span>
                Paiement en 3X
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {serviceHighlights.map((item) => (
                <div key={item.title} className="rounded-[20px] border border-[#efe2d6] bg-[#fff8f3] px-4 py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#221d17] text-white">
                      <Truck className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[15px] font-semibold text-[#1f1914]">{item.title}</div>
                      <div className="mt-1 text-[14px] leading-6 text-[#5a4e44]">{item.description}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </div>

      <section className="rounded-[30px] border border-white/70 bg-white/76 p-5 shadow-[0_22px_60px_rgba(34,29,23,0.08)] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a7a6b]">Suggestions</div>
            <h2 className="mt-2 text-[28px] font-bold tracking-[-0.05em] text-[#1f1914] sm:text-[34px]">Produits associés</h2>
          </div>
          <Link href="/" className="text-[14px] font-semibold text-[#2b241e] transition hover:text-[#d96a1b]">Retour à la sélection</Link>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {relatedProducts.map((relatedProduct) => (
            <Link key={relatedProduct.slug} href={`/products/${relatedProduct.slug}`} className="group overflow-hidden rounded-[24px] border border-white/70 bg-white p-2.5 shadow-[0_18px_40px_rgba(34,29,23,0.08)] transition hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(34,29,23,0.12)]">
              <div className="relative aspect-[0.95] overflow-hidden rounded-[18px] bg-[#efe8e2]">
                <Image src={relatedProduct.image} alt={relatedProduct.title} fill sizes="(min-width: 1536px) 16vw, (min-width: 1280px) 18vw, (min-width: 768px) 32vw, 82vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
              </div>
              <div className="px-1 pb-1 pt-3">
                <div className="line-clamp-2 min-h-[40px] text-[13px] font-semibold leading-5 text-[#1f1914] sm:min-h-[44px]">{relatedProduct.title}</div>
                <div className="mt-2 text-[16px] font-bold tracking-[-0.04em] text-[#d96a1b]">{relatedProduct.formattedPrice}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-[72px] z-[140] border-t border-[#e8ddd2] bg-[rgba(255,250,246,0.94)] px-4 py-3 shadow-[0_-10px_30px_rgba(34,29,23,0.08)] backdrop-blur sm:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openOrderModal}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-[#2b241e] bg-white px-4 text-[15px] font-semibold text-[#2b241e]"
          >
            Ajouter au panier
          </button>
          <button
            type="button"
            onClick={openOrderModal}
            className="inline-flex h-12 flex-[1.08] items-center justify-center rounded-full bg-[#d96a1b] px-4 text-[15px] font-semibold text-white shadow-[0_14px_26px_rgba(217,106,27,0.28)]"
          >
            Commander
          </button>
        </div>
      </div>
    </div>

    {isImageLightboxOpen ? (
      <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/88 p-3 sm:p-6">
        <button type="button" onClick={() => setIsImageLightboxOpen(false)} className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white transition hover:border-white/50 sm:right-6 sm:top-6" aria-label="Fermer l'image agrandie">
          <X className="h-5 w-5" />
        </button>

        {product.gallery.length > 1 ? (
          <button type="button" onClick={goToPreviousImage} className="absolute left-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white transition hover:border-white/50 sm:left-6" aria-label="Image précédente">
            <ChevronRight className="h-5 w-5 rotate-180" />
          </button>
        ) : null}

        <div className="flex max-h-full w-full max-w-[1280px] flex-col items-center gap-4">
          <div className="relative h-[70vh] w-full overflow-hidden rounded-[22px] bg-[#111] sm:h-[78vh]">
            <Image
              src={product.gallery[activeImage] ?? product.gallery[0]}
              alt={`${product.title} - vue agrandie`}
              fill
              sizes="100vw"
              className="object-contain"
              priority
            />
          </div>

          {product.gallery.length > 1 ? (
            <div className="flex max-w-full gap-2 overflow-x-auto rounded-full bg-black/35 px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {product.gallery.map((image, index) => (
                <button
                  key={`${image}-lightbox-${index}`}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  className={[
                    "relative h-[62px] min-w-[62px] overflow-hidden rounded-[14px] ring-2 transition",
                    activeImage === index ? "ring-[#ff6a00]" : "ring-transparent hover:ring-white/40",
                  ].join(" ")}
                >
                  <Image src={image} alt={`${product.shortTitle} aperçu ${index + 1}`} fill sizes="62px" className="object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {product.gallery.length > 1 ? (
          <button type="button" onClick={goToNextImage} className="absolute right-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white transition hover:border-white/50 sm:right-6" aria-label="Image suivante">
            <ChevronRight className="h-5 w-5" />
          </button>
        ) : null}
      </div>
    ) : null}

    {isOrderModalOpen ? (
      <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/35 p-2.5 sm:p-4">
        <div className="relative flex max-h-[90vh] w-full max-w-[760px] flex-col overflow-hidden rounded-[22px] bg-white shadow-[0_30px_80px_rgba(0,0,0,0.24)] sm:max-h-[92vh] sm:rounded-[28px]">
          <div className="flex items-start justify-between border-b border-[#ececec] px-3 py-3 sm:px-6 sm:py-5">
            <div>
              <h2 className="text-[19px] font-bold tracking-[-0.05em] text-[#222] sm:text-[32px]">Sélectionnez les options obligatoires et la quantité</h2>
              <div className="mt-1 text-[12px] leading-5 text-[#666] sm:mt-2 sm:text-[14px]">
                {hasVariantChoices
                  ? `Choisissez ${variantSelectionInstruction} avant la commande. Aucun attribut n'est preselectionne automatiquement.`
                  : "Choisissez la quantité et voyez le prix unitaire évoluer selon la quantité totale."}
              </div>
            </div>
            <button type="button" onClick={() => setIsOrderModalOpen(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#e2e2e2] text-[#444] transition hover:border-[#ff6a00] hover:text-[#ff6a00] sm:h-10 sm:w-10">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="overflow-y-auto px-3 py-3 sm:px-6 sm:py-5">
            <div className="inline-flex rounded-[6px] bg-[#ff5b1f] px-2.5 py-1 text-[11px] font-semibold text-white sm:px-3 sm:text-[13px]">Prix inférieur à celui des produits similaires</div>

            {hasVariantChoices ? (
              <div className="mt-3 rounded-[14px] border border-[#ffd4b5] bg-[#fff4ea] px-3 py-2.5 text-[12px] font-medium leading-5 text-[#c85a11] sm:px-4 sm:py-3 sm:text-[14px]">
                Sélection obligatoire avant validation: <span className="font-semibold">{variantSelectionInstruction}</span>.
              </div>
            ) : null}

            <div className="mt-3 grid gap-2.5 sm:mt-5 sm:gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {sortedTiers.map((tier) => {
                const isActive = activeTier?.quantityLabel === tier.quantityLabel;

                return (
                  <div key={tier.quantityLabel} className={["rounded-[14px] border px-3 py-2.5 sm:rounded-[18px] sm:px-4 sm:py-4", isActive ? "border-[#ff6a00] bg-[#fff6ef]" : "border-[#ececec] bg-white"].join(" ")}>
                    <div className="text-[12px] text-[#666] sm:text-[14px]">{tier.quantityLabel}</div>
                    <div className={["mt-1 text-[18px] font-bold tracking-[-0.04em] sm:mt-2 sm:text-[22px]", isActive ? "text-[#ff5b1f]" : "text-[#222]"].join(" ")}>{tier.formattedPrice}</div>
                  </div>
                );
              })}
            </div>

            {modalGroups.map((group) => (
              <div key={group.label} className="mt-5 sm:mt-7">
                <div className="text-[14px] font-semibold text-[#222] sm:text-[16px]">{group.label}: <span className="font-medium">{resolveVariantGroupSelection(group) || "Choisir"}</span></div>
                <div className="mt-2 flex flex-wrap gap-2 sm:mt-3 sm:gap-2.5">
                  {group.values.map((value) => {
                    const isSelected = selectedVariants[group.label] === value;

                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setSelectedVariants((current) => ({ ...current, [group.label]: value }))}
                        className={[
                          "rounded-[10px] border px-3 py-1.5 text-[13px] transition sm:rounded-[12px] sm:px-4 sm:py-2 sm:text-[15px]",
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

            <div className="mt-6 sm:mt-8">
              <div className="text-[16px] font-semibold text-[#222] sm:text-[18px]">Mode d&apos;expédition</div>
              <div className="mt-3 grid gap-2.5 sm:mt-4 sm:gap-3 sm:grid-cols-2">
                {shippingChoices.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setShippingMethod(option.key)}
                    className={[
                      "rounded-[14px] border px-3 py-3 text-left transition sm:rounded-[18px] sm:px-4 sm:py-4",
                      shippingMethod === option.key ? "border-[#ff6a00] bg-[#fff5ed] shadow-[inset_0_0_0_1px_#ff6a00]" : "border-[#e5e5e5] bg-white hover:border-[#ffb48a]",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[15px] font-semibold text-[#222] sm:text-[17px]">{option.title}</div>
                      <div className="text-[13px] font-bold text-[#ff5b1f] sm:text-[15px]">{option.feeLabel}</div>
                    </div>
                    <div className="mt-1 text-[12px] leading-5 text-[#666] sm:text-[14px]">{option.description}</div>
                  </button>
                ))}
              </div>
              <div className="mt-2.5 rounded-[14px] border border-[#ececec] bg-[#fafafa] px-3 py-2.5 text-[12px] text-[#555] sm:mt-3 sm:rounded-[16px] sm:px-4 sm:py-3 sm:text-[14px]">
                Poids estime du colis: <span className="font-semibold text-[#222]">{totalWeightLabel}</span>
              </div>
              {exceedsSeaThreshold && !supportsDirectAliExpressDelivery ? (
                <div className="mt-2.5 rounded-[14px] border border-[#ffd4b5] bg-[#fff4ea] px-3 py-2.5 text-[12px] font-medium text-[#c85a11] sm:mt-3 sm:rounded-[16px] sm:px-4 sm:py-3 sm:text-[14px]">
                  Ce colis depasse 5 kg, expédition maritime recommandée.
                </div>
              ) : null}
            </div>

            {mixGroup ? (
              <div className="mt-6 sm:mt-8">
                <div className="text-[16px] font-semibold text-[#222] sm:text-[18px]">{mixGroup.label}</div>
                <div className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-4">
                  {mixGroup.values.map((value, index) => (
                    <div key={value} className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[14px] border border-[#ececec] px-2.5 py-2.5 sm:grid-cols-[60px_minmax(0,1fr)_110px_126px] sm:gap-4 sm:rounded-[18px] sm:px-3 sm:py-3">
                      <div className="relative h-[44px] w-[44px] overflow-hidden rounded-[10px] bg-[#f4f4f4] ring-1 ring-black/5 sm:h-[52px] sm:w-[52px] sm:rounded-[12px]">
                        <Image src={product.gallery[index % product.gallery.length] ?? product.gallery[0]} alt={value} fill sizes="52px" className="object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[14px] font-medium text-[#222] sm:text-[18px]">{value}</div>
                        <div className="mt-0.5 text-[12px] font-semibold tracking-[-0.03em] text-[#222] sm:hidden">{formatPriceSummary(resolveProductPriceSummaryUsd({ ...product, tiers: product.tiers, variantPricing: product.variantPricing }, {
                          quantity: getApplicableVariantPricing({ ...product, tiers: product.tiers, variantPricing: product.variantPricing }, { [mixGroup.label]: value, ...modalSelections }).length > 0
                            ? Math.max(1, mixQuantities[value] ?? 1)
                            : Math.max(1, totalSelectedQuantity),
                          selection: { [mixGroup.label]: value, ...modalSelections },
                        }))}</div>
                      </div>
                      <div className="hidden text-left text-[18px] font-semibold tracking-[-0.03em] text-[#222] sm:block sm:text-right sm:text-[20px]">{formatPriceSummary(resolveProductPriceSummaryUsd({ ...product, tiers: product.tiers, variantPricing: product.variantPricing }, {
                        quantity: getApplicableVariantPricing({ ...product, tiers: product.tiers, variantPricing: product.variantPricing }, { [mixGroup.label]: value, ...modalSelections }).length > 0
                          ? Math.max(1, mixQuantities[value] ?? 1)
                          : Math.max(1, totalSelectedQuantity),
                        selection: { [mixGroup.label]: value, ...modalSelections },
                      }))}</div>
                      <div className="flex items-center justify-start gap-1.5 sm:justify-end sm:gap-2">
                        <button type="button" onClick={() => updateMixQuantity(value, -1)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#d8dde6] text-[#444] transition hover:border-[#ff6a00] hover:text-[#ff6a00] disabled:cursor-not-allowed disabled:opacity-40 sm:h-10 sm:w-10" disabled={(mixQuantities[value] ?? 0) <= 0}>
                          <Minus className="h-4 w-4" />
                        </button>
                        <div className="min-w-[20px] text-center text-[18px] font-medium text-[#222] sm:min-w-[24px] sm:text-[22px]">{mixQuantities[value] ?? 0}</div>
                        <button type="button" onClick={() => updateMixQuantity(value, 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#d8dde6] text-[#444] transition hover:border-[#ff6a00] hover:text-[#ff6a00] sm:h-10 sm:w-10">
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-[14px] border border-[#ececec] bg-[#fafafa] px-3 py-3 sm:mt-8 sm:rounded-[18px] sm:px-4 sm:py-4">
                <div className="text-[16px] font-semibold text-[#222] sm:text-[18px]">Quantité</div>
                <div className="mt-2.5 flex items-center justify-between gap-3 sm:mt-3 sm:gap-4">
                  <div>
                    <div className="text-[13px] text-[#555] sm:text-[15px]">Commande minimale</div>
                    <div className="mt-1 text-[12px] text-[#777] sm:text-[14px]">{product.moqVerified ? `${product.moq} ${product.moq > 1 ? "pieces" : "piece"}` : "A confirmer"}</div>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <button type="button" onClick={() => updateOrderQuantity(-1)} disabled={orderQuantity <= product.moq} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#d8dde6] text-[#444] transition hover:border-[#ff6a00] hover:text-[#ff6a00] disabled:cursor-not-allowed disabled:opacity-40 sm:h-10 sm:w-10">
                      <Minus className="h-4 w-4" />
                    </button>
                    <div className="min-w-[24px] text-center text-[18px] font-medium text-[#222] sm:min-w-[28px] sm:text-[22px]">{orderQuantity}</div>
                    <button type="button" onClick={() => updateOrderQuantity(1)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#d8dde6] text-[#444] transition hover:border-[#ff6a00] hover:text-[#ff6a00] sm:h-10 sm:w-10">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-[#ececec] bg-white px-3 py-3 sm:px-6 sm:py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div>
                <div className="text-[12px] font-semibold text-[#666] sm:text-[14px]">Sous-total</div>
                <div className="mt-1 text-[22px] font-bold tracking-[-0.04em] text-[#222] sm:text-[28px]">
                  {hasSubtotalRange ? `${formatMoney(subtotalRange.minUsd)} - ${formatMoney(subtotalRange.maxUsd)}` : formatMoney(subtotal)}
                  <span className="ml-1.5 text-[13px] font-medium text-[#666] sm:ml-2 sm:text-[18px]">({formatPriceSummary(currentPriceSummary)}/pièce)</span>
                </div>
                <div className="mt-1 text-[12px] text-[#666] sm:text-[14px]">Quantité totale: {totalSelectedQuantity} pièce(s)</div>
                <div className="mt-1 text-[12px] text-[#666] sm:text-[14px]">Expédition: {selectedShippingChoice?.summaryLabel ?? "à choisir"}</div>
                {missingVariantGroups.length > 0 ? <div className="mt-1 text-[12px] font-medium text-[#c85a11] sm:text-[14px]">Options à choisir: {missingVariantGroups.map((group) => group.label).join(", ")}</div> : null}
              </div>
              <div className="grid gap-2.5 sm:min-w-[360px] sm:grid-cols-2 sm:gap-3">
                <button type="button" onClick={proceedToCheckout} disabled={!canSubmitOrder} className="inline-flex h-11 items-center justify-center rounded-full bg-[#ff5b1f] px-5 text-[15px] font-semibold text-white transition hover:bg-[#ec510f] disabled:cursor-not-allowed disabled:bg-[#ffc09f] sm:h-13 sm:px-6 sm:text-[18px]">
                  Commander
                </button>
                <button type="button" onClick={addSelectionToCart} disabled={!canSubmitOrder} className="inline-flex h-11 items-center justify-center rounded-full border border-[#222] px-5 text-[15px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00] disabled:cursor-not-allowed disabled:border-[#d8d8d8] disabled:text-[#b0b0b0] sm:h-13 sm:px-6 sm:text-[18px]">
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
