"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeDollarSign, ChevronDown, ChevronRight, ChevronUp, CreditCard, Heart, Minus, Play, Plus, Search, Share2, ShieldCheck, ShoppingCart, Star, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useCart } from "@/components/cart-provider";
import { PaymentMethodIcon } from "@/components/payment-method-icon";
import { getEffectiveProductMoq } from "@/lib/alibaba-sourcing";
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

function stripDescriptionCssNoise(value: string) {
  return value
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/#detail_decorate_root[\s\S]*?(?=<body|<div|<p|<img|<table|$)/gi, " ")
    .replace(/[#.][a-z0-9_-]+\s*\{[^{}]*\}/gi, " ")
    .replace(/[a-z-]+\s*:\s*[^;{}]+;?/gi, (match) => {
      const normalized = match.trim().toLowerCase();
      return /^(color|font|margin|padding|border|width|height|overflow|position|left|right|top|bottom|min-|max-|box-sizing|display|vertical-align|line-height|white-space)/.test(normalized)
        ? " "
        : match;
    })
    .replace(/#detail_decorate_root|\.magic-\d+/gi, " ");
}

function isDescriptionStillNoisy(value: string) {
  const cssTokenCount = (value.match(/#detail_decorate_root|\.magic-\d+|margin-bottom|font-size|border-bottom|overflow:hidden|box-sizing/g) ?? []).length;
  const braceCount = (value.match(/[{}]/g) ?? []).length;
  return cssTokenCount >= 2 || braceCount >= 4;
}

function isTechnicalDescriptionLine(value: string) {
  const normalized = value.trim().toLowerCase();
  return /get product description|produit charge via|loaded via|import afripay|selection verifiee afripay|catalogue afripay|api alibaba|api aliexpress|sku ds exploitable/.test(normalized);
}

function isLikelyImageCaptionNoise(value: string) {
  const normalized = value.trim();
  const lowerCased = normalized.toLowerCase();
  const alphaOnly = normalized.replace(/[^a-zA-Z]/g, "");
  const uppercaseOnly = normalized.replace(/[^A-Z]/g, "");
  const uppercaseRatio = alphaOnly.length > 0 ? uppercaseOnly.length / alphaOnly.length : 0;
  const words = normalized.split(/\s+/).filter(Boolean);
  const shortWordRatio = words.length > 0 ? words.filter((word) => word.length <= 3).length / words.length : 0;

  return uppercaseRatio >= 0.38
    || (words.length >= 10 && shortWordRatio >= 0.45 && !/[.!?]/.test(normalized))
    || /readily solved this year|different from the previous year|to give you more choices|surprises outdoor|mountains|new year christmas|lucky blind boxes|rose pink|baja red|brownish|spend gray|cream apricot/i.test(lowerCased);
}

function isUsefulDescriptionParagraph(value: string) {
  const normalized = value.trim();
  if (normalized.length < 28) {
    return false;
  }

  if (isDescriptionStillNoisy(normalized) || isTechnicalDescriptionLine(normalized) || isLikelyImageCaptionNoise(normalized)) {
    return false;
  }

  const letters = normalized.match(/[a-zA-ZÀ-ÿ]/g) ?? [];
  if (letters.length < 18) {
    return false;
  }

  return true;
}

function buildDescriptionParagraphs(description?: string, fallbackOverview: string[] = []) {
  const normalizedDescription = typeof description === "string" ? description.trim() : "";

  if (normalizedDescription) {
    const plainText = stripDescriptionCssNoise(decodeHtmlEntities(normalizedDescription))
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
      .replace(/<li>/gi, "- ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\r/g, "")
      .replace(/\t/g, " ")
      .replace(/\u00a0/g, " ")
      .replace(/[{}]/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ ]{2,}/g, " ")
      .trim();

    const paragraphs = plainText
      .split(/\n{2,}|\n(?=-\s)/)
      .map((entry) => entry.replace(/\s+/g, " ").trim())
      .filter((entry) => isUsefulDescriptionParagraph(entry));

    if (paragraphs.length > 0) {
      return paragraphs;
    }
  }

  const cleanedFallback = fallbackOverview
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && !isTechnicalDescriptionLine(entry) && !isLikelyImageCaptionNoise(entry));

  if (cleanedFallback.length > 0) {
    return cleanedFallback;
  }

  return ["Consultez la fiche technique ci-dessous pour retrouver les principales caractéristiques du produit."];
}

type ProductLanguageCode = "fr" | "en";

const ATTRIBUTE_LABEL_TRANSLATIONS: Record<string, { fr: string; en: string }> = {
  color: { fr: "Couleur", en: "Color" },
  colour: { fr: "Couleur", en: "Color" },
  size: { fr: "Taille", en: "Size" },
  type: { fr: "Type", en: "Type" },
  reference: { fr: "Reference", en: "Reference" },
  connexion: { fr: "Connexion", en: "Connection" },
  connection: { fr: "Connexion", en: "Connection" },
  fonction: { fr: "Fonction", en: "Function" },
  function: { fr: "Fonction", en: "Function" },
  dimensions: { fr: "Dimensions", en: "Dimensions" },
  emballage: { fr: "Emballage", en: "Packaging" },
  packaging: { fr: "Emballage", en: "Packaging" },
  poids: { fr: "Poids", en: "Weight" },
  weight: { fr: "Poids", en: "Weight" },
  usage: { fr: "Usage", en: "Use" },
  support: { fr: "Support", en: "Support" },
  volume: { fr: "Volume", en: "Volume" },
};

const FRENCH_ATTRIBUTE_VALUE_TRANSLATIONS: Record<string, string> = {
  pink: "Rose",
  khaki: "Kaki",
  black: "Noir",
  brown: "Marron",
  orange: "Orange",
  navy: "Bleu marine",
  "dark gray": "Gris fonce",
  champagne: "Champagne",
  blue: "Bleu",
  gray: "Gris",
  beige: "Beige",
  "light green": "Vert clair",
  "dark brown": "Marron fonce",
  "dark blue": "Bleu fonce",
  burgundy: "Bordeaux",
  "dark green": "Vert fonce",
  "light blue": "Bleu clair",
  red: "Rouge",
  purple: "Violet",
  white: "Blanc",
  green: "Vert",
  "light gray": "Gris clair",
  mint: "Menthe",
};

const COLOR_SWATCH_STYLES: Record<string, { background: string; borderColor?: string }> = {
  pink: { background: "#ec4899" },
  khaki: { background: "#b7a27a" },
  black: { background: "#111827" },
  brown: { background: "#7c4a2d" },
  orange: { background: "#f97316" },
  navy: { background: "#1e3a8a" },
  "dark gray": { background: "#4b5563" },
  champagne: { background: "#e7c78f" },
  blue: { background: "#2563eb" },
  gray: { background: "#9ca3af" },
  beige: { background: "#e5d3b3" },
  "light green": { background: "#8dd7a7" },
  "dark brown": { background: "#5b3a29" },
  "dark blue": { background: "#1d4ed8" },
  burgundy: { background: "#7f1d1d" },
  "dark green": { background: "#166534" },
  "light blue": { background: "#7dd3fc" },
  red: { background: "#dc2626" },
  purple: { background: "#7c3aed" },
  white: { background: "#ffffff", borderColor: "#d0d5dd" },
  green: { background: "#16a34a" },
  "light gray": { background: "#d1d5db" },
  mint: { background: "#99f6e4" },
};

function resolveProductLanguageCode(locale: string): ProductLanguageCode {
  return locale.toLowerCase().startsWith("en") ? "en" : "fr";
}

function normalizeAttributeTranslationKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeSizeDisplayValue(value: string) {
  return value
    .replace(/\bxs\b/gi, "XS")
    .replace(/\bs\b/gi, "S")
    .replace(/\bm\b/gi, "M")
    .replace(/\bl\b/gi, "L")
    .replace(/\bxl\b/gi, "XL")
    .replace(/\bxxl\b/gi, "XXL")
    .replace(/(\d+)\s*xl\b/gi, "$1 XL")
    .replace(/\s+/g, " ")
    .trim();
}

function translateAttributeLabel(label: string, languageCode: ProductLanguageCode) {
  const key = normalizeAttributeTranslationKey(label);
  return ATTRIBUTE_LABEL_TRANSLATIONS[key]?.[languageCode] ?? label;
}

function translateAttributeValue(value: string, languageCode: ProductLanguageCode, label?: string) {
  const normalizedLabel = label ? normalizeAttributeTranslationKey(label) : "";
  const normalizedValue = value.trim();

  if (normalizedLabel === "size") {
    return normalizeSizeDisplayValue(normalizedValue);
  }

  if (languageCode === "fr" && (normalizedLabel === "color" || normalizedLabel === "colour")) {
    return FRENCH_ATTRIBUTE_VALUE_TRANSLATIONS[normalizeAttributeTranslationKey(normalizedValue)] ?? normalizedValue;
  }

  return normalizedValue;
}

function isColorAttributeLabel(label: string) {
  const normalizedLabel = normalizeAttributeTranslationKey(label);
  return normalizedLabel === "color" || normalizedLabel === "colour";
}

function getColorSwatchStyle(value: string) {
  const key = normalizeAttributeTranslationKey(value);
  return COLOR_SWATCH_STYLES[key] ?? null;
}

export function ProductDetailClient({ product, relatedProducts, initialIsFavorite }: ProductDetailClientProps) {
  const selectedCurrency = CURRENCY_CONFIG[(product.currencyCode as CurrencyCode)] ?? CURRENCY_CONFIG.USD;
  const freeShippingThresholdUsd = 20000 / CURRENCY_CONFIG.XOF.rateFromUsd;
  const freeShippingDeadline = new Date(Date.UTC(2026, 5, 7, 21, 59, 0));
  const router = useRouter();
  const { addItem } = useCart();
  const [activeImage, setActiveImage] = useState(0);
  const [activeMedia, setActiveMedia] = useState<"photo" | "video">("photo");
  const [isImageLightboxOpen, setIsImageLightboxOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite ?? false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [validationDialog, setValidationDialog] = useState<{ title: string; message: string } | null>(null);
  const [isCartAnimating, setIsCartAnimating] = useState(false);
  const [cartToastVisible, setCartToastVisible] = useState(false);
  const [isOptionsPanelOpen, setIsOptionsPanelOpen] = useState(false);
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  const touchStartXRef = useRef<number | null>(null);
  const cartAnimationTimeoutRef = useRef<number | null>(null);
  const cartToastTimeoutRef = useRef<number | null>(null);
  const desktopMediaRailRef = useRef<HTMLDivElement | null>(null);
  const characteristicsSectionRef = useRef<HTMLElement | null>(null);
  const descriptionParagraphs = buildDescriptionParagraphs(product.description, product.overview);
  const languageCode = resolveProductLanguageCode(product.locale);
  const isEnglish = languageCode === "en";
  const uiText = isEnglish
    ? {
        seller: "Seller",
        protection: "Protection",
        protectionHint: "Payment, tracking, proof.",
        options: "Options",
        details: "Details",
        choose: "Select",
        quantity: "Qty",
        minimum: "Min.",
        minimumUnknown: "Min. on request",
        stock: "Stock",
        requiredOptions: "Required options",
        chooseFirst: "Select:",
        quantityLow: "Quantity too low",
        minimumOrder: "Minimum order is",
        buyNow: "Buy",
        addToCart: "Cart",
        optionsRequiredTitle: "Options required",
        optionsEntry: "Options & attributes",
        optionsHint: "Open the selector",
        selected: "Selected",
        notSelected: "Choose options",
        subtotal: "Subtotal",
        updateOptions: "Update options",
        close: "Close",
        selectionPanelTitle: "Select options and quantity",
        minimumShort: "MOQ",
      }
    : {
        seller: "Vendeur",
        protection: "Protection",
        protectionHint: "Paiement, suivi, preuve.",
        options: "Options",
        details: "Details",
        choose: "A choisir",
        quantity: "Qte",
        minimum: "Min.",
        minimumUnknown: "Min. a confirmer",
        stock: "Stock",
        requiredOptions: "Options requises",
        chooseFirst: "Choisir :",
        quantityLow: "Quantite insuffisante",
        minimumOrder: "Le minimum est de",
        buyNow: "Acheter",
        addToCart: "Panier",
        optionsRequiredTitle: "Options requises",
        optionsEntry: "Options et attributs",
        optionsHint: "Ouvrir le selecteur",
        selected: "Choisi",
        notSelected: "Choisir les options",
        subtotal: "Sous-total",
        updateOptions: "Modifier les options",
        close: "Fermer",
        selectionPanelTitle: "Selectionnez les options et la quantite",
        minimumShort: "MOQ",
      };

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
    const timer = window.setInterval(() => {
      setCountdownNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
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
  const explicitAttributes = product.specs
    .filter((entry) => entry.label.trim().length > 0 && entry.value.trim().length > 0 && !isWeakLogisticsText(entry.value))
    .map((entry) => ({
      label: entry.label.trim(),
      value: entry.value.trim(),
    }));
  const fallbackCharacteristics = [
    { label: "Type", value: findSpecValue(/type|model|modele|style|material|matiere/i) ?? inferredType },
    { label: "Référence", value: referenceCode },
    { label: "Connexion", value: findSpecValue(/connexion|connection|interface|plug|prise|port/i) ?? inferredConnection },
    { label: "Fonction", value: findSpecValue(/capteur|sensor|feature|fonction|function|light|display/i) ?? inferredSensor },
    { label: "Dimensions", value: dimensionsLabel },
    { label: "Emballage", value: packagingLabel },
    { label: "Poids", value: weightLabel },
    { label: "Usage", value: findSpecValue(/usage|application|compatib|use/i) ?? inferredUse },
    { label: "Support", value: !isWeakLogisticsText(product.responseTime) ? product.responseTime : "Support logistique AfriPay+" },
    { label: "Volume", value: lotLabel },
  ];
  const characteristics = [...new Map(
    [...explicitAttributes, ...fallbackCharacteristics]
      .filter((entry) => entry.label.trim().length > 0 && entry.value.trim().length > 0)
      .map((entry) => [entry.label.trim().toLowerCase(), entry]),
  ).values()].slice(0, 16);
  const visibleSidebarAttributes = explicitAttributes.slice(0, 6);
  const formatAttributeLabel = (label: string) => translateAttributeLabel(label, languageCode);
  const formatAttributeValue = (value: string, label?: string) => translateAttributeValue(value, languageCode, label);
  const selectedOptionSummary = product.variantGroups
    .map((group) => {
      const value = resolveVariantGroupSelection(group);
      return value ? `${formatAttributeLabel(group.label)}: ${formatAttributeValue(value, group.label)}` : null;
    })
    .filter((entry): entry is string => Boolean(entry));
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
  const freeShippingThresholdLabel = formatMoney(freeShippingThresholdUsd);
  const countdownRemainingMs = Math.max(0, freeShippingDeadline.getTime() - countdownNow);
  const countdownTotalSeconds = Math.floor(countdownRemainingMs / 1000);
  const countdownDays = Math.floor(countdownTotalSeconds / 86400);
  const countdownHours = Math.floor((countdownTotalSeconds % 86400) / 3600);
  const countdownMinutes = Math.floor((countdownTotalSeconds % 3600) / 60);
  const countdownSeconds = countdownTotalSeconds % 60;
  const countdownSegments = [
    { label: "j", value: countdownDays },
    { label: "h", value: countdownHours },
    { label: "m", value: countdownMinutes },
    { label: "s", value: countdownSeconds },
  ];
  const effectiveMoq = getEffectiveProductMoq(product.moq, product.itemWeightGrams);
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
  const hasScrollableMediaRail = product.gallery.length + (product.videoUrl ? 1 : 0) > 5;
  const optionSummaryLabel = selectedOptionSummary.length > 0
    ? selectedOptionSummary.join(" • ")
    : missingVariantGroups.length > 0
      ? `${uiText.chooseFirst} ${missingVariantGroups.map((group) => formatAttributeLabel(group.label)).join(", ")}`
      : uiText.notSelected;
  const selectedSkuPreviewImage = selectedVariantSku?.image
    ? (selectedVariantSku.image.startsWith("//") ? `https:${selectedVariantSku.image}` : selectedVariantSku.image)
    : product.gallery[activeImage] ?? product.gallery[0] ?? "";
  const resolveVariantOptionImage = (groupLabel: string, value: string) => {
    const normalizedGroupLabel = normalizeAttributeTranslationKey(groupLabel);
    const matchedSku = (product.variantSkus ?? []).find((sku) => {
      return Object.entries(sku.selections ?? {}).some(([label, entryValue]) => {
        return normalizeAttributeTranslationKey(label) === normalizedGroupLabel && String(entryValue).trim() === value;
      });
    });

    if (!matchedSku?.image) {
      return null;
    }

    return matchedSku.image.startsWith("//") ? `https:${matchedSku.image}` : matchedSku.image;
  };
  const desktopColorOptionLimit = 6;
  const scrollToCharacteristics = () => {
    characteristicsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const updateOrderQuantity = (delta: number) => {
    setOrderQuantity((current) => Math.max(1, current + delta));
  };
  const openOptionsPanel = () => setIsOptionsPanelOpen(true);
  const closeOptionsPanel = () => setIsOptionsPanelOpen(false);
  const scrollDesktopMediaRail = (direction: "up" | "down") => {
    if (!desktopMediaRailRef.current) {
      return;
    }

    desktopMediaRailRef.current.scrollBy({
      top: direction === "down" ? 220 : -220,
      behavior: "smooth",
    });
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
  const openValidationDialog = (title: string, message: string) => {
    setValidationDialog({ title, message });
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
      openOptionsPanel();
      openValidationDialog(
        uiText.optionsRequiredTitle,
        isEnglish
          ? `Please select: ${missingVariantGroups.map((group) => formatAttributeLabel(group.label)).join(", ")}.`
          : `Veuillez choisir : ${missingVariantGroups.map((group) => formatAttributeLabel(group.label)).join(", ")}.`,
      );
      return false;
    }

    if (orderQuantity < effectiveMoq) {
      openOptionsPanel();
      openValidationDialog(
        uiText.quantityLow,
        isEnglish
          ? `Minimum order for this item is ${effectiveMoq}. Please increase the quantity.`
          : `Le minimum de commande pour cet article est ${effectiveMoq}. Veuillez augmenter la quantite.`,
      );
      return false;
    }

    return true;

  useEffect(() => {
    if (!isOptionsPanelOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOptionsPanelOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOptionsPanelOpen]);

  useEffect(() => {
    if (!desktopMediaRailRef.current) {
      return;
    }

    const activeThumb = desktopMediaRailRef.current.querySelector<HTMLButtonElement>('[data-active="true"]');
    activeThumb?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeImage, activeMedia]);
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
        <section className="hidden overflow-hidden rounded-[30px] border border-[#e8edf3] bg-[linear-gradient(180deg,#ffffff_0%,#fcfdff_100%)] p-6 shadow-[0_26px_70px_rgba(15,23,42,0.08)] xl:block">
          <div className="rounded-[24px] border border-[#dce9f9] bg-[linear-gradient(135deg,#eff6ff_0%,#eef7ff_42%,#f8fbff_100%)] px-6 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <div className="flex items-center gap-3 text-[13px] text-[#334155]">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-white text-[28px] font-black text-[#ff6a00] shadow-[0_12px_28px_rgba(15,23,42,0.08)]">90</div>
                  <div className="min-w-0">
                    <div className="truncate text-[24px] font-black tracking-[-0.05em] text-[#0f172a]">{storefrontSellerName}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-medium text-[#334155]">
                      <span>{product.supplierLocation || storefrontSellerLocation}</span>
                      <span>•</span>
                      <span>{Math.max(product.yearsInBusiness, 4)} ans sur AfriPay</span>
                      <span>•</span>
                      <span>Fabricant vérifié</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px] text-[#1e293b]">
                  <span><span className="font-black">4.7/5</span> · avis vérifiés</span>
                  <span>Taux de réachat: <span className="font-bold">23%</span></span>
                  <span>Réponse: <span className="font-bold">≤ 2h</span></span>
                  <span>Livraison à l'heure: <span className="font-bold">97%</span></span>
                </div>
              </div>
              <div className="rounded-[16px] border border-[#d7e6fb] bg-white px-4 py-2 text-[13px] font-bold text-[#2563eb] shadow-[0_10px_24px_rgba(37,99,235,0.08)]">Verified</div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[88px_minmax(0,1fr)_420px]">
            <div className="flex flex-col items-center gap-3">
              {hasScrollableMediaRail ? (
                <button
                  type="button"
                  onClick={() => scrollDesktopMediaRail("up")}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e5e7eb] bg-white text-[#0f172a] shadow-[0_14px_28px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-[#ff8a3d]"
                  aria-label="Défiler vers le haut"
                >
                  <ChevronUp className="h-4.5 w-4.5" />
                </button>
              ) : null}

              <div className="w-full rounded-[28px] bg-[#f7f8fb] px-2 py-3">
                <div ref={desktopMediaRailRef} className="flex max-h-[560px] w-full flex-col items-center gap-3 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {product.gallery.map((image, index) => {
                    const isActive = activeMedia === "photo" && activeImage === index;

                    return (
                      <button
                        key={`${image}-desktop-hero-${index}`}
                        type="button"
                        data-active={isActive ? "true" : "false"}
                        onClick={() => {
                          setActiveMedia("photo");
                          setActiveImage(index);
                        }}
                        className={[
                          "relative h-[74px] w-[74px] overflow-hidden rounded-[18px] border bg-white transition",
                          isActive ? "border-[#111827] shadow-[0_16px_28px_rgba(15,23,42,0.14)]" : "border-[#e5e7eb] hover:border-[#ff8a3d]",
                        ].join(" ")}
                      >
                        <Image src={image} alt={`${product.shortTitle} aperçu ${index + 1}`} fill sizes="74px" className="object-cover" />
                      </button>
                    );
                  })}
                  {product.videoUrl ? (
                    <button
                      type="button"
                      data-active={activeMedia === "video" ? "true" : "false"}
                      onClick={() => setActiveMedia("video")}
                      className={[
                        "relative h-[74px] w-[74px] overflow-hidden rounded-[18px] border bg-[#161820] transition",
                        activeMedia === "video" ? "border-[#111827] shadow-[0_16px_28px_rgba(15,23,42,0.14)]" : "border-[#e5e7eb] hover:border-[#ff8a3d]",
                      ].join(" ")}
                    >
                      {product.videoPoster ? <Image src={product.videoPoster} alt={`${product.shortTitle} vidéo`} fill sizes="74px" className="object-cover opacity-70" /> : null}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#111827] shadow-[0_12px_24px_rgba(0,0,0,0.18)]">
                          <Play className="ml-0.5 h-4 w-4 fill-current" />
                        </div>
                      </div>
                    </button>
                  ) : null}
                </div>
              </div>

              {hasScrollableMediaRail ? (
                <button
                  type="button"
                  onClick={() => scrollDesktopMediaRail("down")}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e5e7eb] bg-white text-[#0f172a] shadow-[0_14px_28px_rgba(15,23,42,0.08)] transition hover:translate-y-0.5 hover:border-[#ff8a3d]"
                  aria-label="Défiler vers le bas"
                >
                  <ChevronDown className="h-4.5 w-4.5" />
                </button>
              ) : null}
            </div>

            <div className="min-w-0">
              <div className="relative overflow-hidden rounded-[30px] bg-[#f6f7fb] px-8 py-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                <div className="absolute right-5 top-5 z-20 flex flex-col gap-4">
                  <button type="button" onClick={toggleFavorite} className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#111827] shadow-[0_14px_30px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5">
                    <Heart className={["h-5 w-5", isFavorite ? "fill-current text-[#ea580c]" : ""].join(" ")} />
                  </button>
                  <button type="button" onClick={openImageLightbox} className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#111827] shadow-[0_14px_30px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5">
                    <Search className="h-5 w-5" />
                  </button>
                  <button type="button" onClick={shareProduct} className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#111827] shadow-[0_14px_30px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5">
                    <Share2 className="h-5 w-5" />
                  </button>
                </div>

                {activeMedia === "photo" && product.gallery.length > 1 ? (
                  <>
                    <button type="button" onClick={goToPreviousImage} className="absolute left-5 top-1/2 z-20 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#111827] shadow-[0_14px_30px_rgba(15,23,42,0.12)] transition hover:-translate-x-0.5">
                      <ChevronRight className="h-5 w-5 rotate-180" />
                    </button>
                    <button type="button" onClick={goToNextImage} className="absolute right-24 top-1/2 z-20 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#111827] shadow-[0_14px_30px_rgba(15,23,42,0.12)] transition hover:translate-x-0.5">
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                ) : null}

                <div className="relative aspect-[1/1] w-full">
                  {activeMedia === "video" && product.videoUrl ? (
                    <video controls poster={product.videoPoster} className="h-full w-full rounded-[22px] object-contain" src={product.videoUrl} />
                  ) : (
                    <button type="button" onClick={openImageLightbox} className="relative h-full w-full cursor-zoom-in">
                      <Image src={product.gallery[activeImage] ?? product.gallery[0]} alt={product.title} fill sizes="(min-width: 1280px) 58vw, 100vw" className="object-contain" priority />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveMedia("photo")}
                  className={["rounded-[14px] px-5 py-2.5 text-[15px] font-semibold transition", activeMedia === "photo" ? "bg-white text-[#111827] shadow-[0_12px_24px_rgba(15,23,42,0.1)] ring-1 ring-[#e5e7eb]" : "text-[#667085] hover:text-[#111827]"] .join(" ")}
                >
                  Photos
                </button>
                {product.videoUrl ? (
                  <button
                    type="button"
                    onClick={() => setActiveMedia("video")}
                    className={["rounded-[14px] px-5 py-2.5 text-[15px] font-semibold transition", activeMedia === "video" ? "bg-white text-[#111827] shadow-[0_12px_24px_rgba(15,23,42,0.1)] ring-1 ring-[#e5e7eb]" : "text-[#667085] hover:text-[#111827]"] .join(" ")}
                  >
                    Vidéo
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={scrollToCharacteristics}
                  className="rounded-[14px] px-5 py-2.5 text-[15px] font-semibold text-[#667085] transition hover:bg-white hover:text-[#111827] hover:shadow-[0_12px_24px_rgba(15,23,42,0.1)] hover:ring-1 hover:ring-[#e5e7eb]"
                >
                  Attributs
                </button>
              </div>
            </div>

            <aside className="rounded-[28px] border border-[#eceff3] bg-white px-6 py-6 shadow-[0_22px_56px_rgba(15,23,42,0.08)]">
              <div className="rounded-[20px] border border-[#e5e7eb] bg-[#fcfcfd] px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[13px] font-semibold text-[#667085]">Prix de l'échantillon</div>
                    <div className="mt-1 text-[28px] font-black tracking-[-0.05em] text-[#101828]">{formatMoney(displayUnitPrice > 0 ? displayUnitPrice : displayPriceSummary.minUsd)}</div>
                  </div>
                  <button type="button" onClick={openOptionsPanel} className="inline-flex h-12 items-center justify-center rounded-full border border-[#111827] px-6 text-[14px] font-semibold text-[#111827] transition hover:bg-[#111827] hover:text-white">Obtenir</button>
                </div>
              </div>

              <div className="mt-7 border-t border-[#edf1f5] pt-7">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-[18px] font-black tracking-[-0.04em] text-[#101828]">Options</div>
                  <button type="button" onClick={openOptionsPanel} className="text-[15px] font-semibold text-[#0f172a] underline underline-offset-4">Sélectionner</button>
                </div>

                {product.variantGroups.map((group) => {
                  const isColorGroup = isColorAttributeLabel(group.label);
                  const visibleValues = isColorGroup ? group.values.slice(0, desktopColorOptionLimit) : group.values;
                  const remainingCount = isColorGroup ? Math.max(0, group.values.length - desktopColorOptionLimit) : 0;

                  return (
                    <div key={`${group.label}-desktop-inline`} className="mt-6">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[16px] font-bold text-[#111827]">{formatAttributeLabel(group.label)}: <span className="font-medium">{formatAttributeValue(resolveVariantGroupSelection(group, true) || uiText.choose, group.label)}</span></div>
                        {normalizeAttributeTranslationKey(group.label) === "size" ? <button type="button" onClick={openOptionsPanel} className="text-[13px] font-semibold text-[#475467] underline underline-offset-4">Guide des tailles</button> : null}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        {visibleValues.map((value) => {
                          const isSelected = selectedVariants[group.label] === value;
                          const previewImage = resolveVariantOptionImage(group.label, value);

                          if (isColorGroup && previewImage) {
                            return (
                              <button
                                key={`${group.label}-desktop-value-${value}`}
                                type="button"
                                onClick={() => handleVariantPreviewSelection(group, value)}
                                className={[
                                  "relative h-[60px] w-[60px] overflow-hidden rounded-[16px] border bg-[#f8fafc] transition",
                                  isSelected ? "border-[#111827] shadow-[0_16px_26px_rgba(15,23,42,0.16)]" : "border-[#e5e7eb] hover:border-[#ff8a3d]",
                                ].join(" ")}
                              >
                                <Image src={previewImage} alt={`${formatAttributeLabel(group.label)} ${formatAttributeValue(value, group.label)}`} fill sizes="60px" className="object-cover" />
                              </button>
                            );
                          }

                          return (
                            <button
                              key={`${group.label}-desktop-pill-${value}`}
                              type="button"
                              onClick={() => handleVariantPreviewSelection(group, value)}
                              className={[
                                "inline-flex min-w-[42px] items-center justify-center rounded-[12px] border px-4 py-2.5 text-[15px] font-semibold transition",
                                isSelected ? "border-[#111827] bg-white text-[#111827] shadow-[0_12px_22px_rgba(15,23,42,0.12)]" : "border-[#e5e7eb] bg-[#f8fafc] text-[#111827] hover:border-[#ff8a3d]",
                              ].join(" ")}
                            >
                              {formatAttributeValue(value, group.label)}
                            </button>
                          );
                        })}

                        {remainingCount > 0 ? (
                          <button type="button" onClick={openOptionsPanel} className="inline-flex h-[60px] min-w-[60px] items-center justify-center rounded-[16px] border border-[#e5e7eb] bg-[#f3f4f6] px-3 text-[20px] font-semibold text-[#475467] transition hover:border-[#ff8a3d]">+{remainingCount}</button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 border-t border-[#edf1f5] pt-7">
                <div className="text-[18px] font-black tracking-[-0.04em] text-[#101828]">Expédition</div>
                <p className="mt-3 text-[15px] leading-7 text-[#475467]">Frais de livraison et date de livraison à négocier. Contactez le fournisseur.</p>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-4">
                <button type="button" onClick={handlePrimaryBuyNow} className="inline-flex h-14 items-center justify-center rounded-full bg-[#ea580c] px-6 text-[16px] font-bold text-white shadow-[0_18px_34px_rgba(234,88,12,0.28)] transition hover:bg-[#d65200]">Envoyer demande</button>
                <button type="button" onClick={handlePrimaryAddToCart} className="inline-flex h-14 items-center justify-center rounded-full border border-[#111827] bg-white px-6 text-[16px] font-semibold text-[#111827] transition hover:bg-[#f8fafc]">Discuter ici</button>
              </div>
            </aside>
          </div>
        </section>

        <section className="overflow-hidden rounded-[8px] border border-[#eceff3] bg-white p-3 shadow-[0_16px_44px_rgba(17,24,39,0.08)] sm:p-4 xl:hidden">
          <div className="hidden flex-wrap items-center gap-2 text-[12px] text-[#666] sm:flex">
            <Link href="/" className="transition hover:text-[#191919]">Accueil</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href="/products" className="transition hover:text-[#191919]">Produits</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="max-w-[280px] truncate text-[#191919]">{product.shortTitle}</span>
          </div>

          <div className="mt-0 grid gap-5 sm:mt-4 xl:grid-cols-[84px_minmax(0,500px)_minmax(0,1fr)_316px]">
            <div className="order-2 hidden xl:order-1 xl:flex xl:flex-col xl:items-center xl:gap-3">
              {hasScrollableMediaRail ? (
                <button
                  type="button"
                  onClick={() => scrollDesktopMediaRail("up")}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e6e9ef] bg-white text-[#1f2937] shadow-[0_12px_28px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-[#ff8a3d]"
                  aria-label={isEnglish ? "Scroll thumbnails up" : "Defiler les miniatures vers le haut"}
                >
                  <ChevronUp className="h-4.5 w-4.5" />
                </button>
              ) : null}

              <div
                ref={desktopMediaRailRef}
                className="flex max-h-[560px] w-full flex-col items-center gap-2 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {product.gallery.map((image, index) => {
                  const isActive = activeMedia === "photo" && activeImage === index;

                  return (
                    <button
                      key={`${image}-${index}`}
                      type="button"
                      data-active={isActive ? "true" : "false"}
                      onClick={() => {
                        setActiveMedia("photo");
                        setActiveImage(index);
                      }}
                      className={[
                        "relative h-[76px] w-[76px] overflow-hidden rounded-[18px] border bg-white transition",
                        isActive ? "border-[#101828] shadow-[0_16px_32px_rgba(15,23,42,0.14)]" : "border-[#e5e7eb] hover:border-[#ff8a3d] hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]",
                      ].join(" ")}
                    >
                      <Image src={image} alt={`${product.shortTitle} aperçu ${index + 1}`} fill sizes="76px" className="object-cover" />
                    </button>
                  );
                })}
                {product.videoUrl ? (
                  <button
                    type="button"
                    data-active={activeMedia === "video" ? "true" : "false"}
                    onClick={() => setActiveMedia("video")}
                    className={[
                      "relative h-[76px] w-[76px] overflow-hidden rounded-[18px] border bg-[#161820] transition",
                      activeMedia === "video" ? "border-[#101828] shadow-[0_16px_32px_rgba(15,23,42,0.14)]" : "border-[#e5e7eb] hover:border-[#ff8a3d] hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]",
                    ].join(" ")}
                  >
                    {product.videoPoster ? <Image src={product.videoPoster} alt={`${product.shortTitle} vidéo`} fill sizes="76px" className="object-cover opacity-70" /> : null}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#151515] shadow-[0_10px_20px_rgba(0,0,0,0.15)]">
                        <Play className="ml-0.5 h-4.5 w-4.5 fill-current" />
                      </div>
                    </div>
                  </button>
                ) : null}
              </div>

              {hasScrollableMediaRail ? (
                <button
                  type="button"
                  onClick={() => scrollDesktopMediaRail("down")}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e6e9ef] bg-white text-[#1f2937] shadow-[0_12px_28px_rgba(15,23,42,0.08)] transition hover:translate-y-0.5 hover:border-[#ff8a3d]"
                  aria-label={isEnglish ? "Scroll thumbnails down" : "Defiler les miniatures vers le bas"}
                >
                  <ChevronDown className="h-4.5 w-4.5" />
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

                <div className="absolute inset-x-0 bottom-0 z-20 sm:hidden">
                  <div className="mx-3 mb-3 overflow-hidden rounded-[24px] border border-white/70 bg-white/82 p-2 shadow-[0_18px_40px_rgba(15,23,42,0.16)] backdrop-blur-md">
                    <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {product.gallery.map((image, index) => {
                        const isActive = activeMedia === "photo" && activeImage === index;

                        return (
                          <button
                            key={`${image}-mobile-${index}`}
                            type="button"
                            onClick={() => {
                              setActiveMedia("photo");
                              setActiveImage(index);
                            }}
                            className={[
                              "relative h-[66px] min-w-[66px] overflow-hidden rounded-[18px] border bg-white transition",
                              isActive ? "border-[#101828] shadow-[0_12px_24px_rgba(15,23,42,0.18)]" : "border-transparent opacity-80",
                            ].join(" ")}
                          >
                            <Image src={image} alt={`${product.shortTitle} aperçu mobile ${index + 1}`} fill sizes="66px" className="object-cover" />
                          </button>
                        );
                      })}
                      {product.videoUrl ? (
                        <button
                          type="button"
                          onClick={() => setActiveMedia("video")}
                          className={[
                            "relative h-[66px] min-w-[66px] overflow-hidden rounded-[18px] border bg-[#161820] transition",
                            activeMedia === "video" ? "border-[#101828] shadow-[0_12px_24px_rgba(15,23,42,0.18)]" : "border-transparent opacity-85",
                          ].join(" ")}
                        >
                          {product.videoPoster ? <Image src={product.videoPoster} alt={`${product.shortTitle} vidéo mobile`} fill sizes="66px" className="object-cover opacity-70" /> : null}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#151515] shadow-[0_8px_20px_rgba(0,0,0,0.15)]">
                              <Play className="ml-0.5 h-4 w-4 fill-current" />
                            </div>
                          </div>
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

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

              <div className="mt-4 max-w-[620px] overflow-hidden rounded-[10px] border border-[#ff6a00] bg-[#ff6a00] text-white shadow-[0_20px_50px_rgba(255,106,0,0.28)] sm:mt-4">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-[#ff6a00] px-4 py-3">
                  <div className="text-[13px] font-black uppercase tracking-[0.08em] sm:text-[14px]">Livraison gratuite eligible</div>
                  <div className="flex flex-wrap items-center gap-2 text-[12px] font-black sm:text-[13px]">
                    <span>Fin : 7 juin, 21:59 (GMT0)</span>
                    <div className="flex items-center gap-1.5">
                      {countdownSegments.map((segment) => (
                        <span key={segment.label} className="inline-flex min-w-[52px] items-center justify-center rounded-[7px] bg-white px-2 py-1 text-[12px] font-black text-[#ff6a00] shadow-[0_8px_18px_rgba(255,255,255,0.25)] animate-pulse sm:min-w-[56px]">
                          {String(segment.value).padStart(2, "0")}
                          <span className="ml-1 text-[10px] uppercase tracking-[0.08em] text-[#ff6a00]">{segment.label}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="bg-[#fff4eb] px-4 py-4 text-[#7a2d00]">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-[32px] font-black leading-none tracking-[-0.04em] text-[#7a2d00] sm:text-[46px]">
                      {hasSubtotalRange ? `${formatMoney(subtotalRange.minUsd)} - ${formatMoney(subtotalRange.maxUsd)}` : formatMoney(subtotal)}
                    </div>
                    <div className="rounded-[999px] bg-[#ff6a00] px-3 py-1.5 text-[13px] font-black text-white shadow-[0_10px_22px_rgba(255,106,0,0.24)]">
                      Livraison gratuite des {freeShippingThresholdLabel}
                    </div>
                  </div>
                  <div className="mt-2 text-[14px] font-bold text-[#a04400] sm:text-[15px]">
                    Livraison gratuite disponible a partir de {freeShippingThresholdLabel} si la commande ne depasse pas 2,5 kg.
                  </div>
                </div>
              </div>

              <div className="mt-3 flex max-w-[620px] items-center justify-between rounded-[10px] border border-[#ffb37a] bg-[#fff0e4] px-4 py-3 text-[14px] font-bold text-[#d94800] shadow-[0_14px_30px_rgba(255,106,0,0.10)]">
                <span>Offre transport visible en devise locale jusqu'au 7 juin pour les commandes jusqu'a 2,5 kg.</span>
                <ChevronRight className="h-4 w-4" />
              </div>

            </div>

            <aside className="order-4 xl:sticky xl:top-4 xl:self-start">
              <div className="overflow-hidden rounded-[8px] border border-[#eceff3] bg-white shadow-[0_16px_44px_rgba(17,24,39,0.08)]">
                <div className="border-b border-[#ececec] px-4 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[12px] text-[#191919] sm:text-[13px]">
                      <span className="font-semibold">{uiText.seller}</span>{" "}
                      <span className="truncate text-[#444]">{storefrontSellerName}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-[#666]" />
                  </div>
                </div>

                <div className="space-y-3 px-4 py-3.5">
                  <div className="space-y-2 border-b border-[#efefef] pb-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-[#4caf50]">✓</div>
                      <div>
                        <div className="text-[13px] font-semibold text-[#191919]">{uiText.protection}</div>
                        <div className="mt-0.5 text-[11px] text-[#666] sm:text-[12px]">{uiText.protectionHint}</div>
                      </div>
                      <ChevronRight className="ml-auto mt-0.5 h-4 w-4 text-[#888]" />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={openOptionsPanel}
                    className="group flex w-full items-start justify-between rounded-[20px] border border-[#e6eaf0] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-4 py-4 text-left shadow-[0_16px_32px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-[#ff8a3d] hover:shadow-[0_22px_40px_rgba(15,23,42,0.10)]"
                  >
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#8a6f5a]">{uiText.optionsEntry}</div>
                      <div className="mt-2 line-clamp-2 text-[14px] font-semibold text-[#221813]">{optionSummaryLabel}</div>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[#6b7280]">
                        <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-[#e5e7eb]">{uiText.minimumShort} {effectiveMoq}</span>
                        <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-[#e5e7eb]">{uiText.quantity} {orderQuantity}</span>
                        {typeof selectedVariantSku?.inventory === "number" ? <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-[#e5e7eb]">{uiText.stock} {selectedVariantSku.inventory}</span> : null}
                      </div>
                    </div>
                    <div className="ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#111827] ring-1 ring-[#e5e7eb] transition group-hover:bg-[#111827] group-hover:text-white">
                      <ChevronRight className="h-4.5 w-4.5" />
                    </div>
                  </button>

                  <div className="grid gap-3">
                    <button
                      type="button"
                      onClick={handlePrimaryBuyNow}
                      disabled={totalSelectedQuantity <= 0}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#f05a00] px-5 text-[15px] font-bold text-white transition hover:bg-[#d94f00] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ShoppingCart className="h-4.5 w-4.5" />
                      {uiText.buyNow}
                    </button>
                    <button
                      type="button"
                      onClick={handlePrimaryAddToCart}
                      disabled={totalSelectedQuantity <= 0}
                      className={[
                        "inline-flex h-11 items-center justify-center rounded-[8px] border border-[#1f1f1f] bg-white px-5 text-[15px] font-semibold text-[#221813] transition hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:border-[#d9d0c8] disabled:text-[#aaa29a]",
                        isCartAnimating ? "animate-[cartButtonPulse_680ms_ease-out]" : "",
                      ].join(" ")}
                    >
                      {uiText.addToCart}
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
            <article ref={characteristicsSectionRef} className="rounded-[8px] border border-[#eceff3] bg-white p-6 shadow-[0_10px_28px_rgba(17,24,39,0.05)]">
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

      {validationDialog ? (
        <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/28 px-4">
          <div className="w-full max-w-[360px] rounded-[16px] border border-[#f1d5bf] bg-white p-5 shadow-[0_28px_60px_rgba(17,24,39,0.24)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ff6a00]">Validation</div>
                <div className="mt-2 text-[20px] font-black tracking-[-0.04em] text-[#221813]">{validationDialog.title}</div>
              </div>
              <button
                type="button"
                onClick={() => setValidationDialog(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#e8e1da] bg-white text-[#6c5c50] transition hover:border-[#ff6a00] hover:text-[#ff6a00]"
                aria-label="Fermer la fenêtre"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-[14px] leading-6 text-[#5f5145]">{validationDialog.message}</p>
            <button
              type="button"
              onClick={() => setValidationDialog(null)}
              className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-[12px] bg-[#ff6a00] px-4 text-[14px] font-bold text-white transition hover:bg-[#e55f00]"
            >
              Compris
            </button>
          </div>
        </div>
      ) : null}

      {isOptionsPanelOpen ? (
        <div className="fixed inset-0 z-[185] bg-[#0f172a]/46 backdrop-blur-[2px]" onClick={closeOptionsPanel}>
          <div
            className="absolute bottom-0 right-0 top-auto flex h-[88vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_32px_80px_rgba(15,23,42,0.28)] sm:max-w-[520px] sm:rounded-none sm:rounded-l-[32px] sm:top-0 sm:h-full"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-[#edf1f5] px-5 py-5 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[26px] font-black tracking-[-0.05em] text-[#101828]">{uiText.selectionPanelTitle}</div>
                  <div className="mt-2 text-[13px] text-[#667085]">{product.shortTitle}</div>
                </div>
                <button
                  type="button"
                  onClick={closeOptionsPanel}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e6e9ef] bg-white text-[#344054] transition hover:border-[#ff8a3d] hover:text-[#ff6a00]"
                  aria-label={uiText.close}
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
              {selectedSkuPreviewImage ? (
                <section className="overflow-hidden rounded-[28px] border border-[#e6eaf0] bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
                  <div className="relative aspect-[1.05/1] bg-[radial-gradient(circle_at_top,#f8fafc_0%,#eef2f6_52%,#e5ebf3_100%)]">
                    <Image
                      src={selectedSkuPreviewImage}
                      alt={selectedVariantSku?.skuCode ? `SKU ${selectedVariantSku.skuCode}` : product.shortTitle}
                      fill
                      sizes="(max-width: 640px) 100vw, 420px"
                      className="object-contain p-6"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-[#edf1f5] px-4 py-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8b7a6d]">{uiText.selected}</div>
                      <div className="mt-1 text-[14px] font-semibold text-[#101828] line-clamp-2">{optionSummaryLabel}</div>
                    </div>
                    {selectedVariantSku?.skuCode ? <div className="rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-[#344054] ring-1 ring-[#eaecf0]">SKU {selectedVariantSku.skuCode}</div> : null}
                  </div>
                </section>
              ) : null}

              {product.variantGroups.length > 0 ? (
                <div className="space-y-5">
                  {product.variantGroups.map((group) => (
                    <section key={group.label} className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[15px] font-bold text-[#101828]">{formatAttributeLabel(group.label)}</div>
                        <div className="text-[13px] font-semibold text-[#475467]">{formatAttributeValue(resolveVariantGroupSelection(group, true) || uiText.choose, group.label)}</div>
                      </div>
                      <div className="flex flex-wrap gap-2.5">
                        {group.values.map((value) => {
                          const isSelected = selectedVariants[group.label] === value;
                          const swatchStyle = isColorAttributeLabel(group.label) ? getColorSwatchStyle(value) : null;

                          return (
                            <button
                              key={`${group.label}-panel-${value}`}
                              type="button"
                              onClick={() => handleVariantPreviewSelection(group, value)}
                              className={[
                                "min-w-[68px] rounded-[18px] border px-3.5 py-2.5 text-[13px] font-semibold transition",
                                isSelected
                                  ? "border-[#111827] bg-[#111827] text-white shadow-[0_12px_22px_rgba(17,24,39,0.18)]"
                                  : "border-[#e5e7eb] bg-[#f8fafc] text-[#111827] hover:border-[#ff8a3d] hover:bg-white",
                              ].join(" ")}
                            >
                              <span className="flex items-center gap-2">
                                {swatchStyle ? (
                                  <span
                                    className="inline-flex h-5 w-5 shrink-0 rounded-full ring-1"
                                    style={{
                                      background: swatchStyle.background,
                                      boxShadow: `inset 0 0 0 1px ${swatchStyle.borderColor ?? "rgba(255,255,255,0.16)"}`,
                                      borderColor: swatchStyle.borderColor ?? "transparent",
                                    }}
                                  />
                                ) : null}
                                <span>{formatAttributeValue(value, group.label)}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              ) : visibleSidebarAttributes.length > 0 ? (
                <section className="space-y-3">
                  <div className="text-[15px] font-bold text-[#101828]">{uiText.optionsEntry}</div>
                  <div className="grid gap-2">
                    {visibleSidebarAttributes.map((attribute) => (
                      <div key={`${attribute.label}-${attribute.value}-panel`} className="rounded-[18px] border border-[#eaecf0] bg-[#f8fafc] px-4 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8b7a6d]">{formatAttributeLabel(attribute.label)}</div>
                        <div className="mt-1.5 text-[14px] font-semibold text-[#101828]">{formatAttributeValue(attribute.value, attribute.label)}</div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="rounded-[22px] border border-[#eaecf0] bg-[#fcfcfd] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[15px] font-bold text-[#101828]">{uiText.quantity}</div>
                    <div className="mt-1 text-[12px] text-[#667085]">{product.moqVerified ? `${uiText.minimumShort} ${effectiveMoq}` : uiText.minimumUnknown}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => updateOrderQuantity(-1)} disabled={orderQuantity <= 1} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d0d5dd] bg-white text-[#475467] transition hover:border-[#ff8a3d] hover:text-[#ff6a00] disabled:opacity-40">
                      <Minus className="h-4 w-4" />
                    </button>
                    <div className="min-w-[28px] text-center text-[20px] font-black tracking-[-0.04em] text-[#101828]">{orderQuantity}</div>
                    <button type="button" onClick={() => updateOrderQuantity(1)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d0d5dd] bg-white text-[#475467] transition hover:border-[#ff8a3d] hover:text-[#ff6a00]">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {selectedVariantSku?.skuCode || typeof selectedVariantSku?.inventory === "number" ? (
                  <div className="mt-4 flex flex-wrap gap-2 text-[12px] text-[#475467]">
                    {selectedVariantSku?.skuCode ? <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-[#eaecf0]">SKU {selectedVariantSku.skuCode}</span> : null}
                    {typeof selectedVariantSku?.inventory === "number" ? <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-[#eaecf0]">{uiText.stock} {selectedVariantSku.inventory}</span> : null}
                  </div>
                ) : null}
              </section>
            </div>

            <div className="border-t border-[#edf1f5] bg-white px-5 py-4 shadow-[0_-14px_32px_rgba(15,23,42,0.06)] sm:px-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#8b7a6d]">{uiText.subtotal}</div>
                  <div className="mt-1 text-[28px] font-black tracking-[-0.05em] text-[#101828]">{hasSubtotalRange ? `${formatMoney(subtotalRange.minUsd)} - ${formatMoney(subtotalRange.maxUsd)}` : formatMoney(subtotal)}</div>
                </div>
                <button
                  type="button"
                  onClick={closeOptionsPanel}
                  className="hidden h-11 items-center justify-center rounded-full border border-[#d0d5dd] px-5 text-[13px] font-semibold text-[#344054] transition hover:border-[#ff8a3d] hover:text-[#ff6a00] sm:inline-flex"
                >
                  {uiText.close}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!validateSelectionBeforeOrder()) {
                      return;
                    }
                    closeOptionsPanel();
                    addSelectionToCart();
                  }}
                  className="inline-flex h-12 items-center justify-center rounded-full border border-[#111827] bg-white px-5 text-[14px] font-semibold text-[#111827] transition hover:bg-[#f8fafc]"
                >
                  {uiText.addToCart}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!validateSelectionBeforeOrder()) {
                      return;
                    }
                    closeOptionsPanel();
                    proceedToCheckout();
                  }}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-[#ea580c] px-5 text-[14px] font-bold text-white transition hover:bg-[#d74f00]"
                >
                  {uiText.buyNow}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
