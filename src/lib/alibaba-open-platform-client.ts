import { createHmac } from "node:crypto";

import {
  ALIBABA_DEFAULT_API_BASE_URL,
  ALIBABA_DEFAULT_AUTHORIZE_URL,
  ALIBABA_DEFAULT_REFRESH_URL,
  ALIBABA_DEFAULT_TOKEN_URL,
  type AlibabaFulfillmentChannel,
  type AlibabaSupplierAccount,
} from "@/lib/alibaba-operations";
import { getInternalSupplierFulfillment } from "@/lib/internal-fulfillment";
import type { SourcingOrder, AlibabaCatalogMapping } from "@/lib/alibaba-sourcing";
import type { ProductCatalogItem } from "@/lib/products-data";
import { getAlibabaSupplierAccounts, saveAlibabaSupplierAccount } from "@/lib/alibaba-operations-store";
import { createAlibabaIntegrationLog } from "@/lib/sourcing-store";

type AlibabaCredentials = {
  accountId?: string;
  appKey: string;
  appSecret: string;
  accessToken?: string;
  refreshToken?: string;
  apiBaseUrl: string;
  authorizeUrl: string;
  tokenUrl: string;
  refreshUrl: string;
};

export type AlibabaSearchProduct = ProductCatalogItem & {
  sourceProductId: string;
  supplierCompanyId?: string;
  rawPayload: unknown;
  moqVerified?: boolean;
  weightVerified?: boolean;
  priceVerified?: boolean;
};

type AlibabaCallResult = {
  ok: boolean;
  endpoint: string;
  requestBody: Record<string, unknown>;
  responseBody: unknown;
  status: number;
};

type AlibabaProductSearchResult = {
  ok: boolean;
  endpoint: string;
  responseBody: unknown;
  products: AlibabaSearchProduct[];
  errorMessage?: string;
  errorCode?: string;
  skipped?: boolean;
};

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "").replace(/\/rest$/, "");
}

function getAccountCredentials(account?: AlibabaSupplierAccount | null): AlibabaCredentials | null {
  if (!account?.appKey || !account?.appSecret) {
    return null;
  }

  return {
    accountId: account.id,
    appKey: account.appKey,
    appSecret: account.appSecret,
    accessToken: account.accessToken,
    refreshToken: account.refreshToken,
    apiBaseUrl: normalizeBaseUrl(account.apiBaseUrl || ALIBABA_DEFAULT_API_BASE_URL),
    authorizeUrl: account.authorizeUrl || ALIBABA_DEFAULT_AUTHORIZE_URL,
    tokenUrl: account.tokenUrl || ALIBABA_DEFAULT_TOKEN_URL,
    refreshUrl: account.refreshUrl || ALIBABA_DEFAULT_REFRESH_URL,
  };
}

function getEnvCredentials(): AlibabaCredentials | null {
  const appKey = process.env.ALIBABA_OPEN_PLATFORM_APP_KEY;
  const appSecret = process.env.ALIBABA_OPEN_PLATFORM_APP_SECRET;

  if (!appKey || !appSecret) {
    return null;
  }

  return {
    appKey,
    appSecret,
    accessToken: process.env.ALIBABA_OPEN_PLATFORM_ACCESS_TOKEN,
    apiBaseUrl: normalizeBaseUrl(process.env.ALIBABA_OPEN_PLATFORM_API_BASE_URL ?? ALIBABA_DEFAULT_API_BASE_URL),
    authorizeUrl: process.env.ALIBABA_OAUTH_AUTHORIZE_URL ?? ALIBABA_DEFAULT_AUTHORIZE_URL,
    tokenUrl: process.env.ALIBABA_OAUTH_TOKEN_URL ?? ALIBABA_DEFAULT_TOKEN_URL,
    refreshUrl: process.env.ALIBABA_OAUTH_REFRESH_URL ?? ALIBABA_DEFAULT_REFRESH_URL,
  };
}

async function resolveAlibabaCredentials() {
  const accounts = await getAlibabaSupplierAccounts();
  const eligible = accounts.filter((account) => account.status !== "disabled" && account.appKey && account.appSecret);
  const preferredAccount = eligible.find((account) => account.isActive && account.status === "connected")
    ?? eligible.find((account) => account.status === "connected")
    ?? eligible.find((account) => account.isActive)
    ?? eligible[0]
    ?? null;
  return getAccountCredentials(preferredAccount) ?? getEnvCredentials();
}

function isTokenExpiringSoon(expiresAt?: string, thresholdMs = 2 * 60 * 1000) {
  if (!expiresAt) {
    return false;
  }

  const expiresAtMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs)) {
    return false;
  }

  return expiresAtMs - Date.now() <= thresholdMs;
}

function serializeValue(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function signAlibabaRequest(pathname: string, params: URLSearchParams, secret: string) {
  const sortedEntries = [...params.entries()].filter(([key]) => key !== "sign").sort(([left], [right]) => left.localeCompare(right));
  const baseString = pathname + sortedEntries.map(([key, value]) => `${key}${value}`).join("");

  return createHmac("sha256", secret).update(baseString, "utf8").digest("hex").toUpperCase();
}

function resolveEndpoint(input: { pathOrUrl: string; apiBaseUrl: string }) {
  if (input.pathOrUrl.startsWith("http://") || input.pathOrUrl.startsWith("https://")) {
    const url = new URL(input.pathOrUrl);
    const apiPath = url.pathname.startsWith("/rest/") ? url.pathname.slice(5) : url.pathname;
    return {
      requestUrl: `${url.origin}${url.pathname}`,
      apiPath: apiPath.startsWith("/") ? apiPath : `/${apiPath}`,
    };
  }

  const apiPath = input.pathOrUrl.startsWith("/") ? input.pathOrUrl : `/${input.pathOrUrl}`;
  return {
    requestUrl: `${normalizeBaseUrl(input.apiBaseUrl)}/rest${apiPath}`,
    apiPath,
  };
}

function getStringValue(candidate: unknown): string | undefined {
  if (typeof candidate === "string") {
    const trimmed = candidate.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    return String(candidate);
  }

  return undefined;
}

function getNumberValue(...candidates: unknown[]) {
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }

    if (typeof candidate === "string") {
      const matches = candidate.match(/\d+(?:[.,]\d+)?/g) ?? [];
      for (const match of matches) {
        const normalized = Number(match.replace(',', '.'));
        if (Number.isFinite(normalized) && normalized > 0) {
          return normalized;
        }
      }
    }
  }

  return undefined;
}

function getPriceBounds(...candidates: unknown[]) {
  const values: number[] = [];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
      values.push(candidate);
      continue;
    }

    if (typeof candidate !== "string") {
      continue;
    }

    const matches = candidate.match(/\d+(?:[.,]\d+)?/g) ?? [];
    for (const match of matches) {
      const normalized = Number(match.replace(',', '.'));
      if (Number.isFinite(normalized) && normalized > 0) {
        values.push(normalized);
      }
    }
  }

  if (values.length === 0) {
    return { min: undefined, max: undefined };
  }

  return {
    min: Math.min(...values),
    max: values.length > 1 ? Math.max(...values) : undefined,
  };
}

