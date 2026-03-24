import type { ProductCatalogItem } from "@/lib/products-data";
import { deriveVariantGroupsFromPricing, extractAlibabaVariantPricing } from "@/lib/product-variant-pricing";
import { sanitizeItemWeightGrams } from "@/lib/product-weight";

export const ALIBABA_PANEL_SLUGS = [
  "dashboard",
  "accounts",
  "import-catalog",
  "countries",
  "addresses",
  "mappings",
  "requests",
  "lots",
  "receptions",
] as const;

export type AlibabaPanelSlug = (typeof ALIBABA_PANEL_SLUGS)[number];
export type AlibabaImportJobStatus = "draft" | "running" | "completed" | "failed";
export type AlibabaImportedProductStatus = "imported" | "published" | "archived";
export type AlibabaPurchaseOrderStatus = "draft" | "freight_verified" | "order_created" | "payment_pending" | "paid" | "failed";
export type AlibabaPaymentStatus = "not_started" | "pay_url_generated" | "pending" | "paid" | "failed" | "skipped";
export type AlibabaAccountStatus = "connected" | "needs_auth" | "disabled";
export type AlibabaFulfillmentChannel = "standard_us" | "crossborder" | "fast_us" | "mexico" | "best_seller_us" | "best_seller_mexico";

export const ALIBABA_DEFAULT_AUTHORIZE_URL = "https://openapi-auth.alibaba.com/oauth/authorize";
export const ALIBABA_DEFAULT_TOKEN_URL = "https://openapi-api.alibaba.com/rest/auth/token/create";
export const ALIBABA_DEFAULT_REFRESH_URL = "https://openapi-api.alibaba.com/rest/auth/token/refresh";
export const ALIBABA_DEFAULT_API_BASE_URL = "https://openapi-api.alibaba.com";

export type AlibabaImportJob = {
  id: string;
  query: string;
  limit: number;
  fulfillmentChannel: AlibabaFulfillmentChannel;
  autoPublish: boolean;
  status: AlibabaImportJobStatus;
  importedCount: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  productIds: string[];
};

export type AlibabaImportedProduct = {
  id: string;
  sourceProductId: string;
  categorySlug?: string;
  categoryTitle?: string;
  categoryPath?: string[];
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  query: string;
  keywords: string[];
  image: string;
  gallery: string[];
  videoUrl?: string;
  videoPoster?: string;
  packaging: string;
  itemWeightGrams: number;
  lotCbm: string;
  minUsd: number;
  maxUsd?: number;
  moq: number;
  unit: string;
  badge?: string;
  supplierName: string;
  supplierLocation: string;
  supplierCompanyId?: string;
  responseTime: string;
  yearsInBusiness: number;
  transactionsLabel: string;
  soldLabel: string;
  customizationLabel: string;
  shippingLabel: string;
  overview: string[];
  variantGroups: Array<{ label: string; values: string[] }>;
  tiers: Array<{ quantityLabel: string; priceUsd: number; note?: string }>;
  specs: Array<{ label: string; value: string }>;
  inventory: number;
  status: AlibabaImportedProductStatus;
  publishedToSite: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  rawPayload?: unknown;
};

export type AlibabaSupplierAccount = {
  id: string;
  name: string;
  email: string;
  accountPlatform: "buyer" | "seller" | "isv";
  countryCode: string;
  defaultDispatchLocation: string;
  status: AlibabaAccountStatus;
  memberId?: string;
  resourceOwner?: string;
  appKey?: string;
  appSecret?: string;
  authorizeUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  apiBaseUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
  accountId?: string;
  accountLogin?: string;
  accountName?: string;
  oauthCountry?: string;
  isActive?: boolean;
  hasAppSecret?: boolean;
  hasAccessToken?: boolean;
  hasRefreshToken?: boolean;
  lastAuthorizedAt?: string;
  lastError?: string;
  accessTokenHint?: string;
  createdAt: string;
  updatedAt: string;
};

export type AlibabaCountryProfile = {
  countryCode: string;
  countryName: string;
  currencyCode: string;
  defaultCarrierCode: string;
  importTaxRate: number;
  customsMode: "personal" | "business";
  clearanceCodeLabel: string;
  enabled: boolean;
};

