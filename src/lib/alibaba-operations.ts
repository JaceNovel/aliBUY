import type { ProductCatalogItem } from "@/lib/products-data";
import { deriveVariantGroupsFromPricing, extractAlibabaVariantPricing, extractAlibabaVariantSkus } from "@/lib/product-variant-pricing";
import { resolveAlibabaMoq } from "@/lib/product-moq";
import { sanitizeItemWeightGrams } from "@/lib/product-weight";
import { convertUsdToFcfa } from "@/lib/alibaba-sourcing";

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
  moqVerified?: boolean;
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
  weightVerified?: boolean;
  priceVerified?: boolean;
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
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\.(?:html?|php)\b[^\s]*/gi, " ")
    .replace(/\b(?:field|src|spm|scene|sku|id)=[^\s]+/gi, " ")
    .replace(/[>|/]+/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericCategoryLabel(value?: string) {
  if (!value) {
    return true;
  }

  const normalized = normalizeCategorySegment(value).toLowerCase();
  return !normalized
    || /^(catalogue importe|produit alibaba|alibaba|general|misc|other|others|undefined|null|n\/?a|na|unknown|sans nom|untitled)$/i.test(normalized)
    || /\bnew arrival\b/i.test(normalized);
}

function isUsefulCategoryCandidate(value?: string) {
  if (!value) {
    return false;
  }

  const normalized = normalizeCategorySegment(value);
  if (!normalized || looksLikeAlibabaAssetLabel(normalized) || isGenericCategoryLabel(normalized)) {
    return false;
  }

  if (/\.(?:html?|php)\b|\b(?:field|src|spm|scene|sku|id)=/i.test(normalized)) {
    return false;
  }

  if (normalized.length < 2 || normalized.length > 64) {
    return false;
  }

  if (!/[a-z\u00c0-\u024f]/i.test(normalized)) {
    return false;
  }

  const digitCount = normalized.replace(/\D/g, "").length;
  return digitCount <= normalized.length / 3;
}

function splitCategoryPath(value: string) {
  return value
    .split(/\s*(?:>|\/|\||›|»|\\)\s*/g)
    .map((segment) => normalizeCategorySegment(segment))
    .filter((segment) => isUsefulCategoryCandidate(segment));
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

  const lightingSignals = /\b(led|lighting|light strip|strip light|lamp|lampe|night light|downlight|floodlight|spotlight|ceiling light|wall light|solar light|led bulb|led panel|neon|applique)\b/i.test(haystack);
  const furnitureSignals = /\b(furniture|meuble|meubles|chair|fauteuil|sofa|cabinet|shelf|bookshelf|wardrobe|dresser|nightstand|desk frame|office desk|gaming desk|gaming chair|table)\b/i.test(haystack);

  const rules: Array<{ slug: string; title: string; path: string[]; patterns: RegExp[] }> = [
    {
      slug: "lighting-led",
      title: "Eclairage LED",
      path: ["Maison & eclairage", "Eclairage LED"],
      patterns: [/\b(led|lighting|light strip|strip light|lamp|lampe|night light|downlight|floodlight|spotlight|ceiling light|wall light|solar light|led bulb|led panel|neon|applique)\b/i],
    },
    {
      slug: "electronic-components",
      title: "Composants electroniques",
      path: ["Electronique", "Composants electroniques"],
      patterns: [/\b(lcd|oled|display|screen|touch screen|module|sensor|pcb|circuit board|motherboard|chip|ic\b|connector|converter|adapter|relay|controller|driver board|power supply)\b/i],
    },
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

  const matchedRule = rules.find((rule) => {
    if (rule.slug === "furniture" && lightingSignals && !furnitureSignals) {
      return false;
    }

    if (rule.slug === "furniture" && /\b(light|lighting|lamp|lampe|led|display|lcd|oled|screen)\b/i.test(haystack)) {
      return false;
    }

    return rule.patterns.some((pattern) => pattern.test(haystack));
  });
  if (!matchedRule) {
    return null;
  }

  return {
    slug: matchedRule.slug,
    title: matchedRule.title,
    path: matchedRule.path,
  };
}

function extractExplicitCategoryCandidates(input: {
  rawPayload?: unknown;
  categoryTitle?: string;
  categoryPath?: string[];
}) {
  const rawPayloadRecord = isRecord(input.rawPayload) ? input.rawPayload : null;
  const explicitTree = rawPayloadRecord?.alibaba_category_tree;
  const explicitTreeRecord = isRecord(explicitTree) ? explicitTree : null;

  const explicitTitleCandidates = dedupeStrings([
    input.categoryTitle ?? "",
    typeof explicitTreeRecord?.title === "string" ? explicitTreeRecord.title : "",
    typeof explicitTreeRecord?.leafCategory === "string" ? explicitTreeRecord.leafCategory : "",
  ])
    .map((candidate) => normalizeCategorySegment(candidate))
    .filter((candidate) => isUsefulCategoryCandidate(candidate));

  const explicitPathCandidates = [
    ...(Array.isArray(input.categoryPath) ? [input.categoryPath] : []),
    ...(Array.isArray(explicitTreeRecord?.path) ? [explicitTreeRecord.path] : []),
  ]
    .map((path) => path
      .map((segment) => (typeof segment === "string" ? normalizeCategorySegment(segment) : ""))
      .filter((segment) => isUsefulCategoryCandidate(segment)))
    .filter((path) => path.length > 0);

  return {
    explicitTitleCandidates,
    explicitPathCandidates,
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
  const { explicitTitleCandidates, explicitPathCandidates } = extractExplicitCategoryCandidates(input);

  const explicitPath = explicitPathCandidates.find((path) => path.length > 0) ?? [];
  const explicitLeafTitle = explicitPath[explicitPath.length - 1] ?? explicitTitleCandidates[0];

  if (explicitLeafTitle) {
    return {
      slug: slugifyCategoryLabel(explicitLeafTitle),
      title: explicitLeafTitle,
      path: explicitPath.length > 0 ? explicitPath : [explicitLeafTitle],
    };
  }

  const inferredCategory = inferAlibabaCategoryFromContent(input);

  if (inferredCategory) {
    return {
      slug: inferredCategory.slug,
      title: inferredCategory.title,
      path: inferredCategory.path,
    };
  }

  const rawCandidates = dedupeStrings(collectCategoryStrings(input.rawPayload))
    .filter((candidate) => isUsefulCategoryCandidate(candidate));

  const pathCandidates = rawCandidates
    .map((candidate) => splitCategoryPath(candidate))
    .filter((segments) => segments.length > 0);

  const bestPath = pathCandidates.find((segments) => segments.length > 1)
    ?? pathCandidates[0]
    ?? [];

  const leafCategory = bestPath[bestPath.length - 1]
    ?? (isUsefulCategoryCandidate(input.query) ? normalizeCategorySegment(input.query ?? "") : undefined)
    ?? (isUsefulCategoryCandidate(input.keywords?.[0]) ? normalizeCategorySegment(input.keywords?.[0] ?? "") : undefined)
    ?? (isUsefulCategoryCandidate(input.title) ? normalizeCategorySegment(input.title ?? "") : undefined)
    ?? "Catalogue importe";

  const title = isUsefulCategoryCandidate(leafCategory) ? leafCategory : "Autres produits";

  return {
    slug: slugifyCategoryLabel(title),
    title,
    path: bestPath.length > 0 ? bestPath : [title],
  };
}

function collectFreightPriceCandidates(value: unknown, depth = 0, keyHint = ""): number[] {
  if (depth > 5 || value == null) {
    return [];
  }

  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return /(freight|shipping|delivery|logistics|local|domestic|inland|express|fee|cost|amount|price)/i.test(keyHint)
      && !/(template|weight|days|time|id|sku|code)/i.test(keyHint)
      ? [value]
      : [];
  }

  if (typeof value === "string") {
    if (!/(usd|\$|freight|shipping|delivery|logistics|local|domestic|inland|express)/i.test(`${keyHint} ${value}`)) {
      return [];
    }

    const matches = value.match(/\d+(?:[.,]\d+)?/g) ?? [];
    return matches
      .map((match) => Number(match.replace(",", ".")))
      .filter((candidate) => Number.isFinite(candidate) && candidate > 0);
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectFreightPriceCandidates(entry, depth + 1, keyHint));
  }

  if (typeof value !== "object") {
    return [];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([nestedKey, nestedValue]) => {
    const normalizedKey = nestedKey.toLowerCase();
    const nextHint = `${keyHint} ${normalizedKey}`.trim();

    if (/(template|weight|days|time|sku|code|number)/i.test(normalizedKey) && !/(fee|cost|price|amount)/i.test(normalizedKey)) {
      return [];
    }

    return collectFreightPriceCandidates(nestedValue, depth + 1, nextHint);
  });
}

function extractChinaLocalFreightInfo(item: AlibabaImportedProduct) {
  const candidates = collectFreightPriceCandidates(item.rawPayload);
  const labelCandidate = [item.shippingLabel, item.customizationLabel, ...(item.overview ?? [])]
    .find((value) => typeof value === "string" && /(freight|shipping|delivery|domestic|local|express|truck|logistics)/i.test(value));

  if (candidates.length === 0) {
    return {
      chinaLocalFreightFcfa: undefined,
      chinaLocalFreightLabel: labelCandidate,
    };
  }

  const usdAmount = Math.min(...candidates);
  return {
    chinaLocalFreightFcfa: convertUsdToFcfa(usdAmount),
    chinaLocalFreightLabel: labelCandidate || `Fret local Chine ${usdAmount.toFixed(2)} USD`,
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
  const variantPricing = extractAlibabaVariantPricing(item.rawPayload);
  const variantSkus = extractAlibabaVariantSkus(item.rawPayload);
  const moqInfo = resolveAlibabaMoq({
    rawValue: [rawPayloadRecord, item.soldLabel, item.overview],
    tiers: item.tiers,
    variantPricing,
    fallback: item.moq,
  });
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
  const localFreight = extractChinaLocalFreightInfo(item);

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
    moqVerified: moqInfo.verified || item.moqVerified === true,
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
    chinaLocalFreightFcfa: localFreight.chinaLocalFreightFcfa,
    chinaLocalFreightLabel: localFreight.chinaLocalFreightLabel,
    overview: item.overview,
    variantGroups: resolvedVariantGroups,
    variantPricing,
    variantSkus,
    tiers: item.tiers,
    specs: item.specs,
  };
}