function extractVerifiedMoq(value: unknown, depth = 0, keyHint?: string): number | undefined {
  if (depth > 5 || value == null) {
    return undefined;
  }

  if (typeof value === "number" && Number.isFinite(value) && /moq|min[_ -]?order|begin_amount|quantity_min/i.test(keyHint ?? "")) {
    return Math.max(1, Math.round(value));
  }

  if (typeof value === "string") {
    if (/moq|min[_ -]?order|begin_amount|quantity_min/i.test(keyHint ?? "")) {
      const numeric = Number((value.match(/\d+(?:[.,]\d+)?/)?.[0] ?? "").replace(',', '.'));
      if (Number.isFinite(numeric) && numeric > 0) {
        return Math.max(1, Math.round(numeric));
      }
    }

    return undefined;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = extractVerifiedMoq(entry, depth + 1, keyHint);
      if (typeof nested === "number" && nested > 0) {
        return nested;
      }
    }

    return undefined;
  }

  if (typeof value !== "object") {
    return undefined;
  }

  for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    const nested = extractVerifiedMoq(nestedValue, depth + 1, nestedKey);
    if (typeof nested === "number" && nested > 0) {
      return nested;
    }
  }

  return undefined;
}

function hasCoherentPrice(bounds: { min?: number; max?: number }) {
  if (typeof bounds.min !== "number" || !Number.isFinite(bounds.min) || bounds.min <= 0) {
    return false;
  }

  if (typeof bounds.max === "number") {
    return Number.isFinite(bounds.max) && bounds.max >= bounds.min;
  }

  return true;
}

function isWeightKeyHint(keyHint?: string) {
  return Boolean(keyHint && /(weight|gross_weight|net_weight|package_weight|shipping_weight|item_weight|weight_grams|weightgrams|gram|grams|kg|kilogram)/i.test(keyHint));
}

function parseWeightToGrams(value: unknown, keyHint?: string) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (keyHint && /gram|grams|weight_grams|weightgrams/i.test(keyHint)) {
      return Math.round(value);
    }

    if (keyHint && /kg|kilogram/i.test(keyHint)) {
      return Math.round(value * 1000);
    }

    if (isWeightKeyHint(keyHint) && value > 0) {
      return Math.round(value < 10 ? value * 1000 : value);
    }

    return undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  const kilogramMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilogram)/i);
  if (kilogramMatch) {
    return Math.round(Number(kilogramMatch[1].replace(',', '.')) * 1000);
  }

  const gramMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(g|gram)/i);
  if (gramMatch && !/2\.4g|5g|4g/i.test(normalized)) {
    return Math.round(Number(gramMatch[1].replace(',', '.')));
  }

  if (isWeightKeyHint(keyHint)) {
    const numeric = Number(normalized.replace(/[^0-9.,-]/g, '').replace(',', '.'));
    if (Number.isFinite(numeric) && numeric > 0) {
      return Math.round(numeric < 10 ? numeric * 1000 : numeric);
    }
  }

  return undefined;
}

function extractWeightGrams(value: unknown, depth = 0, keyHint?: string): number | undefined {
  if (depth > 5 || value == null) {
    return undefined;
  }

  const direct = parseWeightToGrams(value, keyHint);
  if (typeof direct === "number" && direct > 0) {
    return direct;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const candidate = extractWeightGrams(entry, depth + 1, keyHint);
      if (typeof candidate === "number" && candidate > 0) {
        return candidate;
      }
    }
    return undefined;
  }

  if (typeof value !== "object") {
    return undefined;
  }

  for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    const candidate = extractWeightGrams(nestedValue, depth + 1, nestedKey);
    if (typeof candidate === "number" && candidate > 0) {
      return candidate;
    }
  }

  return undefined;
}

function collectStrings(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    return value.trim() ? [value.trim()] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectStrings(entry));
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((entry) => collectStrings(entry));
  }

  return [];
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeAlibabaImageUrl(value: string) {
  const normalized = value.startsWith("//") ? `https:${value}` : value;
  return normalized.replace(/(\.(?:jpg|jpeg|png|webp))_\d+x\d+\1$/i, "$1");
}

function extractImagesFromAlibabaRecord(raw: Record<string, unknown>) {
  const basicInfo = (raw.basic_info && typeof raw.basic_info === "object") ? raw.basic_info as Record<string, unknown> : {};
  const tradeInfo = (raw.trade_info && typeof raw.trade_info === "object") ? raw.trade_info as Record<string, unknown> : {};
  const rawImage = (raw.image && typeof raw.image === "object") ? raw.image as Record<string, unknown> : {};
  const skuInfo = Array.isArray(raw.sku_info)
    ? raw.sku_info as Array<Record<string, unknown>>
    : Array.isArray(tradeInfo.sku_info)
      ? tradeInfo.sku_info as Array<Record<string, unknown>>
      : [];

  return uniqueStrings([
    ...collectStrings(raw.main_image_url),
    ...collectStrings(raw.image_url),
    ...collectStrings(raw.display_big_image_url),
    ...collectStrings(raw.product_main_image_url),
    ...collectStrings(raw.productMainImageUrl),
    ...collectStrings(raw.mainImage),
    ...collectStrings(raw.mainImageUrl),
    ...collectStrings(raw.imageUrl),
    ...collectStrings(raw.imageUrls),
    ...collectStrings(raw.image_url_list),
    ...collectStrings(raw.imageUrlList),
    ...collectStrings(raw.images),
    ...collectStrings(raw.image),
    ...collectStrings(raw.product_image),
    ...collectStrings(raw.productImage),
    ...collectStrings(raw.gallery),
    ...collectStrings(rawImage.main_image),
    ...collectStrings(rawImage.multi_image),
    ...collectStrings(basicInfo.product_images),
    ...collectStrings(basicInfo.product_image),
    ...collectStrings(raw.product_images),
    ...collectStrings(raw.product_image),
    ...skuInfo.flatMap((sku) => collectStrings(sku.sale_attributes)),
  ]).filter((entry) => entry.startsWith("http") || entry.startsWith("/")).map(normalizeAlibabaImageUrl);
}

function extractAlibabaProductDetailRecord(response: Record<string, unknown> | null) {
  const result = response?.result && typeof response.result === "object" ? response.result as Record<string, unknown> : null;
  const data = response?.data && typeof response.data === "object" ? response.data as Record<string, unknown> : null;
  const resultData = result?.data && typeof result.data === "object" ? result.data as Record<string, unknown> : null;
  const candidates = [response?.product_info, result?.product_info, data?.product_info, resultData?.product_info, response?.productInfo, result?.productInfo];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      return candidate as Record<string, unknown>;
    }
  }

  return null;
}

async function fetchAlibabaProductDetail(sourceProductId: string, credentials?: AlibabaCredentials | null) {
  const resolvedCredentials = credentials ?? await resolveAlibabaCredentialsForLiveCall();
  if (!resolvedCredentials) {
    return null;
  }

  const result = await callAlibabaEndpoint("/alibaba/icbu/product/get/v2", {
    product_id: sourceProductId,
  }, {
    credentials: resolvedCredentials,
    method: "GET",
  });

  const response = result.responseBody as Record<string, unknown> | null;
  if (!result.ok || (response && response.success != null && !isTruthyAlibabaFlag(response.success))) {
    return null;
  }

  return extractAlibabaProductDetailRecord(response);
}

