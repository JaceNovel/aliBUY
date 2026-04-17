"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeDollarSign, ChevronRight, CreditCard, Heart, Minus, Play, Plus, Share2, ShieldCheck, ShoppingCart, Star, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useCart } from "@/components/cart-provider";
import { PaymentMethodIcon } from "@/components/payment-method-icon";
import { getStorefrontMoqDisplay } from "@/lib/product-moq";
import { CURRENCY_CONFIG, type CurrencyCode } from "@/lib/pricing-options";
import { resolveProductPriceSummaryUsd, resolveProductUnitPriceUsd, resolveVariantSku } from "@/lib/product-variant-pricing";

import { ProductReviewsPanel } from "./product-reviews-panel";

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

type DetailVariantSku = {
  selections: Record<string, string>;
  skuId: string;
  skuCode?: string;
  inventory?: number;
  image?: string;
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
  moq: number;
  moqVerified?: boolean;
  unit?: string;
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
    description?: string;
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
    sourceUrl?: string;
    reviewSummary?: {
      averageRating?: number | null;
      totalCount: number;
      customerCount?: number;
      externalCount?: number;
      customerAverageRating?: number | null;
      externalAverageRating?: number | null;
      withMediaCount?: number;
    };
    reviews?: Array<{
      id: string;
      source: string;
      reviewerName: string;
      rating: number;
      title?: string | null;
      comment: string;
      mediaUrls: string[];
      verifiedPurchase: boolean;
      createdAt?: string | null;
      status?: string;
    }>;
    tiers: DetailTier[];
    variantGroups: DetailVariantGroup[];
    variantPricing: DetailVariantPrice[];
    variantSkus?: DetailVariantSku[];
    specs: DetailSpec[];
    formattedPriceRange: string;
    badge?: string;
  };
  relatedProducts: RelatedProduct[];
  initialIsFavorite: boolean | null;
};

const RECENTLY_VIEWED_STORAGE_KEY = "afripay_recently_viewed_products_v1";

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function buildDescriptionParagraphs(description?: string, fallbackOverview: string[] = []) {
  const normalizedDescription = typeof description === "string" ? description.trim() : "";

  if (normalizedDescription) {
    const plainText = decodeHtmlEntities(normalizedDescription)
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
      .replace(/<li>/gi, "- ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\r/g, "")
      .replace(/\t/g, " ")
      .replace(/\u00a0/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ ]{2,}/g, " ")
      .trim();

    const paragraphs = plainText
      .split(/\n{2,}|\n(?=-\s)/)
      .map((entry) => entry.replace(/\s+/g, " ").trim())
      .filter((entry) => entry.length > 0);

    if (paragraphs.length > 0) {
      return paragraphs;
    }
  }

  return fallbackOverview.filter((entry) => entry.trim().length > 0);
}

