"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, ExternalLink, Heart, Minus, Play, Plus, Share2, ShieldCheck, ShoppingCart, Star, X } from "lucide-react";
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
  const mixGroup = product.variantGroups[0];
  const modalGroups = product.variantGroups.slice(1);
  const hasVariantChoices = product.variantGroups.length > 0;
  const requiredVariantLabels = product.variantGroups.map((group) => group.label);
  const variantSelectionInstruction = requiredVariantLabels.join(", ");
  const [activeImage, setActiveImage] = useState(0);
  const [activeMedia, setActiveMedia] = useState<"photo" | "video">("photo");
  const [isImageLightboxOpen, setIsImageLightboxOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite ?? false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [shippingSelectionPulse, setShippingSelectionPulse] = useState<"air" | "sea" | null>(null);
  const [isCartAnimating, setIsCartAnimating] = useState(false);
  const [cartToastVisible, setCartToastVisible] = useState(false);
  const [shippingMethod, setShippingMethod] = useState<"air" | "sea" | null>(null);
  const [orderQuantity, setOrderQuantity] = useState(Math.max(product.moq, 1));
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [mixQuantities, setMixQuantities] = useState<Record<string, number>>(() => (
    Object.fromEntries((mixGroup?.values ?? []).map((value) => [value, 0]))
  ));
  const touchStartXRef = useRef<number | null>(null);
  const cartAnimationTimeoutRef = useRef<number | null>(null);
  const cartToastTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    router.prefetch("/cart");
  }, [router]);

  useEffect(() => {
    return () => {
      if (cartAnimationTimeoutRef.current !== null) {
        window.clearTimeout(cartAnimationTimeoutRef.current);
      }
      if (cartToastTimeoutRef.current !== null) {
        window.clearTimeout(cartToastTimeoutRef.current);
      }
    };
  }, []);

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
        // Ignore favorite hydration failures.
      }
    };

    void hydrateFavorite();

    return () => {
      isCancelled = true;
    };
  }, [initialIsFavorite, product.slug]);

  const isWeakLogisticsText = (value?: string | null) => {
    if (!value) {
      return true;
    }

    return /(selon catalogue|non fourni par affiliation|affiliate|affiliation|import affiliation|afripay\+\s*affiliate)/i.test(value);
  };
  const findSpecValue = (pattern: RegExp) => {
    const spec = product.specs.find((entry) => pattern.test(entry.label) && !isWeakLogisticsText(entry.value));
    return spec?.value;
  };
  const resolveVariantGroupSelection = (group: DetailVariantGroup, fallbackToFirstValue = false) => {
    const selectedValue = selectedVariants[group.label];
    if (selectedValue && group.values.includes(selectedValue)) {
      return selectedValue;
    }
    return fallbackToFirstValue ? group.values[0] ?? "" : "";
  };

  const lowerTitle = product.title.toLowerCase();
  const referenceCode = product.title.match(/\b[A-Z0-9]{3,}(?:[- ][A-Z0-9]{2,})?\b/)?.[0]
    ?? product.shortTitle.match(/\b[A-Z0-9]{3,}(?:[- ][A-Z0-9]{2,})?\b/)?.[0]
    ?? "Référence à confirmer";
  const inferredType = /keyboard|clavier/.test(lowerTitle)
    ? (/mouse|souris/.test(lowerTitle) ? "Combo clavier et souris" : "Clavier")
    : (/mouse|souris/.test(lowerTitle) ? "Souris gaming" : "Accessoire informatique");
  const inferredConnection = /tri-mode/.test(lowerTitle)
    ? "Tri-mode"
    : /bluetooth|bt/.test(lowerTitle)
      ? "Bluetooth"
      : /wireless|2\.4g/.test(lowerTitle)
        ? "Sans fil"
        : /wired|usb/.test(lowerTitle)
          ? "Filaire"
          : "Connexion à confirmer";
  const inferredSensor = product.title.match(/PAW\s?\d+/i)?.[0]?.toUpperCase()
    ?? product.title.match(/\d{4,5}\s?DPI/i)?.[0]?.toUpperCase()
    ?? "Caractéristique à confirmer";
  const inferredUse = /office/.test(lowerTitle) && /gaming/.test(lowerTitle)
    ? "Gaming et bureautique"
    : /gaming/.test(lowerTitle)
      ? "Gaming"
      : /office/.test(lowerTitle)
        ? "Bureautique"
        : "Usage polyvalent";
  const packagingLabel = !isWeakLogisticsText(product.packaging) ? product.packaging : "Emballage standard";
  const weightLabel = product.itemWeightGrams > 0 ? `${product.itemWeightGrams} g` : "Poids à confirmer";
  const dimensionsLabel = product.packageDimensionsCm
    ? `${product.packageDimensionsCm.lengthCm} x ${product.packageDimensionsCm.widthCm} x ${product.packageDimensionsCm.heightCm} cm`
    : "Dimensions à confirmer";
  const displayShippingLabel = /^(Expédition|Expedition)\s+[A-Z]{2,3}$/i.test(product.shippingLabel) ? "Expédition" : product.shippingLabel;
  const sourceProductUrl = (() => {
    if (typeof product.sourceUrl === "string" && product.sourceUrl.trim()) {
      return product.sourceUrl.trim();
    }
    return /^\d{12,20}$/.test(product.slug) ? `https://www.aliexpress.com/item/${product.slug}.html` : "";
  })();
  const parsedLotCbm = Number(product.lotCbm.replace(",", "."));
  const lotLabel = Number.isFinite(parsedLotCbm) && parsedLotCbm > 0 ? `${product.lotCbm} m3` : "Volume à confirmer";
  const characteristics = [
    { label: "Type", value: findSpecValue(/type|model|modele|style|material|matiere/i) ?? inferredType },
    { label: "Référence", value: referenceCode },
    { label: "Connexion", value: findSpecValue(/connexion|connection|interface|plug|prise|port/i) ?? inferredConnection },
    { label: "Capteur", value: findSpecValue(/capteur|sensor|feature|fonction|function|light|display/i) ?? inferredSensor },
    { label: "Dimensions", value: dimensionsLabel },
    { label: "Emballage", value: packagingLabel },
    { label: "Poids", value: weightLabel },
    { label: "Usage", value: findSpecValue(/usage|application|compatib|use/i) ?? inferredUse },
    { label: "Support", value: !isWeakLogisticsText(product.responseTime) ? product.responseTime : "Support logistique AfriPay+" },
    { label: "Volume", value: lotLabel },
  ];
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
        const summary = resolveProductPriceSummaryUsd(productWithNormalizedTiers, {
          quantity: getApplicableVariantPricing(productWithNormalizedTiers, selection).length > 0 ? Math.max(1, quantity) : Math.max(1, totalSelectedQuantity),
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
  const freeShippingThresholdLabel = new Intl.NumberFormat(product.locale, {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(20000);
  const supportsDirectAliExpressDelivery = isSupportedDirectDeliveryCountry(product.countryCode);
  const shippingChoices = supportsDirectAliExpressDelivery
    ? [
        {
          key: "air" as const,
          title: "Express",
          description: "Livraison rapide à domicile avec suivi prioritaire.",
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
          description: "Transport aérien pour les colis urgents ou de faible poids.",
          feeLabel: "Rapide",
          summaryLabel: "Avion",
        },
        {
          key: "sea" as const,
          title: "Bateau",
          description: "Transport maritime mieux adapté aux commandes lourdes et aux gros volumes.",
          feeLabel: "Économique",
          summaryLabel: "Bateau",
        },
      ];
  const selectedShippingChoice = shippingChoices.find((option) => option.key === shippingMethod) ?? null;
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

  const updateMixQuantity = (value: string, delta: number) => {
    setMixQuantities((current) => ({
      ...current,
      [value]: Math.max(0, (current[value] ?? 0) + delta),
    }));
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
  const triggerCartAnimation = () => {
    if (cartAnimationTimeoutRef.current !== null) {
      window.clearTimeout(cartAnimationTimeoutRef.current);
    }
    if (cartToastTimeoutRef.current !== null) {
      window.clearTimeout(cartToastTimeoutRef.current);
    }

    setIsCartAnimating(false);
    setCartToastVisible(false);

    window.requestAnimationFrame(() => {
      setIsCartAnimating(true);
      setCartToastVisible(true);

      cartAnimationTimeoutRef.current = window.setTimeout(() => {
        setIsCartAnimating(false);
      }, 700);

      cartToastTimeoutRef.current = window.setTimeout(() => {
        setCartToastVisible(false);
      }, 1800);
    });
  };
  const triggerShippingSelectionAnimation = (method: "air" | "sea") => {
    setShippingMethod(method);
    setShippingSelectionPulse(method);
    window.setTimeout(() => {
      setShippingSelectionPulse((current) => (current === method ? null : current));
    }, 420);
  };
  const addSelectionToCart = () => {
    if (!canSubmitOrder) {
      return;
    }

    buildOrderSelections().forEach((entry) => {
      addItem(product.slug, entry.quantity, entry.selectedVariants);
    });
    triggerCartAnimation();
    setShareFeedback("Produit ajouté au panier sourcing.");
  };
  const proceedToCheckout = () => {
    if (!canSubmitOrder) {
      return;
    }

    buildOrderSelections().forEach((entry) => {
      addItem(product.slug, entry.quantity, entry.selectedVariants);
    });
    triggerCartAnimation();
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
    setShareFeedback(message);
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
        goToNextImage();
        return;
      }
      if (event.key === "ArrowLeft" && product.gallery.length > 1) {
        event.preventDefault();
        goToPreviousImage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isImageLightboxOpen, product.gallery.length]);

  return (
    <>
      <div className="mx-auto max-w-[1430px] space-y-6 bg-white pb-28 sm:space-y-8 sm:pb-12">
        <section className="border border-[#e5e5e5] bg-white p-3 sm:p-4">
          <div className="hidden flex-wrap items-center gap-2 text-[12px] text-[#666] sm:flex">
            <Link href="/" className="transition hover:text-[#191919]">Accueil</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href="/products" className="transition hover:text-[#191919]">Produits</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="max-w-[280px] truncate text-[#191919]">{product.shortTitle}</span>
          </div>

          <div className="mt-0 grid gap-4 sm:mt-4 xl:grid-cols-[72px_minmax(0,500px)_minmax(0,1fr)_316px]">
            <div className="order-2 hidden gap-2 overflow-x-auto pb-1 xl:order-1 xl:flex xl:flex-col xl:overflow-visible xl:pb-0">
              {product.gallery.map((image, index) => {
                const isActive = activeMedia === "photo" && activeImage === index;

                return (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => {
                      setActiveMedia("photo");
                      setActiveImage(index);
                    }}
                    className={[
                      "relative h-[62px] min-w-[62px] overflow-hidden border bg-white transition xl:h-[62px] xl:min-w-[62px]",
                      isActive ? "border-[#191919]" : "border-[#e5e5e5] hover:border-[#999]",
                    ].join(" ")}
                  >
                    <Image src={image} alt={`${product.shortTitle} aperçu ${index + 1}`} fill sizes="64px" className="object-cover" />
                  </button>
                );
              })}
              {product.videoUrl ? (
                <button
                  type="button"
                  onClick={() => setActiveMedia("video")}
                  className={[
                    "relative h-[62px] min-w-[62px] overflow-hidden border bg-[#161820] transition xl:h-[62px] xl:min-w-[62px]",
                    activeMedia === "video" ? "border-[#191919]" : "border-[#e5e5e5] hover:border-[#999]",
                  ].join(" ")}
                >
                  {product.videoPoster ? <Image src={product.videoPoster} alt={`${product.shortTitle} vidéo`} fill sizes="96px" className="object-cover opacity-70" /> : null}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#151515]">
                      <Play className="ml-0.5 h-4.5 w-4.5 fill-current" />
                    </div>
                  </div>
                </button>
              ) : null}
            </div>

            <div className="order-1 xl:order-2">
              <div
                className="relative -mx-3 -mt-3 overflow-hidden bg-white sm:mx-0 sm:mt-0 sm:border sm:border-[#ececec]"
                onTouchEnd={(event) => handleImageTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
              >
                <div className="absolute left-3 top-3 z-20 hidden items-center gap-2 sm:flex">
                  <span className="inline-flex bg-[#111] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                    {product.badge || "AfriPay Select"}
                  </span>
                  <div className="inline-flex border border-[#d9d9d9] bg-white p-1 text-[11px] font-semibold text-[#191919]">
                    <button
                      type="button"
                      onClick={() => setActiveMedia("photo")}
                      className={["px-3 py-1.5", activeMedia === "photo" ? "bg-[#191919] text-white" : ""].join(" ")}
                    >
                      Photos
                    </button>
                    {product.videoUrl ? (
                      <button
                        type="button"
                        onClick={() => setActiveMedia("video")}
                        className={["px-3 py-1.5", activeMedia === "video" ? "bg-[#191919] text-white" : ""].join(" ")}
                      >
                        Vidéo
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="absolute inset-x-3 top-4 z-20 flex items-center justify-between sm:hidden">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/92 text-[#111] shadow-[0_8px_20px_rgba(0,0,0,0.12)]"
                    aria-label="Retour"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={shareProduct}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/92 text-[#111] shadow-[0_8px_20px_rgba(0,0,0,0.12)]"
                      aria-label="Partager le produit"
                    >
                      <Share2 className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={toggleFavorite}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/92 text-[#111] shadow-[0_8px_20px_rgba(0,0,0,0.12)]"
                      aria-label="Ajouter aux favoris"
                    >
                      <Heart className={["h-5 w-5", isFavorite ? "fill-current text-[#f06f12]" : ""].join(" ")} />
                    </button>
                  </div>
                </div>

                {shareFeedback ? (
                  <div className="absolute right-3 top-3 z-10 bg-black/70 px-4 py-2 text-[12px] font-semibold text-white">
                    {shareFeedback}
                  </div>
                ) : null}

                <div className="relative aspect-square w-full bg-[#f7f7f7] p-4 sm:aspect-[0.9/1] sm:bg-white sm:p-8">
                  {activeMedia === "video" && product.videoUrl ? (
                    <video controls poster={product.videoPoster} className="h-full w-full object-contain" src={product.videoUrl} />
                  ) : (
                    <button type="button" onClick={openImageLightbox} className="relative h-full w-full cursor-zoom-in">
                      <Image
                        src={product.gallery[activeImage] ?? product.gallery[0]}
                        alt={product.title}
                        fill
                        sizes="(max-width: 1280px) 100vw, 60vw"
                        className="object-contain"
                        priority
                        onTouchStart={(event) => {
                          touchStartXRef.current = event.touches[0]?.clientX ?? null;
                        }}
                      />
                    </button>
                  )}
                </div>

                {activeMedia === "photo" ? (
                  <div className="absolute bottom-4 left-4 z-20 sm:hidden">
                    <div className="rounded-full bg-white/92 px-4 py-2 text-[13px] font-semibold text-[#191919] shadow-[0_10px_24px_rgba(0,0,0,0.12)]">
                      Article {activeImage + 1}/{product.gallery.length}
                    </div>
                  </div>
                ) : null}

                {activeMedia === "photo" && product.gallery.length > 1 ? (
                  <>
                    <button type="button" onClick={goToPreviousImage} className="absolute left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#d9d9d9] bg-white text-[#1b1b1b] transition hover:border-[#191919] sm:inline-flex" aria-label="Image précédente">
                      <ChevronRight className="h-5 w-5 rotate-180" />
                    </button>
                    <button type="button" onClick={goToNextImage} className="absolute right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#d9d9d9] bg-white text-[#1b1b1b] transition hover:border-[#191919] sm:inline-flex" aria-label="Image suivante">
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            <div className="order-3 min-w-0 px-1 sm:px-0">
              <div className="hidden flex-wrap items-center gap-2 sm:flex">
                <span className="inline-flex items-center gap-2 bg-[#fff7ef] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#de6a19]">
                  <ShieldCheck className="h-4 w-4" />
                  Offre verifiee
                </span>
                <span className="inline-flex bg-[#f5f5f5] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#555]">
                  {product.categoryTitle}
                </span>
              </div>

              <h1 className="mt-3 max-w-[760px] text-[19px] font-bold leading-[1.24] text-[#191919] sm:text-[29px]">
                {product.title}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[#8a6d5b] sm:text-[14px] sm:text-[#555]">
                <span>De {product.supplierName}</span>
                <span className="text-[#d89b00]">★ 4.6</span>
                <span>•</span>
                <span>{product.soldLabel || "60 vendus"}</span>
              </div>

              <div className="mt-4 max-w-[620px] overflow-hidden rounded-[4px] border border-[#8ec8ff] sm:mt-4">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-[#3a97f0] px-4 py-3 text-white">
                  <div className="text-[13px] font-bold sm:text-[14px]">En plein air · Offre bienvenue</div>
                  <div className="text-[12px] font-semibold sm:text-[13px]">Fin : 7 avril, 21:59 (GMT0)</div>
                </div>
                <div className="bg-white px-4 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-[32px] font-bold leading-none tracking-[-0.04em] text-[#111] sm:text-[46px]">
                      {hasSubtotalRange ? `${formatMoney(subtotalRange.minUsd)} - ${formatMoney(subtotalRange.maxUsd)}` : formatMoney(subtotal)}
                    </div>
                    <div className="bg-[#fff1f0] px-2 py-1 text-[13px] font-bold text-[#ff375f]">Economisez</div>
                  </div>
                  <div className="mt-2 text-[13px] text-[#888] line-through sm:text-[14px]">{dynamicPriceLabel}</div>
                </div>
              </div>

              <div className="mt-3 flex max-w-[620px] items-center justify-between rounded-[4px] bg-[#fff1f1] px-4 py-3 text-[14px] text-[#e53b2d]">
                <span>-2,00€ sur 15,00€</span>
                <ChevronRight className="h-4 w-4" />
              </div>

              {product.variantGroups.length > 0 ? (
                <div className="mt-6 max-w-[620px] border-t border-[#efefef] pt-5">
                  {product.variantGroups.map((group) => (
                    <div key={group.label} className="mb-5 last:mb-0">
                      <div className="text-[15px] font-bold text-[#191919]">
                        {group.label}: <span className="uppercase">{resolveVariantGroupSelection(group, true) || "A choisir"}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
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
                                "min-w-[76px] border bg-white px-3 py-2 text-[13px] font-medium transition",
                                isSelected ? "border-[#191919] text-[#191919]" : "border-[#dcdcdc] text-[#241b15] hover:border-[#999]",
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
              ) : null}

              <div className="mt-5 max-w-[620px] grid gap-2 sm:grid-cols-2">
                {offerMetrics.map((metric) => (
                  <div key={metric.label} className="border border-[#ededed] bg-[#fafafa] px-3 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#888]">{metric.label}</div>
                    <div className="mt-1 text-[14px] font-semibold text-[#241b15]">{metric.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <aside className="order-4 xl:sticky xl:top-4 xl:self-start">
              <div className="overflow-hidden border border-[#e5e5e5] bg-white">
                <div className="border-b border-[#ececec] px-5 py-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[14px] text-[#191919]">
                      <span className="font-semibold">Vendu par</span>{" "}
                      <span className="truncate text-[#444]">{product.supplierName}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-[#666]" />
                  </div>
                </div>

                <div className="space-y-4 px-5 py-4">
                  <div className="space-y-3 border-b border-[#efefef] pb-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-[#4caf50]">✓</div>
                      <div>
                        <div className="text-[14px] font-semibold text-[#191919]">Livraison suivie</div>
                        <div className="mt-1 text-[13px] text-[#666]">{selectedShippingChoice?.summaryLabel ?? product.shippingLabel}</div>
                      </div>
                      <ChevronRight className="ml-auto mt-0.5 h-4 w-4 text-[#888]" />
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-[#4caf50]">✓</div>
                      <div>
                        <div className="text-[14px] font-semibold text-[#191919]">Retour et securite</div>
                        <div className="mt-1 text-[13px] text-[#666]">Paiements securises et suivi de commande AfriPay.</div>
                      </div>
                      <ChevronRight className="ml-auto mt-0.5 h-4 w-4 text-[#888]" />
                    </div>
                  </div>

                  <div>
                    <div className="text-[14px] font-semibold text-[#191919]">Livraison</div>
                    <div className="mt-3 grid gap-2">
                      {shippingChoices.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => triggerShippingSelectionAnimation(option.key)}
                          className={[
                            "border px-4 py-3 text-left transition duration-300",
                            shippingMethod === option.key ? "border-[#191919] bg-[#fafafa] shadow-[0_10px_24px_rgba(17,24,39,0.08)]" : "border-[#e5e5e5] bg-white hover:border-[#999]",
                            shippingSelectionPulse === option.key ? "scale-[1.02] -translate-y-0.5 shadow-[0_16px_34px_rgba(240,111,18,0.22)]" : "",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[15px] font-semibold text-[#221813]">{option.title}</div>
                            <div className="text-[13px] font-bold text-[#f06f12]">{option.feeLabel}</div>
                          </div>
                          <div className={["mt-1 text-[13px] text-[#706155] transition", shippingSelectionPulse === option.key ? "translate-x-0.5 text-[#4d4035]" : ""].join(" ")}>{option.description}</div>
                        </button>
                      ))}
                    </div>
                    {exceedsSeaThreshold && !supportsDirectAliExpressDelivery ? (
                      <div className="mt-3 rounded-[12px] border border-[#f2d0b1] bg-[#fff4ea] px-4 py-3 text-[13px] font-medium text-[#d15f12]">
                        Ce colis dépasse 5 kg, l’expédition maritime est recommandée.
                      </div>
                    ) : null}
                  </div>

                  {!mixGroup ? (
                    <div className="border-t border-[#efefef] pt-4">
                      <div className="text-[14px] font-semibold text-[#191919]">Quantité</div>
                      <div className="mt-3 flex items-center gap-3">
                        <button type="button" onClick={() => updateOrderQuantity(-1)} disabled={orderQuantity <= product.moq} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f5f5f5] text-[#55473b] transition hover:bg-[#ebebeb] disabled:cursor-not-allowed disabled:opacity-40">
                          <Minus className="h-4 w-4" />
                        </button>
                        <div className="min-w-[24px] text-center text-[20px] font-semibold tracking-[-0.04em] text-[#1e1712]">{orderQuantity}</div>
                        <button type="button" onClick={() => updateOrderQuantity(1)} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f5f5f5] text-[#55473b] transition hover:bg-[#ebebeb]">
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-2 text-[12px] text-[#6c5c50]">{product.moqVerified ? `Minimum ${product.moq} pièce${product.moq > 1 ? "s" : ""}` : "Minimum à confirmer"}</div>
                    </div>
                  ) : (
                    <div className="rounded-[14px] border border-[#f2d0b1] bg-[#fff7ef] px-4 py-4 text-[13px] leading-6 text-[#6d5744]">
                      La sélection mixte se règle dans la fenêtre de commande.
                    </div>
                  )}

                  {missingVariantGroups.length > 0 ? (
                    <div className="rounded-[12px] border border-[#f2d0b1] bg-[#fff5ea] px-4 py-3 text-[13px] font-medium text-[#d15f12]">
                      Options à choisir : {missingVariantGroups.map((group) => group.label).join(", ")}
                    </div>
                  ) : null}

                  <div className="grid gap-3">
                    <button
                      type="button"
                      onClick={proceedToCheckout}
                      disabled={!canSubmitOrder}
                      className="inline-flex h-14 items-center justify-center gap-3 bg-[#d8001f] px-6 text-[17px] font-bold text-white transition hover:bg-[#bf001c]"
                    >
                      <ShoppingCart className="h-4.5 w-4.5" />
                      Acheter maintenant
                    </button>
                    <button
                      type="button"
                      onClick={addSelectionToCart}
                      disabled={!canSubmitOrder}
                      className={[
                        "inline-flex h-14 items-center justify-center border border-[#1f1f1f] bg-white px-6 text-[17px] font-semibold text-[#221813] transition hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:border-[#d9d0c8] disabled:text-[#aaa29a]",
                        isCartAnimating ? "animate-[cartButtonPulse_680ms_ease-out]" : "",
                      ].join(" ")}
                    >
                      Ajouter au panier
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-[#efefef] pt-4">
                    <button type="button" onClick={shareProduct} className="inline-flex h-12 items-center justify-center gap-2 border border-[#e5e5e5] bg-[#fafafa] text-[14px] font-medium text-[#333] transition hover:-translate-y-0.5 hover:border-[#999]">
                      <Share2 className="h-4 w-4 transition group-hover:rotate-12" />
                      Partager
                    </button>
                    <button type="button" onClick={toggleFavorite} className="inline-flex h-12 items-center justify-center gap-2 border border-[#e5e5e5] bg-[#fafafa] text-[14px] font-medium text-[#333] transition hover:-translate-y-0.5 hover:border-[#999]">
                      <Heart className={["h-4 w-4", isFavorite ? "fill-current text-[#f06f12]" : ""].join(" ")} />
                      Favoris
                    </button>
                    {sourceProductUrl ? (
                      <Link href={sourceProductUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center justify-center gap-2 border border-[#e5e5e5] bg-[#fafafa] text-[14px] font-medium text-[#333] transition hover:-translate-y-0.5 hover:border-[#999]">
                        <Star className="h-4 w-4 fill-current text-[#f5b301]" />
                        Avis 4.8
                      </Link>
                    ) : (
                      <div className="inline-flex h-12 items-center justify-center gap-1 border border-[#efefef] bg-[#fafafa] text-[13px] font-medium text-[#555]">
                        <Star className="h-4 w-4 fill-current text-[#f5b301]" />
                        Avis 4.8
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <article className="border border-[#e5e5e5] bg-white p-6">
              <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#907e70]">Description</div>
              <h2 className="mt-3 text-[24px] font-bold text-[#221813] sm:text-[28px]">Présentation détaillée</h2>
              <div className="mt-6 grid gap-4">
                {product.overview.map((point) => (
                  <div key={point} className="border-b border-[#f1f1f1] px-1 py-4 last:border-b-0">
                    <p className="text-[15px] leading-7 text-[#4d4035]">{point}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="border border-[#e5e5e5] bg-white p-6">
              <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#907e70]">Caractéristiques</div>
              <h2 className="mt-3 text-[24px] font-bold text-[#221813] sm:text-[28px]">Fiche technique</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {characteristics.map((item) => (
                  <div key={`${item.label}-${item.value}`} className="border border-[#efefef] bg-[#fafafa] px-5 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#94806f]">{item.label}</div>
                    <div className="mt-2 text-[16px] font-semibold leading-6 text-[#261d17]">{item.value}</div>
                  </div>
                ))}
              </div>
            </article>

            <article className="border border-[#e5e5e5] bg-white p-6">
              <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#907e70]">Service AfriPay</div>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {serviceHighlights.map((item) => (
                  <div key={item.title} className="border border-[#efefef] bg-[#fafafa] px-5 py-5">
                    <div className="text-[18px] font-bold text-[#221813]">{item.title}</div>
                    <p className="mt-3 text-[14px] leading-6 text-[#5f5145]">{item.description}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <article className="border border-[#e5e5e5] bg-white p-5">
              <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#907e70]">Vendu par</div>
              <div className="mt-3 text-[22px] font-bold text-[#221813]">{product.supplierName}</div>
              <div className="mt-2 text-[14px] text-[#6c5e52]">{product.supplierLocation || "Réseau fournisseur vérifié"}</div>
              <div className="mt-5 space-y-3">
                {supplierMetrics.map((metric) => (
                  <div key={metric.label} className="flex items-center justify-between gap-4 bg-[#fafafa] px-4 py-3">
                    <span className="text-[13px] font-medium text-[#746659]">{metric.label}</span>
                    <span className="text-[14px] font-semibold text-[#241b15]">{metric.value}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="border border-[#e5e5e5] bg-white p-5">
              <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#907e70]">Paiements acceptés</div>
              <div className="mt-5 grid gap-3">
                {paymentMethods.map((method) => (
                  <div key={method.label} className="flex items-center gap-3 bg-[#fafafa] px-4 py-3">
                    <div className="relative h-8 w-8 overflow-hidden rounded-full bg-white">
                      <Image src={method.icon} alt={method.alt} fill sizes="32px" className="object-contain p-1" />
                    </div>
                    <div className="text-[14px] font-semibold text-[#221813]">{method.label}</div>
                  </div>
                ))}
              </div>

              {sourceProductUrl ? (
                <Link
                  href={sourceProductUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 border border-[#221813] px-4 py-3 text-[14px] font-semibold text-[#221813] transition hover:border-[#f06f12] hover:text-[#f06f12]"
                >
                  Voir la source produit
                  <ExternalLink className="h-4 w-4" />
                </Link>
              ) : null}
            </article>
          </div>
        </section>

        {relatedProducts.length > 0 ? (
          <section className="border border-[#e5e5e5] bg-white p-6">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#907e70]">Articles similaires</div>
              <h2 className="mt-2 text-[28px] font-bold text-[#221813]">Articles similaires</h2>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
              {relatedProducts.map((relatedProduct) => (
                <Link
                  key={relatedProduct.slug}
                  href={`/products/${relatedProduct.slug}`}
                  className="group border border-[#efefef] bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(0,0,0,0.08)] sm:p-4"
                >
                  <div className="relative aspect-square overflow-hidden bg-[#fafafa]">
                    <Image src={relatedProduct.image} alt={relatedProduct.title} fill sizes="(max-width: 1280px) 50vw, 25vw" className="object-cover transition duration-500 group-hover:scale-[1.04]" />
                  </div>
                  <div className="mt-3 line-clamp-2 text-[13px] font-semibold leading-5 text-[#221813] sm:mt-4 sm:text-[16px] sm:leading-6">{relatedProduct.title}</div>
                  <div className="mt-2 text-[18px] font-black tracking-[-0.05em] text-[#221813] sm:mt-3 sm:text-[22px]">{relatedProduct.formattedPrice}</div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
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
                    ? `Choisissez ${variantSelectionInstruction} avant la commande. Aucun attribut n'est présélectionné automatiquement.`
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
                      onClick={() => triggerShippingSelectionAnimation(option.key)}
                      className={[
                        "rounded-[14px] border px-3 py-3 text-left transition duration-300 sm:rounded-[18px] sm:px-4 sm:py-4",
                        shippingMethod === option.key ? "border-[#ff6a00] bg-[#fff5ed] shadow-[inset_0_0_0_1px_#ff6a00]" : "border-[#e5e5e5] bg-white hover:border-[#ffb48a]",
                        shippingSelectionPulse === option.key ? "scale-[1.02] -translate-y-0.5 shadow-[0_16px_34px_rgba(255,106,0,0.16)]" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[15px] font-semibold text-[#222] sm:text-[17px]">{option.title}</div>
                        <div className="text-[13px] font-bold text-[#ff5b1f] sm:text-[15px]">{option.feeLabel}</div>
                      </div>
                      <div className={["mt-1 text-[12px] leading-5 text-[#666] transition sm:text-[14px]", shippingSelectionPulse === option.key ? "translate-x-0.5 text-[#4d4035]" : ""].join(" ")}>{option.description}</div>
                    </button>
                  ))}
                </div>
                <div className="mt-2.5 rounded-[14px] border border-[#ececec] bg-[#fafafa] px-3 py-2.5 text-[12px] text-[#555] sm:mt-3 sm:rounded-[16px] sm:px-4 sm:py-3 sm:text-[14px]">
                  Poids estimé du colis: <span className="font-semibold text-[#222]">{totalWeightLabel}</span>
                </div>
                {exceedsSeaThreshold && !supportsDirectAliExpressDelivery ? (
                  <div className="mt-2.5 rounded-[14px] border border-[#ffd4b5] bg-[#fff4ea] px-3 py-2.5 text-[12px] font-medium text-[#c85a11] sm:mt-3 sm:rounded-[16px] sm:px-4 sm:py-3 sm:text-[14px]">
                    Ce colis dépasse 5 kg, expédition maritime recommandée.
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
                          <div className="mt-0.5 text-[12px] font-semibold tracking-[-0.03em] text-[#222] sm:hidden">{formatPriceSummary(resolveProductPriceSummaryUsd(productWithNormalizedTiers, {
                            quantity: getApplicableVariantPricing(productWithNormalizedTiers, { [mixGroup.label]: value, ...modalSelections }).length > 0
                              ? Math.max(1, mixQuantities[value] ?? 1)
                              : Math.max(1, totalSelectedQuantity),
                            selection: { [mixGroup.label]: value, ...modalSelections },
                          }))}</div>
                        </div>
                        <div className="hidden text-left text-[18px] font-semibold tracking-[-0.03em] text-[#222] sm:block sm:text-right sm:text-[20px]">{formatPriceSummary(resolveProductPriceSummaryUsd(productWithNormalizedTiers, {
                          quantity: getApplicableVariantPricing(productWithNormalizedTiers, { [mixGroup.label]: value, ...modalSelections }).length > 0
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
                      <div className="mt-1 text-[12px] text-[#777] sm:text-[14px]">{product.moqVerified ? `${product.moq} ${product.moq > 1 ? "pièces" : "pièce"}` : "À confirmer"}</div>
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
                    <span className={isCartAnimating ? "animate-[cartButtonPulse_680ms_ease-out]" : ""}>
                      Ajouter au panier
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {cartToastVisible ? (
        <div className="pointer-events-none fixed bottom-[calc(var(--mobile-bottom-nav-height)+var(--mobile-floating-cta-height)+92px)] right-4 z-[170] sm:bottom-8 sm:right-8">
          <div className="flex items-center gap-2 rounded-full bg-[#161616] px-4 py-3 text-[13px] font-semibold text-white shadow-[0_18px_38px_rgba(0,0,0,0.24)] animate-[cartToastSlide_1.8s_ease-out_forwards] sm:px-5 sm:text-[14px]">
            <ShoppingCart className="h-4 w-4 text-[#ff8c2a]" />
            Ajouté au panier
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        @keyframes cartButtonPulse {
          0% {
            transform: scale(1);
          }
          30% {
            transform: scale(0.94);
          }
          65% {
            transform: scale(1.08);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes cartToastSlide {
          0% {
            opacity: 0;
            transform: translateY(18px) scale(0.92);
          }
          12% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          82% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(10px) scale(0.96);
          }
        }
      `}</style>
    </>
  );
}