export async function fetchAlibabaProductSnapshot(input: {
  sourceProductId: string;
  query?: string;
}): Promise<AlibabaSearchProduct | null> {
  const query = input.query?.trim() || input.sourceProductId;
  const detailRecord = await fetchAlibabaProductDetail(input.sourceProductId);

  if (!detailRecord) {
    return null;
  }

  const mapped = mapAlibabaIcbuProductToProduct(detailRecord, query)
    ?? mapAlibabaSearchResultToProduct(detailRecord, query);

  if (!mapped) {
    return null;
  }

  return enrichAlibabaSearchProduct(mapped, detailRecord);
}

function enrichAlibabaSearchProduct(product: AlibabaSearchProduct, detailRecord: Record<string, unknown> | null): AlibabaSearchProduct {
  if (!detailRecord) {
    return product;
  }

  const tradeInfo = (detailRecord.trade_info && typeof detailRecord.trade_info === "object") ? detailRecord.trade_info as Record<string, unknown> : {};
  const logisticsInfo = (detailRecord.logistics_info && typeof detailRecord.logistics_info === "object") ? detailRecord.logistics_info as Record<string, unknown> : {};
  const priceBounds = getPriceBounds(
    detailRecord.price,
    detailRecord.min_price,
    detailRecord.max_price,
    (tradeInfo.price as { range_price?: { min_price?: unknown; max_price?: unknown } } | undefined)?.range_price?.min_price,
    (tradeInfo.price as { range_price?: { min_price?: unknown; max_price?: unknown } } | undefined)?.range_price?.max_price,
    (tradeInfo.price as { tiered_price?: Array<{ price?: unknown }> } | undefined)?.tiered_price?.[0]?.price,
  );
  const verifiedMoq = extractVerifiedMoq(detailRecord) ?? extractVerifiedMoq(tradeInfo);
  const moq = verifiedMoq ?? product.moq;
  const weightFromLogistics = getNumberValue(logisticsInfo.weight);
  const weightGrams = extractWeightGrams(detailRecord) ?? (weightFromLogistics ? Math.round(weightFromLogistics * (weightFromLogistics < 10 ? 1000 : 1)) : undefined);
  const images = extractImagesFromAlibabaRecord(detailRecord);
  const mergedPayload = product.rawPayload && typeof product.rawPayload === "object" && !Array.isArray(product.rawPayload)
    ? { ...(product.rawPayload as Record<string, unknown>), detail: detailRecord }
    : { search: product.rawPayload, detail: detailRecord };

  return {
    ...product,
    image: images[0] ?? product.image,
    gallery: images.length > 0 ? images : product.gallery,
    videoUrl: getStringValue(detailRecord.video_url) ?? getStringValue(detailRecord.videoUrl) ?? product.videoUrl,
    videoPoster: images[0] ?? product.videoPoster,
    itemWeightGrams: weightGrams ?? product.itemWeightGrams,
    minUsd: priceBounds.min ?? product.minUsd,
    maxUsd: priceBounds.max ?? product.maxUsd,
    moq,
    moqVerified: typeof verifiedMoq === "number" && verifiedMoq > 0,
    weightVerified: typeof weightGrams === "number" && weightGrams > 0,
    priceVerified: hasCoherentPrice(priceBounds),
    rawPayload: mergedPayload,
  };
}

async function enrichAlibabaSearchProducts(products: AlibabaSearchProduct[], credentials?: AlibabaCredentials | null) {
  const resolvedCredentials = credentials ?? await resolveAlibabaCredentialsForLiveCall();
  if (!resolvedCredentials || products.length === 0) {
    return products;
  }

  return Promise.all(products.map(async (product) => {
    try {
      const detailRecord = await fetchAlibabaProductDetail(product.sourceProductId, resolvedCredentials);
      return enrichAlibabaSearchProduct(product, detailRecord);
    } catch {
      return product;
    }
  }));
}

function isTruthyAlibabaFlag(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1";
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return false;
}

function isLikelyAlibabaProductIdentifier(query: string) {
  const normalized = query.trim();

  if (normalized.length < 2 || normalized.length > 80) {
    return false;
  }

  if (/\s/.test(normalized)) {
    return false;
  }

  if (!/^[A-Za-z0-9._\-/]+$/.test(normalized)) {
    return false;
  }

  const hasDigit = /\d/.test(normalized);
  const hasSeparator = /[._\-/]/.test(normalized);
  const hasUppercase = /[A-Z]/.test(normalized);

  return hasDigit || hasSeparator || hasUppercase;
}

function isRecoverableIcbuSearchResponse(result: AlibabaCallResult, response: Record<string, unknown> | null) {
  const msgCode = getStringValue(response?.msg_code);

  if (result.ok && isTruthyAlibabaFlag(response?.success)) {
    return true;
  }

  return msgCode === "B_PRODUCT_NOT_FOUND" || msgCode === "B_PRODUCT_PARAM_INVALID";
}

function extractAlibabaResponseMessage(response: Record<string, unknown> | null) {
  const nestedResult = response?.result && typeof response.result === "object" ? response.result as Record<string, unknown> : null;

  return getStringValue(response?.message)
    ?? getStringValue(response?.error_message)
    ?? getStringValue(response?.msg)
    ?? getStringValue(response?.sub_msg)
    ?? getStringValue(nestedResult?.message)
    ?? getStringValue(nestedResult?.result_msg);
}

function extractAlibabaResponseCode(response: Record<string, unknown> | null) {
  const nestedResult = response?.result && typeof response.result === "object" ? response.result as Record<string, unknown> : null;

  return getStringValue(response?.code)
    ?? getStringValue(response?.error_code)
    ?? getStringValue(response?.sub_code)
    ?? getStringValue(nestedResult?.code)
    ?? getStringValue(nestedResult?.result_code);
}

function isMissingAlibabaAppKeyMessage(message?: string) {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return normalized.includes("app_key") && normalized.includes("mandatory");
}

function collectCandidateRecords(value: unknown, depth = 0): Array<Record<string, unknown>> {
  if (depth > 4 || value == null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectCandidateRecords(entry, depth + 1));
  }

  if (typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  const directProductId = getStringValue(record.product_id)
    ?? getStringValue(record.productId)
    ?? getStringValue(record.offer_id)
    ?? getStringValue(record.offerId)
    ?? getStringValue(record.item_id)
    ?? getStringValue(record.itemId);
  const directTitle = getStringValue(record.subject)
    ?? getStringValue(record.title)
    ?? getStringValue(record.product_title)
    ?? getStringValue(record.productTitle)
    ?? getStringValue(record.name);

  if (directProductId || directTitle) {
    return [record];
  }

  return [
    ...collectCandidateRecords(record.products, depth + 1),
    ...collectCandidateRecords(record.productList, depth + 1),
    ...collectCandidateRecords(record.product_list, depth + 1),
    ...collectCandidateRecords(record.items, depth + 1),
    ...collectCandidateRecords(record.itemList, depth + 1),
    ...collectCandidateRecords(record.item_list, depth + 1),
    ...collectCandidateRecords(record.offers, depth + 1),
    ...collectCandidateRecords(record.offerList, depth + 1),
    ...collectCandidateRecords(record.offer_list, depth + 1),
    ...collectCandidateRecords(record.result, depth + 1),
    ...collectCandidateRecords(record.resultList, depth + 1),
    ...collectCandidateRecords(record.result_list, depth + 1),
    ...collectCandidateRecords(record.data, depth + 1),
    ...collectCandidateRecords(record.result_data, depth + 1),
    ...collectCandidateRecords(record.resultData, depth + 1),
    ...collectCandidateRecords(record.value, depth + 1),
  ];
}