export type AlibabaReceptionAddress = {
  id: string;
  label: string;
  contactName: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode?: string;
  countryCode: string;
  port?: string;
  portCode?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AlibabaPurchaseOrder = {
  id: string;
  sourceImportedProductId: string;
  sourceProductId: string;
  productTitle: string;
  supplierName: string;
  supplierCompanyId?: string;
  quantity: number;
  shippingAddressId: string;
  logisticsPayload: Record<string, unknown>;
  buyNowPayload: Record<string, unknown>;
  freightStatus: "not_requested" | "verified" | "failed" | "skipped";
  orderStatus: AlibabaPurchaseOrderStatus;
  paymentStatus: AlibabaPaymentStatus;
  tradeId?: string;
  payUrl?: string;
  payFailureReason?: string;
  amountUsd: number;
  createdAt: string;
  updatedAt: string;
  rawFreightResponse?: unknown;
  rawOrderResponse?: unknown;
  rawPaymentResponse?: unknown;
};

export type AlibabaReceptionRecord = {
  id: string;
  purchaseOrderId: string;
  productTitle: string;
  quantityExpected: number;
  quantityReceived: number;
  status: "pending" | "partial" | "received";
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export function normalizePanelSlug(value: string | undefined): AlibabaPanelSlug {
  return ALIBABA_PANEL_SLUGS.includes((value ?? "dashboard") as AlibabaPanelSlug)
    ? ((value ?? "dashboard") as AlibabaPanelSlug)
    : "dashboard";
}

export function slugifyImportedTitle(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || `alibaba-${Date.now()}`;
}

function normalizeCategorySegment(value: string) {
  return value
    .replace(/[>|/]+/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitCategoryPath(value: string) {
  return value
    .split(/\s*(?:>|\/|\||›|»|\\)\s*/g)
    .map((segment) => normalizeCategorySegment(segment))
    .filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function collectCategoryStrings(value: unknown, depth = 0): string[] {
  if (depth > 4 || value == null) {
    return [];
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized ? [normalized] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectCategoryStrings(entry, depth + 1));
  }

  if (!isRecord(value)) {
    return [];
  }

  const matches: string[] = [];

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    const categoryLike = /(category|cat_name|catname|group|leaf|subject|taxonomy)/.test(normalizedKey);

    if (categoryLike) {
      matches.push(...collectCategoryStrings(nestedValue, depth + 1));
      continue;
    }

    if (depth < 2) {
      matches.push(...collectCategoryStrings(nestedValue, depth + 1));
    }
  }

  return matches;
}

function dedupeStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function looksLikeAlibabaAssetLabel(value?: string) {
  if (!value) {
    return false;
  }

  const normalized = value.trim();
  return /\b220x220\b/i.test(normalized)
    || /^(?:[a-z0-9]{20,}|h[a-z0-9]{20,})(?:[-_. ](?:\d+x\d+|main))?(?:\.(?:png|jpg|jpeg|webp))(?:\s+\d+x\d+\.(?:png|jpg|jpeg|webp))?$/i.test(normalized)
    || /^[a-z0-9]{20,}[-_. ]220x220\.(png|jpg|jpeg|webp)$/i.test(normalized);
}

function normalizeDisplayTitle(value: string) {
  return value
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+(?:220x220|350x350|640x640)\.(?:png|jpg|jpeg|webp)$/i, "")
    .trim();
}

function looksLikeUsefulProductTitle(value?: string) {
  if (!value) {
    return false;
  }

  const normalized = normalizeDisplayTitle(value);
  if (!normalized || looksLikeAlibabaAssetLabel(normalized)) {
    return false;
  }

  return /[a-z]/i.test(normalized) && (normalized.includes(" ") || /\d/.test(normalized));
}

function extractCandidateTitles(value: unknown, depth = 0, keyHint?: string): string[] {
  if (depth > 4 || value == null) {
    return [];
  }

  if (typeof value === "string") {
    const normalized = normalizeDisplayTitle(value);
    return looksLikeUsefulProductTitle(normalized) ? [normalized] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractCandidateTitles(entry, depth + 1, keyHint));
  }

  if (!isRecord(value)) {
    return [];
  }

  const record = value as Record<string, unknown>;
  const results: string[] = [];

  for (const [nestedKey, nestedValue] of Object.entries(record)) {
    const normalizedKey = nestedKey.toLowerCase();
    const titleLike = /(subject|title|product_title|producttitle|display_subject|displaysubject|name)$/i.test(normalizedKey)
      && !/(category|company|supplier|seller|group|model|brand)/i.test(normalizedKey);

    if (titleLike) {
      results.push(...extractCandidateTitles(nestedValue, depth + 1, nestedKey));
    }
  }

  if (results.length > 0) {
    return results;
  }

  for (const [nestedKey, nestedValue] of Object.entries(record)) {
    results.push(...extractCandidateTitles(nestedValue, depth + 1, nestedKey));
  }

  return results;
}

export function resolveAlibabaDisplayTitle(input: {
  title?: string;
  shortTitle?: string;
  query?: string;
  rawPayload?: unknown;
}) {
  const preferred = [input.title, input.shortTitle]
    .map((value) => (value ? normalizeDisplayTitle(value) : undefined))
    .find((value) => looksLikeUsefulProductTitle(value));

  if (preferred) {
    return preferred;
  }

  const payloadTitle = extractCandidateTitles(input.rawPayload)[0];
  if (payloadTitle) {
    return payloadTitle.length > 72 ? `${payloadTitle.slice(0, 69)}...` : payloadTitle;
  }

  const queryTitle = input.query ? normalizeDisplayTitle(input.query) : undefined;
  if (looksLikeUsefulProductTitle(queryTitle)) {
    return queryTitle!;
  }

  return "Produit Alibaba";
}

function inferAlibabaCategoryFromContent(input: {
  rawPayload?: unknown;
  query?: string;
  title?: string;
  keywords?: string[];
}) {
  const rawCandidates = collectCategoryStrings(input.rawPayload).filter((candidate) => !looksLikeAlibabaAssetLabel(candidate));
  const haystack = [
    input.query ?? "",
    input.title ?? "",
    ...(input.keywords ?? []),
    ...rawCandidates,
  ].join(" ").toLowerCase();

  const rules: Array<{ slug: string; title: string; path: string[]; patterns: RegExp[] }> = [
    {
      slug: "keyboard-mouse",
      title: "Claviers & souris",
      path: ["Informatique", "Claviers & souris"],
      patterns: [/\b(mouse|mice|souris|keyboard|keyboards|clavier|claviers|keypad|mouse pad|tapis de souris)\b/i],
    },
    {
      slug: "furniture",
      title: "Meubles",
      path: ["Maison & bureau", "Meubles"],
      patterns: [/\b(furniture|meuble|meubles|desk|bureau|table|chair|fauteuil|sofa|cabinet|shelf|bean bag|office desk|gaming desk|gaming chair)\b/i],
    },
    {
      slug: "fashion-accessories",
      title: "Mode & accessoires",
      path: ["Mode", "Mode & accessoires"],
      patterns: [/\b(hoodie|shirt|t-shirt|fashion|apparel|clothing|vetement|vêtements|sweat|jacket|dress|robe|sac|bag)\b/i],
    },
    {
      slug: "jewelry-accessories",
      title: "Bijoux & accessoires",
      path: ["Accessoires", "Bijoux & accessoires"],
      patterns: [/\b(piercing|jewelry|bijou|bijoux|ring|necklace|bracelet|earring|watch|montre)\b/i],
    },
    {
      slug: "vr-gaming",
      title: "Réalité virtuelle & gaming",
      path: ["Electronique", "Réalité virtuelle & gaming"],
      patterns: [/\b(vr|virtual reality|realite virtuelle|réalité virtuelle|headset|metaverse|game machine|arcade)\b/i],
    },
  ];

  const matchedRule = rules.find((rule) => rule.patterns.some((pattern) => pattern.test(haystack)));
  if (!matchedRule) {
    return null;
  }

  return {
    slug: matchedRule.slug,
    title: matchedRule.title,
    path: matchedRule.path,
  };
}

export function slugifyCategoryLabel(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "catalogue-importe";
}

export function extractAlibabaCategoryInfo(input: {
  rawPayload?: unknown;
  query?: string;
  title?: string;
  keywords?: string[];
  categorySlug?: string;
  categoryTitle?: string;
  categoryPath?: string[];
}) {
  const providedCategoryTitle = looksLikeAlibabaAssetLabel(input.categoryTitle) ? undefined : input.categoryTitle;

  if (input.categorySlug && providedCategoryTitle) {
    return {
      slug: input.categorySlug,
      title: providedCategoryTitle,
      path: input.categoryPath?.filter(Boolean) ?? [providedCategoryTitle],
    };
  }

  const inferredCategory = inferAlibabaCategoryFromContent(input);
  if (inferredCategory) {
    return inferredCategory;
  }

  const rawCandidates = dedupeStrings([
    ...(input.categoryPath ?? []),
    providedCategoryTitle ?? "",
    ...collectCategoryStrings(input.rawPayload),
  ]).filter((candidate) => !looksLikeAlibabaAssetLabel(candidate));

  const pathCandidates = rawCandidates
    .map((candidate) => splitCategoryPath(candidate))
    .filter((segments) => segments.length > 0);

  const bestPath = pathCandidates.find((segments) => segments.length > 1)
    ?? pathCandidates[0]
    ?? [];

  const leafCategory = bestPath[bestPath.length - 1]
    ?? normalizeCategorySegment(input.query ?? "")
    ?? normalizeCategorySegment(input.keywords?.[0] ?? "")
    ?? normalizeCategorySegment(input.title ?? "")
    ?? "Catalogue importe";

  const title = leafCategory.length > 0 ? leafCategory : "Catalogue importe";

  return {
    slug: slugifyCategoryLabel(title),
    title,
    path: bestPath.length > 0 ? bestPath : [title],
  };
}

export function toCatalogProduct(item: AlibabaImportedProduct): ProductCatalogItem {
  const normalizeMediaUrl = (value?: string) => {
    if (!value) {
      return undefined;
    }

    const normalized = value.startsWith("//") ? `https:${value}` : value;
    return normalized.replace(/(\.(?:jpg|jpeg|png|webp))_\d+x\d+\1$/i, "$1");
  };

  const rawPayloadRecord = item.rawPayload && typeof item.rawPayload === "object"
    ? item.rawPayload as Record<string, unknown>
    : null;
  const rawImage = rawPayloadRecord?.image && typeof rawPayloadRecord.image === "object"
    ? rawPayloadRecord.image as Record<string, unknown>
    : null;
  const collectStringCandidates = (value: unknown, depth = 0): string[] => {
    if (depth > 4 || value == null) {
      return [];
    }

    if (typeof value === "string") {
      return value.trim() ? [value.trim()] : [];
    }

    if (Array.isArray(value)) {
      return value.flatMap((entry) => collectStringCandidates(entry, depth + 1));
    }

    if (typeof value !== "object") {
      return [];
    }

    return Object.values(value as Record<string, unknown>).flatMap((entry) => collectStringCandidates(entry, depth + 1));
  };
  const extractVideoUrl = (value: unknown, depth = 0, keyHint?: string): string | undefined => {
    if (depth > 5 || value == null) {
      return undefined;
    }

    if (typeof value === "string") {
      const normalized = normalizeMediaUrl(value);
      return normalized && /\.(mp4|m3u8|webm)(\?|$)/i.test(normalized) ? normalized : undefined;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        const candidate = extractVideoUrl(entry, depth + 1, keyHint);
        if (candidate) {
          return candidate;
        }
      }
      return undefined;
    }

    if (typeof value !== "object") {
      return undefined;
    }

    for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (/video|mp4|m3u8/i.test(nestedKey)) {
        const candidate = extractVideoUrl(nestedValue, depth + 1, nestedKey);
        if (candidate) {
          return candidate;
        }
      }
    }

    for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      const candidate = extractVideoUrl(nestedValue, depth + 1, nestedKey);
      if (candidate) {
        return candidate;
      }
    }

    return undefined;
  };
  const extractMoqInfo = (value: unknown, depth = 0, keyHint?: string): { value?: number; verified: boolean } => {
    if (depth > 5 || value == null) {
      return { verified: false };
    }

    if (typeof value === "number" && Number.isFinite(value) && /moq|min[_ -]?order|begin_amount|quantity_min/i.test(keyHint ?? "")) {
      return { value: Math.max(1, Math.round(value)), verified: true };
    }

    if (typeof value === "string") {
      const normalized = value.trim();
      if (/moq|min[_ -]?order|begin_amount|quantity_min/i.test(keyHint ?? "")) {
        const numeric = Number(normalized.replace(/[^0-9.-]/g, ""));
        if (Number.isFinite(numeric) && numeric > 0) {
          return { value: Math.max(1, Math.round(numeric)), verified: true };
        }
      }

      return { verified: false };
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        const candidate = extractMoqInfo(entry, depth + 1, keyHint);
        if (candidate.verified && candidate.value) {
          return candidate;
        }
      }
      return { verified: false };
    }

    if (typeof value !== "object") {
      return { verified: false };
    }

    for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      const candidate = extractMoqInfo(nestedValue, depth + 1, nestedKey);
      if (candidate.verified && candidate.value) {
        return candidate;
      }
    }

    return { verified: false };
  };
  const rawMultiImage = Array.isArray(rawImage?.multi_image)
    ? rawImage.multi_image.filter((entry): entry is string => typeof entry === "string")
    : [];
  const normalizedGallery = [...new Set([
    ...(item.gallery ?? []).map((image) => normalizeMediaUrl(image)).filter((image): image is string => Boolean(image)),
    normalizeMediaUrl(item.image),
    normalizeMediaUrl(typeof rawImage?.main_image === "string" ? rawImage.main_image : undefined),
    ...rawMultiImage.map((image) => normalizeMediaUrl(image)).filter((image): image is string => Boolean(image)),
  ])].filter((image): image is string => Boolean(image));
  const primaryImage: string = normalizeMediaUrl(item.image) || item.image;
  const rawVideoUrl = extractVideoUrl(rawPayloadRecord);
  const moqInfo = extractMoqInfo(rawPayloadRecord);
  const variantPricing = extractAlibabaVariantPricing(item.rawPayload);
  const fallbackVariantGroups = deriveVariantGroupsFromPricing(variantPricing);
  const resolvedVariantGroups = item.variantGroups.length > 0 ? item.variantGroups : fallbackVariantGroups;
  const resolvedShortTitle = resolveAlibabaDisplayTitle({
    title: item.title,
    shortTitle: item.shortTitle,
    query: item.query,
    rawPayload: item.rawPayload,
  });
  const resolvedTitle = looksLikeAlibabaAssetLabel(item.title)
    ? resolvedShortTitle
    : normalizeDisplayTitle(item.title);
  const resolvedWeightGrams = sanitizeItemWeightGrams(item.itemWeightGrams) ?? 0;

  return {
    slug: item.slug,
    title: resolvedTitle,
    shortTitle: resolvedShortTitle,
    keywords: item.keywords,
    image: primaryImage,
    gallery: normalizedGallery.length > 0 ? normalizedGallery : [primaryImage],
    videoUrl: normalizeMediaUrl(item.videoUrl) ?? rawVideoUrl,
    videoPoster: normalizeMediaUrl(item.videoPoster),
    packaging: item.packaging,
    itemWeightGrams: resolvedWeightGrams,
    lotCbm: item.lotCbm,
    minUsd: item.minUsd,
    maxUsd: item.maxUsd,
    moq: moqInfo.value ?? item.moq,
    moqVerified: moqInfo.verified,
    unit: item.unit,
    badge: item.badge,
    supplierName: item.supplierName,
    supplierLocation: item.supplierLocation,
    responseTime: item.responseTime,
    yearsInBusiness: item.yearsInBusiness,
    transactionsLabel: item.transactionsLabel,
    soldLabel: item.soldLabel,
    customizationLabel: item.customizationLabel,
    shippingLabel: item.shippingLabel,
    overview: item.overview,
    variantGroups: resolvedVariantGroups,
    variantPricing,
    tiers: item.tiers,
    specs: item.specs,
  };
}