export function ProductDetailClient({ product, relatedProducts, initialIsFavorite }: ProductDetailClientProps) {
  const selectedCurrency = CURRENCY_CONFIG[(product.currencyCode as CurrencyCode)] ?? CURRENCY_CONFIG.USD;
  const router = useRouter();
  const { addItem } = useCart();
  const [activeImage, setActiveImage] = useState(0);
  const [activeMedia, setActiveMedia] = useState<"photo" | "video">("photo");
  const [isImageLightboxOpen, setIsImageLightboxOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite ?? false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [isCartAnimating, setIsCartAnimating] = useState(false);
  const [cartToastVisible, setCartToastVisible] = useState(false);
  const [orderQuantity, setOrderQuantity] = useState(Math.max(product.moq, 1));
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const touchStartXRef = useRef<number | null>(null);
  const cartAnimationTimeoutRef = useRef<number | null>(null);
  const cartToastTimeoutRef = useRef<number | null>(null);
  const descriptionParagraphs = buildDescriptionParagraphs(product.description, product.overview);

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const viewedProduct = {
      slug: product.slug,
      title: product.shortTitle,
      image: product.gallery[0],
      price: product.formattedPriceRange,
      viewedAt: new Date().toISOString(),
    };

    try {
      const raw = window.localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) as Array<typeof viewedProduct> : [];
      const nextItems = [viewedProduct, ...parsed.filter((entry) => entry?.slug !== product.slug)].slice(0, 12);
      window.localStorage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(nextItems));
    } catch {
      // Ignore recent view persistence failures.
    }

    void fetch(`/api/products/${encodeURIComponent(product.slug)}/view`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {
      // Ignore passive view tracking failures.
    });
  }, [product.formattedPriceRange, product.gallery, product.shortTitle, product.slug]);

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
  const storefrontSellerName = "AfriPay";
  const storefrontSellerLocation = "Réseau logistique AfriPay";
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
      icon: <BadgeDollarSign className="h-4 w-4" />,
    },
    {
      label: "Mobile Money",
      icon: <PaymentMethodIcon kind="mobile-money" size={18} className="h-[18px] w-[18px] object-contain" />,
    },
    {
      label: "Carte bancaire",
      icon: <CreditCard className="h-4 w-4" />,
    },
  ] satisfies Array<{ label: string; icon: React.ReactNode }>;
  const formatMoney = (amount: number) => {
    const localizedAmount = amount * selectedCurrency.rateFromUsd;

    return new Intl.NumberFormat(product.locale, {
      style: "currency",
      currency: selectedCurrency.code,
      minimumFractionDigits: localizedAmount >= 100 ? 0 : 2,
      maximumFractionDigits: localizedAmount >= 100 ? 0 : 2,
    }).format(localizedAmount);
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
  const totalSelectedQuantity = orderQuantity;
  const modalSelections = Object.fromEntries(
    product.variantGroups.flatMap((group) => {
      const value = resolveVariantGroupSelection(group);
      return value ? [[group.label, value] as const] : [];
    }),
  );
  const previewModalSelections = Object.fromEntries(
    product.variantGroups.flatMap((group) => {
      const value = resolveVariantGroupSelection(group, true);
      return value ? [[group.label, value] as const] : [];
    }),
  );
  const previewSelection = previewModalSelections;
  const selectedVariantSku = resolveVariantSku({ variantSkus: product.variantSkus ?? [] }, previewSelection);
  const missingVariantGroups = product.variantGroups.filter((group) => !resolveVariantGroupSelection(group));
  const hasAllRequiredVariantSelections = missingVariantGroups.length === 0;
  const currentPriceSummary = resolveProductPriceSummaryUsd(productWithNormalizedTiers, {
    quantity: totalSelectedQuantity,
    selection: selectedVariants,
  });
  const currentUnitPrice = resolveProductUnitPriceUsd(productWithNormalizedTiers, {
    quantity: totalSelectedQuantity,
    selection: selectedVariants,
  });
  const fallbackPriceSummary = resolveProductPriceSummaryUsd(productWithNormalizedTiers, {
    quantity: totalSelectedQuantity,
    selection: previewSelection,
  });
  const fallbackUnitPrice = resolveProductUnitPriceUsd(productWithNormalizedTiers, {
    quantity: totalSelectedQuantity,
    selection: previewSelection,
  });
  const hasCurrentPrice = currentPriceSummary.minUsd > 0 || (typeof currentPriceSummary.maxUsd === "number" && currentPriceSummary.maxUsd > 0);
  const displayPriceSummary = hasCurrentPrice ? currentPriceSummary : fallbackPriceSummary;
  const displayUnitPrice = currentUnitPrice > 0 ? currentUnitPrice : fallbackUnitPrice;
  const subtotal = displayUnitPrice * totalSelectedQuantity;
  const subtotalRange = {
    minUsd: displayPriceSummary.minUsd * totalSelectedQuantity,
    maxUsd: (displayPriceSummary.maxUsd ?? displayPriceSummary.minUsd) * totalSelectedQuantity,
  };
  const hasSubtotalRange = subtotalRange.maxUsd > subtotalRange.minUsd;
  const promoCurrentMinUsd = hasSubtotalRange ? subtotalRange.minUsd : subtotal;
  const promoCurrentMaxUsd = hasSubtotalRange ? subtotalRange.maxUsd : subtotal;
  const promoOriginalMinUsd = Math.max(promoCurrentMinUsd * 1.14, promoCurrentMinUsd + 0.18);
  const promoOriginalMaxUsd = Math.max(promoCurrentMaxUsd * 1.14, promoCurrentMaxUsd + 0.24);
  const promoSavingsUsd = Math.max(promoOriginalMinUsd - promoCurrentMinUsd, 0.08);
  const promoOriginalLabel = hasSubtotalRange
    ? `${formatMoney(promoOriginalMinUsd)} - ${formatMoney(promoOriginalMaxUsd)}`
    : formatMoney(promoOriginalMinUsd);
  const promoSavingsLabel = formatMoney(promoSavingsUsd);
  const promoThresholdUsd = Math.max(15, Math.ceil((promoCurrentMinUsd * 1.9) / 5) * 5);
  const promoThresholdLabel = formatMoney(promoThresholdUsd);
  const moqDisplay = getStorefrontMoqDisplay(product);
  const variantSummary = product.variantGroups.length > 0 ? `${product.variantGroups.length} option${product.variantGroups.length > 1 ? "s" : ""}` : "Aucune";
  const offerMetrics = [
    { label: "Ventes", value: product.soldLabel },
    { label: moqDisplay.label, value: moqDisplay.value },
    { label: "Variantes", value: variantSummary },
    { label: "Personnalisation", value: product.customizationLabel },
  ];
  const supplierMetrics = [
    { label: "Transactions", value: product.soldLabel || "Commandes vérifiées" },
    { label: "Implantation", value: storefrontSellerLocation },
    { label: "Réponse", value: "Support AfriPay+" },
    { label: "Expérience", value: `${Math.max(product.yearsInBusiness, 3)}+ ans` },
  ];
  const serviceHighlights = [
    {
      title: "Achat accompagné",
      description: product.overview[1] ?? "Assistance AfriPay dédiée avant et après validation.",
    },
    {
      title: "Transport au panier",
      description: "Le mode de livraison est choisi au panier selon le poids et le volume du produit.",
    },
    {
      title: "Sélection fiable",
      description: product.shippingLabel || "Produit importé avec contrôle des informations clés.",
    },
  ];
  const verificationLabel = product.moqVerified
    ? `Vérification forte • MOQ confirmé • ${Math.max(product.yearsInBusiness, 3)}+ ans`
    : `Vérification standard • fournisseur ${Math.max(product.yearsInBusiness, 3)}+ ans`;
  const trustSignals = [
    { label: "Délai estimé", value: "Confirmé au panier selon le transport retenu" },
    { label: "Poids colis", value: weightLabel },
    { label: "Origine", value: product.supplierLocation || "Chine" },
    { label: "Livraison", value: "Choix au panier" },
    { label: "Risque douane", value: "Évalué au panier selon le mode choisi" },
    { label: "Niveau de vérification", value: verificationLabel },
  ];

  const updateOrderQuantity = (delta: number) => {
    setOrderQuantity((current) => Math.max(product.moq, current + delta));
  };
  const handleVariantPreviewSelection = (group: DetailVariantGroup, value: string) => {
    setSelectedVariants((current) => ({ ...current, [group.label]: value }));

    const nextSelection = {
      ...selectedVariants,
      [group.label]: value,
    };
    const nextSku = resolveVariantSku({ variantSkus: product.variantSkus ?? [] }, nextSelection);
    if (nextSku?.image) {
      const normalizedImage = nextSku.image.startsWith("//") ? `https:${nextSku.image}` : nextSku.image;
      const galleryIndex = product.gallery.findIndex((entry) => entry === normalizedImage);
      if (galleryIndex >= 0) {
        setActiveMedia("photo");
        setActiveImage(galleryIndex);
      }
    }
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

  const canSubmitOrder = totalSelectedQuantity > 0 && hasAllRequiredVariantSelections;
  const buildOrderSelections = () => {
    return [{ quantity: orderQuantity, selectedVariants: modalSelections }];
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
  const validateSelectionBeforeOrder = () => {
    if (missingVariantGroups.length > 0) {
      triggerShareFeedback(`Choisissez d'abord : ${missingVariantGroups.map((group) => group.label).join(", ")}.`);
      return false;
    }

    return true;
  };
  const handlePrimaryBuyNow = () => {
    if (!validateSelectionBeforeOrder()) {
      return;
    }
    proceedToCheckout();
  };
  const handlePrimaryAddToCart = () => {
    if (!validateSelectionBeforeOrder()) {
      return;
    }
    addSelectionToCart();
  };
  const proceedToCheckout = () => {
    if (!canSubmitOrder) {
      return;
    }

    buildOrderSelections().forEach((entry) => {
      addItem(product.slug, entry.quantity, entry.selectedVariants);
    });
    triggerCartAnimation();
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

    const showNextImage = () => {
      setActiveMedia("photo");
      setActiveImage((current) => (current + 1) % product.gallery.length);
    };
    const showPreviousImage = () => {
      setActiveMedia("photo");
      setActiveImage((current) => (current - 1 + product.gallery.length) % product.gallery.length);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsImageLightboxOpen(false);
        return;
      }
      if (event.key === "ArrowRight" && product.gallery.length > 1) {
        event.preventDefault();
        showNextImage();
        return;
      }
      if (event.key === "ArrowLeft" && product.gallery.length > 1) {
        event.preventDefault();
        showPreviousImage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isImageLightboxOpen, product.gallery.length]);

  return (
    <>
      <div className="mx-auto max-w-[1430px] space-y-6 pb-28 sm:space-y-8 sm:pb-12">
        <section className="overflow-hidden rounded-[8px] border border-[#eceff3] bg-white p-3 shadow-[0_16px_44px_rgba(17,24,39,0.08)] sm:p-4">
          <div className="hidden flex-wrap items-center gap-2 text-[12px] text-[#666] sm:flex">
            <Link href="/" className="transition hover:text-[#191919]">Accueil</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href="/products" className="transition hover:text-[#191919]">Produits</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="max-w-[280px] truncate text-[#191919]">{product.shortTitle}</span>
          </div>

          <div className="mt-0 grid gap-5 sm:mt-4 xl:grid-cols-[72px_minmax(0,500px)_minmax(0,1fr)_316px]">
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
                      "relative h-[62px] min-w-[62px] overflow-hidden rounded-[8px] border bg-white transition xl:h-[62px] xl:min-w-[62px]",
                      isActive ? "border-[#ff6a00] shadow-[0_10px_24px_rgba(255,106,0,0.18)]" : "border-[#e5e5e5] hover:border-[#999]",
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
                    "relative h-[62px] min-w-[62px] overflow-hidden rounded-[8px] border bg-[#161820] transition xl:h-[62px] xl:min-w-[62px]",
                    activeMedia === "video" ? "border-[#ff6a00] shadow-[0_10px_24px_rgba(255,106,0,0.18)]" : "border-[#e5e5e5] hover:border-[#999]",
                  ].join(" ")}
                >
                  {product.videoPoster ? <Image src={product.videoPoster} alt={`${product.shortTitle} vidéo`} fill sizes="96px" className="object-cover opacity-70" /> : null}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-white text-[#151515]">
                      <Play className="ml-0.5 h-4.5 w-4.5 fill-current" />
                    </div>
                  </div>
                </button>
              ) : null}
            </div>

            <div className="order-1 xl:order-2">
              <div
                className="relative -mx-3 -mt-3 overflow-hidden bg-white sm:mx-0 sm:mt-0 sm:rounded-[8px] sm:border sm:border-[#eceff3] sm:shadow-[0_12px_30px_rgba(17,24,39,0.06)]"
                onTouchEnd={(event) => handleImageTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
              >
                <div className="absolute left-3 top-3 z-20 hidden items-center gap-2 sm:flex">
                  <span className="inline-flex rounded-[6px] bg-[#111] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                    {product.badge || "AfriPay Select"}
                  </span>
                  <div className="inline-flex rounded-[8px] border border-[#d9d9d9] bg-white p-1 text-[11px] font-semibold text-[#191919]">
                    <button
                      type="button"
                      onClick={() => setActiveMedia("photo")}
                      className={["rounded-[6px] px-3 py-1.5", activeMedia === "photo" ? "bg-[#191919] text-white" : ""].join(" ")}
                    >
                      Photos
                    </button>
                    {product.videoUrl ? (
                      <button
                        type="button"
                        onClick={() => setActiveMedia("video")}
                        className={["rounded-[6px] px-3 py-1.5", activeMedia === "video" ? "bg-[#191919] text-white" : ""].join(" ")}
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
                    className="inline-flex h-11 w-11 items-center justify-center rounded-[8px] bg-white/92 text-[#111] shadow-[0_8px_20px_rgba(0,0,0,0.12)]"
                    aria-label="Retour"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={shareProduct}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-[8px] bg-white/92 text-[#111] shadow-[0_8px_20px_rgba(0,0,0,0.12)]"
                      aria-label="Partager le produit"
                    >
                      <Share2 className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={toggleFavorite}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-[8px] bg-white/92 text-[#111] shadow-[0_8px_20px_rgba(0,0,0,0.12)]"
                      aria-label="Ajouter aux favoris"
                    >
                      <Heart className={["h-5 w-5", isFavorite ? "fill-current text-[#f06f12]" : ""].join(" ")} />
                    </button>
                  </div>
                </div>

                {shareFeedback ? (
                  <div className="absolute right-3 top-3 z-10 rounded-[8px] bg-black/70 px-4 py-2 text-[12px] font-semibold text-white">
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
                    <div className="rounded-[8px] bg-white/92 px-4 py-2 text-[13px] font-semibold text-[#191919] shadow-[0_10px_24px_rgba(0,0,0,0.12)]">
                      Article {activeImage + 1}/{product.gallery.length}
                    </div>
                  </div>
                ) : null}

                {activeMedia === "photo" && product.gallery.length > 1 ? (
                  <>
                    <button type="button" onClick={goToPreviousImage} className="absolute left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[8px] border border-[#d9d9d9] bg-white text-[#1b1b1b] transition hover:border-[#191919] sm:inline-flex" aria-label="Image précédente">
                      <ChevronRight className="h-5 w-5 rotate-180" />
                    </button>
                    <button type="button" onClick={goToNextImage} className="absolute right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[8px] border border-[#d9d9d9] bg-white text-[#1b1b1b] transition hover:border-[#191919] sm:inline-flex" aria-label="Image suivante">
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            <div className="order-3 min-w-0 px-1 sm:px-0">
              <div className="hidden flex-wrap items-center gap-2 sm:flex">
                <span className="inline-flex items-center gap-2 rounded-[6px] bg-[#fff7ef] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#de6a19]">
                  <ShieldCheck className="h-4 w-4" />
                  Offre verifiee
                </span>
                <span className="inline-flex rounded-[6px] bg-[#f5f5f5] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#555]">
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

              <div className="mt-4 max-w-[620px] overflow-hidden rounded-[8px] border border-[#ffd7bd] bg-[#fff8f3] sm:mt-4">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111827] px-4 py-3 text-white">
                  <div className="text-[13px] font-bold sm:text-[14px]">En plein air · Offre bienvenue</div>
                  <div className="text-[12px] font-semibold sm:text-[13px]">Fin : 7 avril, 21:59 (GMT0)</div>
                </div>
                <div className="bg-white px-4 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-[32px] font-bold leading-none tracking-[-0.04em] text-[#111] sm:text-[46px]">
                      {hasSubtotalRange ? `${formatMoney(subtotalRange.minUsd)} - ${formatMoney(subtotalRange.maxUsd)}` : formatMoney(subtotal)}
                    </div>
                    <div className="rounded-[6px] bg-[#fff1f0] px-2 py-1 text-[13px] font-bold text-[#ff375f]">Economisez {promoSavingsLabel}</div>
                  </div>
                  <div className="mt-2 text-[13px] text-[#888] line-through sm:text-[14px]">{promoOriginalLabel}</div>
                </div>
              </div>

              <div className="mt-3 flex max-w-[620px] items-center justify-between rounded-[8px] bg-[#fff1f1] px-4 py-3 text-[14px] text-[#e53b2d]">
                <span>-{promoSavingsLabel} sur {promoThresholdLabel}</span>
                <ChevronRight className="h-4 w-4" />
              </div>

              <div className="mt-5 max-w-[620px] grid gap-2 sm:grid-cols-2">
                {offerMetrics.map((metric) => (
                  <div key={metric.label} className="rounded-[8px] border border-[#ededed] bg-[#fafafa] px-3 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#888]">{metric.label}</div>
                    <div className="mt-1 text-[14px] font-semibold text-[#241b15]">{metric.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <aside className="order-4 xl:sticky xl:top-4 xl:self-start">
              <div className="overflow-hidden rounded-[8px] border border-[#eceff3] bg-white shadow-[0_16px_44px_rgba(17,24,39,0.08)]">
                <div className="border-b border-[#ececec] px-5 py-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[14px] text-[#191919]">
                      <span className="font-semibold">Vendu par</span>{" "}
                      <span className="truncate text-[#444]">{storefrontSellerName}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-[#666]" />
                  </div>
                </div>

                <div className="space-y-4 px-5 py-4">
                  <div className="space-y-3 border-b border-[#efefef] pb-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-[#4caf50]">✓</div>
                      <div>
                        <div className="text-[14px] font-semibold text-[#191919]">Retour et securite</div>
                        <div className="mt-1 text-[13px] text-[#666]">Paiement traçable, suivi client et preuve logistique regroupés.</div>
                      </div>
                      <ChevronRight className="ml-auto mt-0.5 h-4 w-4 text-[#888]" />
                    </div>
                  </div>

                  {product.variantGroups.length > 0 ? (
                    <div className="border-b border-[#efefef] pb-4">
                      <div className="text-[14px] font-semibold text-[#191919]">Variantes</div>
                      <div className="mt-3 space-y-4">
                        {product.variantGroups.map((group) => (
                          <div key={group.label}>
                            <div className="text-[14px] font-semibold text-[#221813]">
                              {group.label}: <span className="uppercase">{resolveVariantGroupSelection(group, true) || "A choisir"}</span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {group.values.map((value) => {
                                const isSelected = selectedVariants[group.label] === value;

                                return (
                                  <button
                                    key={`${group.label}-${value}`}
                                    type="button"
                                    onClick={() => handleVariantPreviewSelection(group, value)}
                                    className={[
                                      "min-w-[76px] rounded-[8px] border bg-white px-3 py-2 text-[13px] font-medium transition",
                                      isSelected ? "border-[#ff6a00] bg-[#fff7ef] text-[#191919]" : "border-[#dcdcdc] text-[#241b15] hover:border-[#999]",
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

                  <div className="border-t border-[#efefef] pt-4">
                    <div className="text-[14px] font-semibold text-[#191919]">Quantité</div>
                    <div className="mt-3 flex items-center gap-3">
                      <button type="button" onClick={() => updateOrderQuantity(-1)} disabled={orderQuantity <= product.moq} className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#f5f5f5] text-[#55473b] transition hover:bg-[#ebebeb] disabled:cursor-not-allowed disabled:opacity-40">
                        <Minus className="h-4 w-4" />
                      </button>
                      <div className="min-w-[24px] text-center text-[20px] font-semibold tracking-[-0.04em] text-[#1e1712]">{orderQuantity}</div>
                      <button type="button" onClick={() => updateOrderQuantity(1)} className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#f5f5f5] text-[#55473b] transition hover:bg-[#ebebeb]">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 text-[12px] text-[#6c5c50]">{product.moqVerified ? `Minimum ${product.moq} pièce${product.moq > 1 ? "s" : ""}` : "Minimum à confirmer"}</div>
                    {selectedVariantSku?.skuCode || typeof selectedVariantSku?.inventory === "number" ? (
                      <div className="mt-3 rounded-[12px] border border-[#ececec] bg-[#fafafa] px-3 py-3 text-[12px] text-[#5f5145]">
                        {selectedVariantSku?.skuCode ? <div>SKU: <span className="font-semibold text-[#221813]">{selectedVariantSku.skuCode}</span></div> : null}
                        {typeof selectedVariantSku?.inventory === "number" ? <div>Stock variante: <span className="font-semibold text-[#221813]">{selectedVariantSku.inventory}</span></div> : null}
                      </div>
                    ) : null}
                  </div>

                  {missingVariantGroups.length > 0 ? (
                    <div className="rounded-[12px] border border-[#f2d0b1] bg-[#fff5ea] px-4 py-3 text-[13px] font-medium text-[#d15f12]">
                      Options à choisir : {missingVariantGroups.map((group) => group.label).join(", ")}
                    </div>
                  ) : null}
                  <div className="grid gap-3">
                    <button
                      type="button"
                      onClick={handlePrimaryBuyNow}
                      disabled={totalSelectedQuantity <= 0}
                        className="inline-flex h-14 items-center justify-center gap-3 rounded-[8px] bg-[#f05a00] px-6 text-[17px] font-bold text-white transition hover:bg-[#d94f00] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ShoppingCart className="h-4.5 w-4.5" />
                      Acheter maintenant
                    </button>
                    <button
                      type="button"
                      onClick={handlePrimaryAddToCart}
                      disabled={totalSelectedQuantity <= 0}
                      className={[
                        "inline-flex h-14 items-center justify-center rounded-[8px] border border-[#1f1f1f] bg-white px-6 text-[17px] font-semibold text-[#221813] transition hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:border-[#d9d0c8] disabled:text-[#aaa29a]",
                        isCartAnimating ? "animate-[cartButtonPulse_680ms_ease-out]" : "",
                      ].join(" ")}
                    >
                      Ajouter au panier
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-[#efefef] pt-4">
                    <button type="button" onClick={shareProduct} className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] border border-[#e5e5e5] bg-[#fafafa] text-[14px] font-medium text-[#333] transition hover:-translate-y-0.5 hover:border-[#999]">
                      <Share2 className="h-4 w-4 transition group-hover:rotate-12" />
                      Partager
                    </button>
                    <button type="button" onClick={toggleFavorite} className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] border border-[#e5e5e5] bg-[#fafafa] text-[14px] font-medium text-[#333] transition hover:-translate-y-0.5 hover:border-[#999]">
                      <Heart className={["h-4 w-4", isFavorite ? "fill-current text-[#f06f12]" : ""].join(" ")} />
                      Favoris
                    </button>
                    <div className="inline-flex h-12 items-center justify-center gap-1 rounded-[8px] border border-[#efefef] bg-[#fafafa] text-[13px] font-medium text-[#555]">
                      <Star className="h-4 w-4 fill-current text-[#f5b301]" />
                      {typeof product.reviewSummary?.averageRating === "number" ? `Avis ${product.reviewSummary.averageRating.toFixed(1)}` : "Avis clients"}
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <article className="rounded-[8px] border border-[#eceff3] bg-white p-6 shadow-[0_10px_28px_rgba(17,24,39,0.05)]">
              <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#907e70]">Description</div>
              <h2 className="mt-3 text-[24px] font-bold text-[#221813] sm:text-[28px]">Présentation détaillée</h2>
              <div className="mt-6 grid gap-4">
                {descriptionParagraphs.map((point) => (
                  <div key={point} className="border-b border-[#f1f1f1] px-1 py-4 last:border-b-0">
                    <p className="text-[15px] leading-7 text-[#4d4035]">{point}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[8px] border border-[#eceff3] bg-white p-6 shadow-[0_10px_28px_rgba(17,24,39,0.05)]">
              <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#907e70]">Caractéristiques</div>
              <h2 className="mt-3 text-[24px] font-bold text-[#221813] sm:text-[28px]">Fiche technique</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {characteristics.map((item) => (
                  <div key={`${item.label}-${item.value}`} className="rounded-[8px] border border-[#efefef] bg-[#fafafa] px-5 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#94806f]">{item.label}</div>
                    <div className="mt-2 text-[16px] font-semibold leading-6 text-[#261d17]">{item.value}</div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[8px] border border-[#eceff3] bg-white p-6 shadow-[0_10px_28px_rgba(17,24,39,0.05)]">
              <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#907e70]">Confiance AfriPay</div>
              <h2 className="mt-3 text-[24px] font-bold text-[#221813] sm:text-[28px]">Ce que vous validez vraiment</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {trustSignals.map((item) => (
                  <div key={item.label} className="rounded-[8px] border border-[#efefef] bg-[#fafafa] px-5 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#94806f]">{item.label}</div>
                    <div className="mt-2 text-[15px] font-semibold leading-6 text-[#261d17]">{item.value}</div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[8px] border border-[#eceff3] bg-white p-6 shadow-[0_10px_28px_rgba(17,24,39,0.05)]">
              <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#907e70]">Service AfriPay</div>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {serviceHighlights.map((item) => (
                  <div key={item.title} className="rounded-[8px] border border-[#efefef] bg-[#fafafa] px-5 py-5">
                    <div className="text-[18px] font-bold text-[#221813]">{item.title}</div>
                    <p className="mt-3 text-[14px] leading-6 text-[#5f5145]">{item.description}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <article className="rounded-[8px] border border-[#eceff3] bg-white p-5 shadow-[0_10px_28px_rgba(17,24,39,0.05)]">
              <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#907e70]">Vendu par</div>
              <div className="mt-3 text-[22px] font-bold text-[#221813]">{storefrontSellerName}</div>
              <div className="mt-2 text-[14px] text-[#6c5e52]">{storefrontSellerLocation}</div>
              <div className="mt-5 space-y-3">
                {supplierMetrics.map((metric) => (
                  <div key={metric.label} className="flex items-center justify-between gap-4 rounded-[8px] bg-[#fafafa] px-4 py-3">
                    <span className="text-[13px] font-medium text-[#746659]">{metric.label}</span>
                    <span className="text-[14px] font-semibold text-[#241b15]">{metric.value}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[8px] border border-[#eceff3] bg-white p-5 shadow-[0_10px_28px_rgba(17,24,39,0.05)]">
              <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#907e70]">Paiements acceptés</div>
              <div className="mt-5 grid gap-3">
                {paymentMethods.map((method) => (
                  <div key={method.label} className="flex items-center gap-3 rounded-[8px] bg-[#fafafa] px-4 py-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-white text-[#221813] ring-1 ring-[#ece8e2]">
                      {method.icon}
                    </div>
                    <div className="text-[14px] font-semibold text-[#221813]">{method.label}</div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        {relatedProducts.length > 0 ? (
          <section className="rounded-[8px] border border-[#eceff3] bg-white p-6 shadow-[0_10px_28px_rgba(17,24,39,0.05)]">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#907e70]">Articles similaires</div>
              <h2 className="mt-2 text-[28px] font-bold text-[#221813]">Articles similaires</h2>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
              {relatedProducts.map((relatedProduct) => {
                const relatedMoqDisplay = getStorefrontMoqDisplay(relatedProduct);

                return (
                  <Link
                    key={relatedProduct.slug}
                    href={`/products/${relatedProduct.slug}`}
                    className="group overflow-hidden rounded-[8px] border border-[#efefef] bg-white p-3 transition hover:-translate-y-0.5 hover:border-[#ff8a3d] hover:shadow-[0_10px_24px_rgba(0,0,0,0.08)] sm:p-4"
                  >
                    <div className="relative aspect-square overflow-hidden rounded-[8px] bg-[#fafafa]">
                      <Image src={relatedProduct.image} alt={relatedProduct.title} fill sizes="(max-width: 1280px) 50vw, 25vw" className="object-cover transition duration-500 group-hover:scale-[1.04]" />
                    </div>
                    <div className="mt-3 line-clamp-2 text-[13px] font-semibold leading-5 text-[#221813] sm:mt-4 sm:text-[16px] sm:leading-6">{relatedProduct.title}</div>
                    <div className="mt-2 text-[11px] font-semibold text-[#d65d00] sm:text-[12px]">{relatedMoqDisplay.label} · {relatedMoqDisplay.value}</div>
                    <div className="mt-2 text-[18px] font-black tracking-[-0.05em] text-[#221813] sm:mt-3 sm:text-[22px]">{relatedProduct.formattedPrice}</div>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        <ProductReviewsPanel
          productSlug={product.slug}
          productTitle={product.shortTitle}
          locale={product.locale}
          initialSummary={product.reviewSummary}
          initialReviews={product.reviews}
        />
      </div>

      {isImageLightboxOpen ? (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/88 p-3 sm:p-6">
          <button type="button" onClick={() => setIsImageLightboxOpen(false)} className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-[8px] border border-white/20 bg-black/35 text-white transition hover:border-white/50 sm:right-6 sm:top-6" aria-label="Fermer l'image agrandie">
            <X className="h-5 w-5" />
          </button>

          {product.gallery.length > 1 ? (
            <button type="button" onClick={goToPreviousImage} className="absolute left-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-[8px] border border-white/20 bg-black/35 text-white transition hover:border-white/50 sm:left-6" aria-label="Image précédente">
              <ChevronRight className="h-5 w-5 rotate-180" />
            </button>
          ) : null}

          <div className="flex max-h-full w-full max-w-[1280px] flex-col items-center gap-4">
            <div className="relative h-[70vh] w-full overflow-hidden rounded-[8px] bg-[#111] sm:h-[78vh]">
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
              <div className="flex max-w-full gap-2 overflow-x-auto rounded-[8px] bg-black/35 px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {product.gallery.map((image, index) => (
                  <button
                    key={`${image}-lightbox-${index}`}
                    type="button"
                    onClick={() => setActiveImage(index)}
                    className={[
                      "relative h-[62px] min-w-[62px] overflow-hidden rounded-[8px] ring-2 transition",
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
            <button type="button" onClick={goToNextImage} className="absolute right-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-[8px] border border-white/20 bg-black/35 text-white transition hover:border-white/50 sm:right-6" aria-label="Image suivante">
              <ChevronRight className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      ) : null}

      {cartToastVisible ? (
        <div className="pointer-events-none fixed bottom-[calc(var(--mobile-bottom-nav-height)+var(--mobile-floating-cta-height)+92px)] right-4 z-[170] sm:bottom-8 sm:right-8">
          <div className="flex items-center gap-2 rounded-[8px] bg-[#161616] px-4 py-3 text-[13px] font-semibold text-white shadow-[0_18px_38px_rgba(0,0,0,0.24)] animate-[cartToastSlide_1.8s_ease-out_forwards] sm:px-5 sm:text-[14px]">
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