function mapAlibabaSearchResultToProduct(raw: Record<string, unknown>, query: string): AlibabaSearchProduct | null {
  const sourceProductId = getStringValue(raw.product_id)
    ?? getStringValue(raw.productId)
    ?? getStringValue(raw.offer_id)
    ?? getStringValue(raw.offerId)
    ?? getStringValue(raw.item_id)
    ?? getStringValue(raw.itemId);

  const title = getStringValue(raw.subject)
    ?? getStringValue(raw.title)
    ?? getStringValue(raw.product_title)
    ?? getStringValue(raw.productTitle)
    ?? getStringValue(raw.display_subject)
    ?? getStringValue(raw.displaySubject)
    ?? getStringValue(raw.name);

  const images = extractImagesFromAlibabaRecord(raw);

  if (!sourceProductId || !title || images.length === 0) {
    return null;
  }

  const priceBounds = getPriceBounds(
    raw.min_price,
    raw.minPrice,
    raw.price,
    raw.sale_price,
    raw.max_price,
    raw.maxPrice,
    (raw.priceRange as { min?: unknown } | undefined)?.min,
    (raw.priceRange as { max?: unknown } | undefined)?.max,
    (raw.price_range as { min?: unknown } | undefined)?.min,
    (raw.price_range as { max?: unknown } | undefined)?.max,
  );
  const minUsd = priceBounds.min ?? 1;
  const maxUsd = priceBounds.max;
  const verifiedMoq = extractVerifiedMoq(raw);
  const moq = verifiedMoq ?? 1;
  const unit = getStringValue(raw.unit) ?? getStringValue(raw.unit_name) ?? "piece";
  const supplierName = getStringValue(raw.company_name)
    ?? getStringValue(raw.supplier_name)
    ?? getStringValue(raw.seller_name)
    ?? getStringValue(raw.company)
    ?? "Fournisseur Alibaba";
  const supplierLocation = getStringValue(raw.country)
    ?? getStringValue(raw.country_code)
    ?? getStringValue(raw.supplier_country)
    ?? "CN";
  const keywords = uniqueStrings(query.split(/[\s,;]+/g).map((entry) => entry.trim().toLowerCase()).filter(Boolean));
  const specs = Array.isArray(raw.attributes)
    ? (raw.attributes as Array<Record<string, unknown>>).slice(0, 8).map((attribute, index) => ({
        label: getStringValue(attribute.attribute_name) ?? getStringValue(attribute.name) ?? `Spec ${index + 1}`,
        value: getStringValue(attribute.attribute_value) ?? getStringValue(attribute.value) ?? "-",
      }))
    : [];
  const overview = uniqueStrings([
    getStringValue(raw.description) ?? "",
    getStringValue(raw.brief) ?? "",
    `Import Alibaba live pour ${title}.`,
    `Recherche source: ${query}.`,
  ]).slice(0, 4);
  const supplierCompanyId = getStringValue(raw.supplier_company_id)
    ?? getStringValue(raw.company_id)
    ?? getStringValue(raw.seller_member_id);
  const weightGrams = extractWeightGrams(raw);

  return {
    sourceProductId,
    slug: sourceProductId,
    title,
    shortTitle: title.length > 72 ? `${title.slice(0, 69)}...` : title,
    keywords,
    image: images[0],
    gallery: images,
    videoUrl: getStringValue(raw.video_url) ?? getStringValue(raw.videoUrl),
    videoPoster: images[0],
    packaging: getStringValue(raw.packaging) ?? "Carton export standard",
    itemWeightGrams: weightGrams ?? 0,
    lotCbm: getStringValue(raw.cbm) ?? "0.01",
    minUsd,
    maxUsd,
    moq,
    unit,
    badge: "Alibaba Import",
    supplierName,
    supplierLocation,
    supplierCompanyId,
    responseTime: getStringValue(raw.response_time) ?? "Sous 24 h",
    yearsInBusiness: Math.round(getNumberValue(raw.years_in_business, raw.yearsInBusiness) ?? 1),
    transactionsLabel: getStringValue(raw.transactions_label) ?? "Alibaba live",
    soldLabel: getStringValue(raw.sold_label) ?? `MOQ ${moq} ${unit}`,
    customizationLabel: getStringValue(raw.customization_label) ?? "Selon fiche fournisseur",
    shippingLabel: getStringValue(raw.shipping_label) ?? "Transport a configurer",
    overview,
    variantGroups: [],
    tiers: [{ quantityLabel: `${moq}+`, priceUsd: minUsd }],
    specs,
    moqVerified: typeof verifiedMoq === "number" && verifiedMoq > 0,
    weightVerified: typeof weightGrams === "number" && weightGrams > 0,
    priceVerified: hasCoherentPrice(priceBounds),
    rawPayload: raw,
  };
}

function mapAlibabaIcbuProductToProduct(raw: Record<string, unknown>, query: string): AlibabaSearchProduct | null {
  const basicInfo = (raw.basic_info && typeof raw.basic_info === "object") ? raw.basic_info as Record<string, unknown> : {};
  const categoryInfo = (raw.category_info && typeof raw.category_info === "object") ? raw.category_info as Record<string, unknown> : {};
  const tradeInfo = (raw.trade_info && typeof raw.trade_info === "object") ? raw.trade_info as Record<string, unknown> : {};
  const logisticsInfo = (raw.logistics_info && typeof raw.logistics_info === "object") ? raw.logistics_info as Record<string, unknown> : {};
  const skuInfo = Array.isArray(raw.sku_info)
    ? raw.sku_info as Array<Record<string, unknown>>
    : Array.isArray(tradeInfo.sku_info)
      ? tradeInfo.sku_info as Array<Record<string, unknown>>
      : [];

  const sourceProductId = getStringValue(basicInfo.product_id) ?? getStringValue(raw.product_id);
  const title = getStringValue(basicInfo.title) ?? getStringValue(raw.title);
  const images = extractImagesFromAlibabaRecord(raw);

  if (!sourceProductId || !title || images.length === 0) {
    return null;
  }

  const categoryAttributes = Array.isArray(categoryInfo.attributes)
    ? categoryInfo.attributes as Array<Record<string, unknown>>
    : [];
  const priceBounds = getPriceBounds(
    (tradeInfo.price as { range_price?: { min_price?: unknown } } | undefined)?.range_price?.min_price,
    (tradeInfo.price as { range_price?: { max_price?: unknown } } | undefined)?.range_price?.max_price,
    (tradeInfo.price as { tiered_price?: Array<{ price?: unknown }> } | undefined)?.tiered_price?.[0]?.price,
    skuInfo[0] && typeof skuInfo[0].sku_price === "object" ? (skuInfo[0].sku_price as { price?: unknown }).price : undefined,
  );
  const minUsd = priceBounds.min ?? 1;
  const maxUsd = priceBounds.max;
  const verifiedMoq = extractVerifiedMoq(raw) ?? extractVerifiedMoq(tradeInfo);
  const moq = verifiedMoq ?? 1;
  const weight = getNumberValue(logisticsInfo.weight);
  const keywords = uniqueStrings([
    ...collectStrings(basicInfo.keywords),
    getStringValue(basicInfo.model_number) ?? "",
    ...skuInfo.map((sku) => getStringValue(sku.sku_code) ?? ""),
    ...query.split(/[\s,;]+/g).map((entry) => entry.trim().toLowerCase()),
  ]).filter(Boolean);
  const specs = categoryAttributes.slice(0, 8).map((attribute, index) => ({
    label: getStringValue(attribute.attribute_name) ?? `Spec ${index + 1}`,
    value: getStringValue(attribute.attribute_value) ?? "-",
  }));
  const overview = uniqueStrings([
    getStringValue(basicInfo.description) ?? "",
    getStringValue(categoryInfo.category_name) ? `Categorie Alibaba: ${getStringValue(categoryInfo.category_name)}` : "",
    getStringValue(basicInfo.model_number) ? `Modele: ${getStringValue(basicInfo.model_number)}` : "",
    `Import Alibaba ICBU pour ${title}.`,
  ]).slice(0, 4);
  const weightGrams = extractWeightGrams(raw);
  const verifiedWeightGrams = weightGrams ?? (weight ? Math.round(weight * (weight < 10 ? 1000 : 1)) : undefined);

  return {
    sourceProductId,
    slug: sourceProductId,
    title,
    shortTitle: title.length > 72 ? `${title.slice(0, 69)}...` : title,
    keywords,
    image: images[0],
    gallery: images,
    videoUrl: undefined,
    videoPoster: images[0],
    packaging: "Carton export standard",
    itemWeightGrams: verifiedWeightGrams ?? 0,
    lotCbm: getStringValue(logisticsInfo.desi) ?? "0.01",
    minUsd,
    maxUsd,
    moq,
    unit: getStringValue(tradeInfo.unit) ?? "piece",
    badge: "Alibaba ICBU",
    supplierName: "Catalogue vendeur Alibaba",
    supplierLocation: getStringValue(basicInfo.language) ?? "en_US",
    supplierCompanyId: getStringValue(basicInfo.owner_ali_id),
    responseTime: "Catalogue deja liste",
    yearsInBusiness: 1,
    transactionsLabel: getStringValue(basicInfo.status) ?? "Alibaba listing",
    soldLabel: getStringValue(skuInfo[0]?.sku_code) ?? `MOQ ${moq}`,
    customizationLabel: getStringValue(basicInfo.audit_status) ?? "Selon fiche fournisseur",
    shippingLabel: getStringValue(logisticsInfo.shipping_template_id) ? `Template ${getStringValue(logisticsInfo.shipping_template_id)}` : "Transport a configurer",
    overview,
    variantGroups: [],
    tiers: [{ quantityLabel: `${moq}+`, priceUsd: minUsd }],
    specs,
    moqVerified: typeof verifiedMoq === "number" && verifiedMoq > 0,
    weightVerified: typeof verifiedWeightGrams === "number" && verifiedWeightGrams > 0,
    priceVerified: hasCoherentPrice(priceBounds),
    rawPayload: raw,
  };
}

async function searchAlibabaIcbuProducts(input: {
  query: string;
  limit: number;
}): Promise<AlibabaProductSearchResult> {
  const normalizedQuery = input.query.trim();

  if (!isLikelyAlibabaProductIdentifier(normalizedQuery)) {
    return {
      ok: true,
      endpoint: "/alibaba/icbu/product/search/v2",
      responseBody: null,
      products: [] as AlibabaSearchProduct[],
      skipped: true,
    };
  }

  const credentials = await resolveAlibabaCredentialsForLiveCall();
  const attempts: Array<"sku_code" | "model_number"> = ["sku_code", "model_number"];
  const collectedProducts: AlibabaSearchProduct[] = [];
  const seenProductIds = new Set<string>();
  const responseBodies: unknown[] = [];
  let lastMessage: string | undefined;
  let lastErrorCode: string | undefined;

  for (const field of attempts) {
    const pageSize = Math.min(Math.max(input.limit, 1), 20);
    const pageCount = Math.max(1, Math.ceil(Math.min(Math.max(input.limit, 1), 100) / pageSize));

    for (let pageIndex = 1; pageIndex <= pageCount && collectedProducts.length < input.limit; pageIndex += 1) {
      const result = await callAlibabaEndpoint("/alibaba/icbu/product/search/v2", {
        page_index: pageIndex,
        page_size: pageSize,
        [field]: normalizedQuery,
      }, {
        credentials,
        method: "GET",
      });

      const response = result.responseBody as Record<string, unknown> | null;
      responseBodies.push(result.responseBody);
      const productInfo = Array.isArray(response?.product_info)
        ? response.product_info as Array<Record<string, unknown>>
        : [];
      const message = getStringValue(response?.message);
      const msgCode = getStringValue(response?.msg_code);
      lastMessage = message ?? lastMessage;
      lastErrorCode = msgCode ?? lastErrorCode;

      if (!isRecoverableIcbuSearchResponse(result, response)) {
        return {
          ok: false,
          endpoint: "/alibaba/icbu/product/search/v2",
          responseBody: result.responseBody,
          products: [] as AlibabaSearchProduct[],
          errorMessage: message
            ? `La recherche catalogue Alibaba ICBU a echoue: ${message}`
            : "La recherche catalogue Alibaba ICBU a echoue.",
        };
      }

      if (!result.ok || !isTruthyAlibabaFlag(response?.success)) {
        break;
      }

      for (const record of productInfo) {
        const mapped = mapAlibabaIcbuProductToProduct(record, normalizedQuery);
        if (!mapped || seenProductIds.has(mapped.sourceProductId)) {
          continue;
        }

        seenProductIds.add(mapped.sourceProductId);
        collectedProducts.push(mapped);

        if (collectedProducts.length >= input.limit) {
          break;
        }
      }

      const page = (response?.page && typeof response.page === "object") ? response.page as Record<string, unknown> : null;
      const totalPages = Math.max(1, Math.round(getNumberValue(page?.total_page) ?? 1));

      if (productInfo.length < pageSize || pageIndex >= totalPages) {
        break;
      }
    }

    if (collectedProducts.length > 0) {
      break;
    }
  }

  if (collectedProducts.length === 0) {
    return {
      ok: true,
      endpoint: "/alibaba/icbu/product/search/v2",
      responseBody: responseBodies[responseBodies.length - 1] ?? null,
      products: [] as AlibabaSearchProduct[],
      errorMessage: lastMessage,
      errorCode: lastErrorCode,
    };
  }

  return {
    ok: true,
    endpoint: "/alibaba/icbu/product/search/v2",
    responseBody: responseBodies[responseBodies.length - 1] ?? null,
    products: collectedProducts.slice(0, input.limit),
  };
}

async function callAlibabaEndpoint(pathOrUrl: string, payload: Record<string, unknown>, options?: {
  accessToken?: string;
  includeAccessToken?: boolean;
  credentials?: AlibabaCredentials | null;
  method?: "GET" | "POST";
  systemParamsInHeaders?: boolean;
}): Promise<AlibabaCallResult> {
  const credentials = options?.credentials ?? (options?.includeAccessToken === false ? await resolveAlibabaCredentials() : await resolveAlibabaCredentialsForLiveCall());
  if (!credentials) {
    return {
      ok: false,
      endpoint: pathOrUrl,
      requestBody: payload,
      responseBody: { message: "Alibaba credentials are missing" },
      status: 400,
    };
  }

  const endpoint = resolveEndpoint({
    pathOrUrl,
    apiBaseUrl: credentials.apiBaseUrl,
  });

  const params = new URLSearchParams();
  const systemParams = new URLSearchParams();
  systemParams.set("app_key", credentials.appKey);
  systemParams.set("timestamp", String(Date.now()));
  systemParams.set("sign_method", "sha256");
  systemParams.set("simplify", "true");
  if (options?.includeAccessToken !== false && (options?.accessToken ?? credentials.accessToken)) {
    systemParams.set("access_token", options?.accessToken ?? credentials.accessToken ?? "");
  }

  for (const [key, value] of Object.entries(payload)) {
    params.set(key, serializeValue(value));
  }

  const signingParams = new URLSearchParams(systemParams);
  for (const [key, value] of params.entries()) {
    signingParams.set(key, value);
  }

  const sign = signAlibabaRequest(endpoint.apiPath, signingParams, credentials.appSecret);
  const method = options?.method ?? "POST";
  const systemParamsInHeaders = options?.systemParamsInHeaders === true;

  if (!systemParamsInHeaders) {
    for (const [key, value] of systemParams.entries()) {
      params.set(key, value);
    }
    params.set("sign", sign);
  }

  const requestUrl = method === "GET"
    ? `${endpoint.requestUrl}?${params.toString()}`
    : endpoint.requestUrl;

  const response = await fetch(requestUrl, {
    method,
    headers: {
      ...(systemParamsInHeaders ? Object.fromEntries([
        ...systemParams.entries(),
        ["sign", sign],
      ]) : {}),
      ...(method === "POST" ? {
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        } : {}),
    },
    body: method === "POST" ? params.toString() : undefined,
    cache: "no-store",
  });
  const text = await response.text();

  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Keep raw text when the upstream response is not JSON.
  }

  return {
    ok: response.ok,
    endpoint: endpoint.apiPath,
    requestBody: payload,
    responseBody: parsed,
    status: response.status,
  };
}

async function refreshAlibabaAccountTokens(account: AlibabaSupplierAccount) {
  const credentials = getAccountCredentials(account);
  if (!credentials?.refreshToken) {
    throw new Error("Aucun refresh token Alibaba disponible.");
  }

  const result = await callAlibabaEndpoint(account.refreshUrl || credentials.refreshUrl, {
    refresh_token: credentials.refreshToken,
  }, {
    includeAccessToken: false,
    credentials,
  });

  if (!result.ok) {
    throw new Error("Refresh du token Alibaba impossible.");
  }

  const body = result.responseBody as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: string | number;
    refresh_expires_in?: string | number;
    country?: string;
    account_id?: string;
    account?: string;
    user_info?: { loginId?: string; seller_id?: string; user_id?: string };
  };

  const nextAccount: AlibabaSupplierAccount = {
    ...account,
    accessToken: body.access_token ?? account.accessToken,
    refreshToken: body.refresh_token ?? account.refreshToken,
    accessTokenExpiresAt: body.expires_in ? new Date(Date.now() + Number(body.expires_in) * 1000).toISOString() : account.accessTokenExpiresAt,
    refreshTokenExpiresAt: body.refresh_expires_in ? new Date(Date.now() + Number(body.refresh_expires_in) * 1000).toISOString() : account.refreshTokenExpiresAt,
    oauthCountry: body.country ?? account.oauthCountry,
    accountId: body.account_id ?? account.accountId,
    accountLogin: body.account ?? body.user_info?.loginId ?? account.accountLogin,
    accountName: body.user_info?.loginId ?? account.accountName,
    memberId: body.user_info?.seller_id ?? body.user_info?.user_id ?? account.memberId,
    status: "connected",
    lastAuthorizedAt: new Date().toISOString(),
    lastError: undefined,
    accessTokenHint: body.access_token ? `${body.access_token.slice(0, 10)}...` : account.accessTokenHint,
    hasAccessToken: Boolean(body.access_token ?? account.accessToken),
    hasRefreshToken: Boolean(body.refresh_token ?? account.refreshToken),
    updatedAt: new Date().toISOString(),
  };

  await saveAlibabaSupplierAccount(nextAccount);
  return nextAccount;
}

async function resolveAlibabaCredentialsForLiveCall() {
  const accounts = await getAlibabaSupplierAccounts();
  const eligible = accounts.filter((account) => account.status !== "disabled" && account.appKey && account.appSecret);
  const preferredAccount = eligible.find((account) => account.isActive && account.status === "connected")
    ?? eligible.find((account) => account.status === "connected")
    ?? null;

  if (!preferredAccount) {
    return getEnvCredentials();
  }

  if ((!preferredAccount.accessToken || isTokenExpiringSoon(preferredAccount.accessTokenExpiresAt)) && preferredAccount.refreshToken) {
    const refreshedAccount = await refreshAlibabaAccountTokens(preferredAccount);
    return getAccountCredentials(refreshedAccount);
  }

  return getAccountCredentials(preferredAccount) ?? getEnvCredentials();
}

function resolveDropshippingPoolId(channel: AlibabaFulfillmentChannel) {
  switch (channel) {
    case "standard_us":
      return "906124611";
    case "crossborder":
      return "906168847";
    case "fast_us":
      return "907135637";
    case "mexico":
      return "907732810";
    case "best_seller_us":
      return "907180667";
    case "best_seller_mexico":
      return "907180664";
    default:
      return "906168847";
  }
}

export async function searchAlibabaProducts(input: {
  query: string;
  limit: number;
  fulfillmentChannel: AlibabaFulfillmentChannel;
}): Promise<AlibabaProductSearchResult> {
  const icbuResult = await searchAlibabaIcbuProducts({
    query: input.query,
    limit: Math.min(Math.max(input.limit, 1), 100),
  });

  if (!icbuResult.ok) {
    return icbuResult;
  }

  if (icbuResult.products.length > 0) {
    const enrichedIcbuProducts = await enrichAlibabaSearchProducts(icbuResult.products);
    return {
      ...icbuResult,
      products: enrichedIcbuProducts,
    };
  }

  const payload = {
    param0: {
      keyword: input.query,
      search_word: input.query,
      index: 1,
      current: 1,
      size: Math.min(Math.max(input.limit, 1), 100),
      page_size: Math.min(Math.max(input.limit, 1), 100),
      page_no: 1,
      product_pool_id: resolveDropshippingPoolId(input.fulfillmentChannel),
    },
  };

  const credentials = await resolveAlibabaCredentialsForLiveCall();
  let result = await callAlibabaEndpoint("/eco/buyer/product/search", payload, {
    credentials,
    method: "GET",
    systemParamsInHeaders: true,
  });
  let response = result.responseBody as Record<string, unknown> | null;
  let responseMessage = extractAlibabaResponseMessage(response);

  if (isMissingAlibabaAppKeyMessage(responseMessage)) {
    result = await callAlibabaEndpoint("/eco/buyer/product/search", payload, {
      credentials,
      method: "GET",
      systemParamsInHeaders: false,
    });
    response = result.responseBody as Record<string, unknown> | null;
    responseMessage = extractAlibabaResponseMessage(response);
  }

  const candidates = collectCandidateRecords(response);
  const products = candidates
    .map((candidate) => mapAlibabaSearchResultToProduct(candidate, input.query))
    .filter((candidate): candidate is AlibabaSearchProduct => candidate !== null)
    .slice(0, Math.min(Math.max(input.limit, 1), 100));
  const enrichedProducts = await enrichAlibabaSearchProducts(products, credentials);
  const responseCode = extractAlibabaResponseCode(response);

  if (!result.ok) {
    return {
      ok: false,
      endpoint: "/eco/buyer/product/search",
      responseBody: result.responseBody,
      products: [] as AlibabaSearchProduct[],
      errorMessage: responseMessage
        ? `La recherche Alibaba live a echoue: ${responseMessage}`
        : "La recherche Alibaba live a echoue.",
    };
  }

  if (enrichedProducts.length === 0) {
    console.error("[alibaba/search] no usable products", {
      query: input.query,
      fulfillmentChannel: input.fulfillmentChannel,
      icbuErrorMessage: icbuResult.errorMessage,
      icbuErrorCode: "errorCode" in icbuResult ? icbuResult.errorCode : undefined,
      responseCode,
      responseMessage,
      topLevelKeys: response ? Object.keys(response).slice(0, 20) : [],
      candidateCount: candidates.length,
    });

    return {
      ok: false,
      endpoint: "/eco/buyer/product/search",
      responseBody: result.responseBody,
      products: [] as AlibabaSearchProduct[],
      errorMessage: responseMessage
        ? `Alibaba a repondu mais aucun produit exploitable n'a ete detecte: ${responseMessage}`
        : icbuResult.errorMessage
          ? `Aucun produit exploitable detecte. La recherche ICBU par SKU/modele a repondu: ${icbuResult.errorMessage}`
          : responseCode
            ? `Alibaba a repondu sans produit exploitable. Code: ${responseCode}.`
            : "Alibaba n'a renvoye aucun produit exploitable pour cette recherche.",
    };
  }

  return {
    ok: true,
    endpoint: "/eco/buyer/product/search",
    responseBody: result.responseBody,
    products: enrichedProducts,
  };
}

export async function createAlibabaBuyNowOrder(payload: Record<string, unknown>) {
  return callAlibabaEndpoint("/buynow/order/create", payload, {
    credentials: await resolveAlibabaCredentialsForLiveCall(),
  });
}

export async function createAlibabaDropshippingPayment(input: { tradeId: string }) {
  return callAlibabaEndpoint("/alibaba/dropshipping/order/pay", {
    trade_id: input.tradeId,
  }, {
    credentials: await resolveAlibabaCredentialsForLiveCall(),
  });
}

export async function queryAlibabaPaymentResult(input: { tradeId: string }) {
  return callAlibabaEndpoint("/alibaba/order/pay/result/query", {
    trade_id: input.tradeId,
  }, {
    credentials: await resolveAlibabaCredentialsForLiveCall(),
  });
}

export async function buildAlibabaAuthorizationUrl(input: {
  account: AlibabaSupplierAccount;
  redirectUri: string;
}) {
  if (!input.account.appKey) {
    throw new Error("Ajoute l'App Key avant de lancer l'autorisation OAuth.");
  }

  const authorizeUrl = new URL(input.account.authorizeUrl || ALIBABA_DEFAULT_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", input.account.appKey);
  authorizeUrl.searchParams.set("redirect_uri", input.redirectUri);
  authorizeUrl.searchParams.set("state", input.account.id);

  return authorizeUrl.toString();
}

export async function exchangeAlibabaOAuthCode(input: { accountId: string; code: string }) {
  const accounts = await getAlibabaSupplierAccounts();
  const account = accounts.find((entry) => entry.id === input.accountId);
  const credentials = getAccountCredentials(account);

  if (!account || !credentials) {
    throw new Error("Compte Alibaba introuvable ou incomplet.");
  }

  const result = await callAlibabaEndpoint(account.tokenUrl || credentials.tokenUrl, {
    code: input.code,
  }, {
    includeAccessToken: false,
    credentials,
  });

  if (!result.ok) {
    throw new Error("Generation du token d'acces Alibaba impossible.");
  }

  const body = result.responseBody as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: string | number;
    refresh_expires_in?: string | number;
    country?: string;
    account_id?: string;
    account?: string;
    user_info?: { loginId?: string; seller_id?: string; user_id?: string };
  };

  const nextAccount: AlibabaSupplierAccount = {
    ...account,
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    accessTokenExpiresAt: body.expires_in ? new Date(Date.now() + Number(body.expires_in) * 1000).toISOString() : account.accessTokenExpiresAt,
    refreshTokenExpiresAt: body.refresh_expires_in ? new Date(Date.now() + Number(body.refresh_expires_in) * 1000).toISOString() : account.refreshTokenExpiresAt,
    oauthCountry: body.country ?? account.oauthCountry,
    accountId: body.account_id ?? account.accountId,
    accountLogin: body.account ?? body.user_info?.loginId ?? account.accountLogin,
    accountName: body.user_info?.loginId ?? account.accountName,
    memberId: body.user_info?.seller_id ?? body.user_info?.user_id ?? account.memberId,
    status: "connected",
    isActive: true,
    lastAuthorizedAt: new Date().toISOString(),
    lastError: undefined,
    accessTokenHint: body.access_token ? `${body.access_token.slice(0, 10)}...` : account.accessTokenHint,
    updatedAt: new Date().toISOString(),
  };

  await Promise.all(accounts.filter((entry) => entry.id !== nextAccount.id && entry.isActive).map((entry) => saveAlibabaSupplierAccount({
    ...entry,
    isActive: false,
    updatedAt: nextAccount.updatedAt,
  })));
  await saveAlibabaSupplierAccount(nextAccount);

  return {
    account: nextAccount,
    responseBody: result.responseBody,
  };
}

export async function refreshAlibabaOAuthAccessToken(input?: { accountId?: string }) {
  const accounts = await getAlibabaSupplierAccounts();
  const account = input?.accountId
    ? accounts.find((entry) => entry.id === input.accountId) ?? null
    : accounts.find((entry) => entry.isActive && entry.status !== "disabled" && entry.appKey && entry.appSecret)
      ?? accounts.find((entry) => entry.status === "connected" && entry.appKey && entry.appSecret)
      ?? null;

  if (!account?.refreshToken) {
    throw new Error("Aucun refresh token Alibaba disponible.");
  }

  return refreshAlibabaAccountTokens(account);
}

function groupMappingsForOrder(order: SourcingOrder, mappings: AlibabaCatalogMapping[]) {
  const enrichedItems = order.items.map((item) => ({
    item,
    mapping: mappings.find((mapping) => mapping.slug === item.slug),
  }));
  const missingMappings = enrichedItems.filter((entry) => !entry.mapping?.alibabaProductId || !entry.mapping?.supplierCompanyId);

  const groups = new Map<string, typeof enrichedItems>();
  for (const entry of enrichedItems) {
    if (!entry.mapping?.supplierCompanyId) {
      continue;
    }

    const key = entry.mapping.supplierCompanyId;
    const current = groups.get(key) ?? [];
    groups.set(key, [...current, entry]);
  }

  return {
    missingMappings,
    groups: [...groups.entries()],
  };
}

export async function runAlibabaSupplierAutomation(order: SourcingOrder, mappings: AlibabaCatalogMapping[]) {
  const credentials = await resolveAlibabaCredentials();
  const { missingMappings, groups } = groupMappingsForOrder(order, mappings);
  const internalFulfillment = await getInternalSupplierFulfillment(order.shippingMethod);

  if (!credentials) {
    await createAlibabaIntegrationLog({
      orderId: order.id,
      action: "supplier-automation",
      endpoint: "env",
      status: "skipped_missing_credentials",
      requestBody: { orderNumber: order.orderNumber },
      responseBody: { message: "Missing ALIBABA_OPEN_PLATFORM_APP_KEY or ALIBABA_OPEN_PLATFORM_APP_SECRET" },
    });

    return {
      freightStatus: "skipped" as const,
      supplierOrderStatus: "skipped" as const,
      alibabaTradeIds: [] as string[],
      freightPayload: { skipped: true, reason: "missing_credentials" },
      supplierOrderPayload: { skipped: true, reason: "missing_credentials" },
    };
  }

  if (missingMappings.length > 0) {
    await createAlibabaIntegrationLog({
      orderId: order.id,
      action: "supplier-automation",
      endpoint: "catalog-mapping",
      status: "skipped_missing_mapping",
      requestBody: { missingSlugs: missingMappings.map((entry) => entry.item.slug) },
      responseBody: { message: "One or more cart items are missing Alibaba mapping data" },
    });

    return {
      freightStatus: "skipped" as const,
      supplierOrderStatus: "skipped" as const,
      alibabaTradeIds: [] as string[],
      freightPayload: { skipped: true, reason: "missing_mapping", missingSlugs: missingMappings.map((entry) => entry.item.slug) },
      supplierOrderPayload: { skipped: true, reason: "missing_mapping", missingSlugs: missingMappings.map((entry) => entry.item.slug) },
    };
  }

  const freightResponses: unknown[] = [];
  const supplierResponses: unknown[] = [];
  const tradeIds: string[] = [];
  let freightStatus: "verified" | "failed" = "verified";
  let supplierOrderStatus: "created" | "failed" = "created";

  for (const [supplierCompanyId, group] of groups) {
    const freightPayload = {
      e_company_id: supplierCompanyId,
      country: internalFulfillment.address.countryCode,
      province: internalFulfillment.address.state,
      city: internalFulfillment.address.city,
      address: [internalFulfillment.address.addressLine1, internalFulfillment.address.addressLine2].filter(Boolean).join(", "),
      zip: internalFulfillment.address.postalCode ?? "",
      dispatch_location: group[0]?.mapping?.dispatchLocation ?? "CN",
      shipping_mark: internalFulfillment.shippingMark,
      logistics_product_list: group.map((entry) => ({
        product_id: entry.mapping?.alibabaProductId,
        sku_id: entry.mapping?.skuId ?? "",
        quantity: entry.item.quantity,
      })),
    };

    const freightResult = await callAlibabaEndpoint("/order/freight/calculate", freightPayload);
    freightResponses.push(freightResult.responseBody);
    await createAlibabaIntegrationLog({
      orderId: order.id,
      action: "freight-verification",
      endpoint: freightResult.endpoint,
      status: freightResult.ok ? "success" : "failed",
      requestBody: freightPayload,
      responseBody: freightResult.responseBody,
    });

    if (!freightResult.ok) {
      freightStatus = "failed";
      supplierOrderStatus = "failed";
      continue;
    }

    const supplierPayload = {
      channel_refer_id: order.orderNumber,
      logistics_detail: {
        dispatch_location: group[0]?.mapping?.dispatchLocation ?? "CN",
        shipment_address: {
          address: internalFulfillment.address.addressLine1,
          alternate_address: internalFulfillment.address.addressLine2 ?? "",
          city: internalFulfillment.address.city,
          province: internalFulfillment.address.state,
          country: internalFulfillment.address.countryCode,
          country_code: internalFulfillment.address.countryCode,
          zip: internalFulfillment.address.postalCode ?? "",
          contact_person: internalFulfillment.address.contactName,
          email: internalFulfillment.address.email,
          port: internalFulfillment.address.port ?? "",
          port_code: internalFulfillment.address.portCode ?? "",
          telephone: {
            country: internalFulfillment.address.countryCode,
            area: "",
            number: internalFulfillment.address.phone,
          },
        },
      },
      product_list: group.map((entry) => ({
        product_id: entry.mapping?.alibabaProductId,
        sku_id: entry.mapping?.skuId ?? "",
        quantity: String(entry.item.quantity),
      })),
      properties: {
        platform: "CommerceHQ",
        orderId: order.orderNumber,
        assignedOperator: internalFulfillment.operatorName,
        shippingMark: internalFulfillment.shippingMark,
      },
      remark: `Internal order ${order.orderNumber} | Operator ${internalFulfillment.operatorName} | ${internalFulfillment.shippingMark}`,
    };

    const supplierResult = await createAlibabaBuyNowOrder(supplierPayload);
    supplierResponses.push(supplierResult.responseBody);
    await createAlibabaIntegrationLog({
      orderId: order.id,
      action: "supplier-order-create",
      endpoint: supplierResult.endpoint,
      status: supplierResult.ok ? "success" : "failed",
      requestBody: supplierPayload,
      responseBody: supplierResult.responseBody,
    });

    if (!supplierResult.ok) {
      supplierOrderStatus = "failed";
      continue;
    }

    const resultObject = supplierResult.responseBody as { trade_id?: string; data?: { trade_id?: string } };
    const tradeId = resultObject?.trade_id ?? resultObject?.data?.trade_id;
    if (tradeId) {
      tradeIds.push(String(tradeId));
    }
  }

  return {
    freightStatus,
    supplierOrderStatus,
    alibabaTradeIds: tradeIds,
    freightPayload: freightResponses,
    supplierOrderPayload: supplierResponses,
  };
}