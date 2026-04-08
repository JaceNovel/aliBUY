import { createHmac, randomUUID } from "node:crypto";

import {
  ALIBABA_DEFAULT_API_BASE_URL,
  ALIBABA_DEFAULT_AUTHORIZE_URL,
  ALIBABA_DEFAULT_REFRESH_URL,
  ALIBABA_DEFAULT_TOKEN_URL,
  type AlibabaReceptionAddress,
  type AlibabaFulfillmentChannel,
  type AlibabaSupplierAccount,
} from "@/lib/alibaba-operations";
import { getInternalSupplierFulfillment } from "@/lib/internal-fulfillment";
import { resolveAlibabaMoq } from "@/lib/product-moq";
import { resolveProductPriceSummaryUsd } from "@/lib/product-variant-pricing";
import { resolveCoherentItemWeightGrams, sanitizeItemWeightGrams } from "@/lib/product-weight";
import { getSourcingOrderMeta, type SourcingOrder, type AlibabaCatalogMapping } from "@/lib/alibaba-sourcing";
import type { ProductCatalogItem, ProductVariantSku } from "@/lib/products-data";
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

function mapAliExpressOAuthAccountPlatform(value: unknown): AlibabaSupplierAccount["accountPlatform"] | undefined {
  const normalized = getStringValue(value)?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized.includes("buyer")) {
    return "buyer";
  }

  if (normalized.includes("isv")) {
    return "isv";
  }

  if (normalized.includes("seller")) {
    return "seller";
  }

  return undefined;
}

type AliExpressTopCallResult = AlibabaCallResult;

export type AlibabaSearchProduct = ProductCatalogItem & {
  sourceProductId: string;
  supplierCompanyId?: string;
  inventory?: number;
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

export type AlibabaExactProductAttemptDebug = {
  endpoint: string;
  shipToCountry?: string;
  targetCurrency?: string;
  targetLanguage?: string;
  ok: boolean;
  status?: number;
  providerErrorCode?: string;
  providerMessage?: string;
  providerRequestId?: string;
  responseShape: string;
  mappingStatus: "mapped" | "provider_error" | "unmapped_payload" | "fallback_failed";
};

export type AlibabaExactProductSnapshotDebug = {
  externalProductId: string;
  shipToCountry?: string;
  targetCurrency?: string;
  targetLanguage?: string;
  attempts: AlibabaExactProductAttemptDebug[];
  resolvedRemoteMode?: "ds_product" | "ds_wholesale" | "standard_product" | "affiliate_exact" | "icbu_product";
  fallbackUsed: boolean;
  providerErrorCode?: string;
  providerMessage?: string;
  providerRequestId?: string;
  responseShape: string;
};

type ExtractedPriceTier = {
  minimumQuantity: number;
  quantityLabel: string;
  priceUsd: number;
  note?: string;
};

type AlibabaIcbuCategoryNode = {
  categoryId: string;
  title: string;
  parentIds: string[];
  level?: number;
  leafCategory: boolean;
  childIds: string[];
};

export type AlibabaResolvedCategoryInfo = {
  categoryId: string;
  title: string;
  path: string[];
  leafCategory: boolean;
};

export type AlibabaAiOptimizationConfig = {
  keywordOptimizationEnabled?: boolean;
  descriptionOptimizationEnabled?: boolean;
  titleOptimizationEnabled?: boolean;
};

export type AlibabaIcbuCategorySummary = {
  categoryId: string;
  categoryName: string;
  level?: number;
  leafCategory: boolean;
};

export type AlibabaEditProductPriceInput = {
  productId: string | number;
  price?: Record<string, unknown>;
  skuPrice?: Array<Record<string, unknown>>;
};

export type AlibabaBasicFreightInput = {
  destinationCountry: string;
  productId: string | number;
  quantity: string | number;
  zipCode?: string;
  dispatchLocation?: string;
  enableDistributionWaybill?: boolean;
  selectedSkuId?: string | number;
  provinceCode?: string;
  cityCode?: string;
  language?: string;
  currency?: string;
  locale?: string;
};

export type AlibabaAdvancedFreightItemInput = {
  quantity: string | number;
  productId: string | number;
  skuId?: string | number;
};

export type AlibabaAdvancedFreightInput = {
  eCompanyId: string;
  destinationCountry: string;
  logisticsProductList: AlibabaAdvancedFreightItemInput[];
  address?: Record<string, unknown>;
  dispatchLocation?: string;
  enableDistributionWaybill?: boolean;
  language?: string;
  currency?: string;
  locale?: string;
  provinceCode?: string;
  cityCode?: string;
};

export type AlibabaFreightOption = {
  destinationCountry?: string;
  vendorCode?: string;
  vendorName?: string;
  shippingType?: string;
  dispatchCountry?: string;
  solutionBizType?: string;
  tradeTerm?: string;
  deliveryTime?: string;
  storeType?: string;
  feeAmount?: number;
  feeCurrency?: string;
};

export type AliExpressDsAddressOption = {
  countryCode?: string;
  type?: string;
  childrenJson?: string;
};

export type AlibabaMergePayGroup = {
  groupCode?: string;
  canMergePay: boolean;
  canNotMergePayReason?: string;
  canNotMergePayReasonMessage?: string;
  canMergePayOrderIds: string[];
  canNotMergePayOrderItems: Array<{
    orderId?: string;
    reason?: string;
    reasonMessage?: string;
  }>;
};

export type AlibabaLogisticsTrackingEvent = {
  eventCode?: string;
  eventLocation?: string;
  eventName?: string;
  eventTime?: string;
};

export type AlibabaLogisticsTracking = {
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  currentEventCode?: string;
  eventList: AlibabaLogisticsTrackingEvent[];
};

const alibabaIcbuCategoryNodeCache = new Map<string, Promise<AlibabaIcbuCategoryNode | null>>();

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "").replace(/\/rest$/, "");
}

function isAliExpressUrl(value?: string | null) {
  return (value ?? "").toLowerCase().includes("aliexpress.com");
}

function isAliExpressAccount(account?: AlibabaSupplierAccount | null) {
  return isAliExpressUrl(account?.apiBaseUrl) || isAliExpressUrl(account?.authorizeUrl) || isAliExpressUrl(account?.tokenUrl);
}

function isAliExpressCredentials(credentials?: AlibabaCredentials | null): credentials is AlibabaCredentials {
  return isAliExpressUrl(credentials?.apiBaseUrl) || isAliExpressUrl(credentials?.authorizeUrl) || isAliExpressUrl(credentials?.tokenUrl);
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
  const appKey = process.env.ALIEXPRESS_OPEN_PLATFORM_APP_KEY ?? process.env.ALIBABA_OPEN_PLATFORM_APP_KEY;
  const appSecret = process.env.ALIEXPRESS_OPEN_PLATFORM_APP_SECRET ?? process.env.ALIBABA_OPEN_PLATFORM_APP_SECRET;

  if (!appKey || !appSecret) {
    return null;
  }

  return {
    appKey,
    appSecret,
    accessToken: process.env.ALIEXPRESS_OPEN_PLATFORM_ACCESS_TOKEN ?? process.env.ALIBABA_OPEN_PLATFORM_ACCESS_TOKEN,
    refreshToken: process.env.ALIEXPRESS_OPEN_PLATFORM_REFRESH_TOKEN,
    apiBaseUrl: normalizeBaseUrl(process.env.ALIEXPRESS_OPEN_PLATFORM_API_BASE_URL ?? process.env.ALIBABA_OPEN_PLATFORM_API_BASE_URL ?? ALIBABA_DEFAULT_API_BASE_URL),
    authorizeUrl: process.env.ALIEXPRESS_OAUTH_AUTHORIZE_URL ?? process.env.ALIBABA_OAUTH_AUTHORIZE_URL ?? ALIBABA_DEFAULT_AUTHORIZE_URL,
    tokenUrl: process.env.ALIEXPRESS_OAUTH_TOKEN_URL ?? process.env.ALIBABA_OAUTH_TOKEN_URL ?? ALIBABA_DEFAULT_TOKEN_URL,
    refreshUrl: process.env.ALIEXPRESS_OAUTH_REFRESH_URL ?? process.env.ALIBABA_OAUTH_REFRESH_URL ?? ALIBABA_DEFAULT_REFRESH_URL,
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

function signAliExpressTopRequest(_apiMethod: string, params: URLSearchParams, secret: string) {
  const sortedEntries = [...params.entries()]
    .filter(([key]) => key !== "sign")
    .sort(([left], [right]) => left.localeCompare(right));
  const baseString = sortedEntries.map(([key, value]) => `${key}${value}`).join("");

  return createHmac("sha256", secret).update(baseString, "utf8").digest("hex").toUpperCase();
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function splitAliExpressImages(value: unknown) {
  if (typeof value !== "string") {
    return [] as string[];
  }

  return value
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getAliExpressSellerPayload(responseBody: unknown) {
  if (!isRecord(responseBody)) {
    return null;
  }

  if (isRecord(responseBody.resp_result)) {
    const categoryEnvelope = responseBody.resp_result as Record<string, unknown>;
    return isRecord(categoryEnvelope.result) ? categoryEnvelope.result as Record<string, unknown> : categoryEnvelope;
  }

  if (isRecord(responseBody.result)) {
    return responseBody.result as Record<string, unknown>;
  }

  const responseEntry = Object.entries(responseBody).find(([key, value]) => key.startsWith("aliexpress_") && key.endsWith("_response") && isRecord(value));
  if (responseEntry) {
    const [, envelopeValue] = responseEntry;
    const envelope = envelopeValue as Record<string, unknown>;
    return isRecord(envelope.result) ? envelope.result as Record<string, unknown> : envelope;
  }

  if (isRecord(responseBody.aliexpress_ds_order_create_response)) {
    const orderEnvelope = responseBody.aliexpress_ds_order_create_response as Record<string, unknown>;
    return isRecord(orderEnvelope.result) ? orderEnvelope.result as Record<string, unknown> : orderEnvelope;
  }

  if (isRecord(responseBody.aliexpress_ds_product_get_response)) {
    const productEnvelope = responseBody.aliexpress_ds_product_get_response as Record<string, unknown>;
    return isRecord(productEnvelope.result) ? productEnvelope.result as Record<string, unknown> : productEnvelope;
  }

  if (isRecord(responseBody.aliexpress_ds_text_search)) {
    return responseBody.aliexpress_ds_text_search as Record<string, unknown>;
  }

  return responseBody;
}

function findAlibabaFirstStringDeep(value: unknown, keys: string[]) {
  const normalizedKeys = new Set(keys.map((entry) => entry.toLowerCase()));
  const queue: unknown[] = [value];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") {
      continue;
    }

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    for (const [key, entryValue] of Object.entries(current)) {
      if (normalizedKeys.has(key.toLowerCase())) {
        const normalizedValue = typeof entryValue === "string" ? entryValue.trim() : String(entryValue ?? "").trim();
        if (normalizedValue) {
          return normalizedValue;
        }
      }

      if (entryValue && typeof entryValue === "object") {
        queue.push(entryValue);
      }
    }
  }

  return undefined;
}

function describeAliExpressExactProductResponseShape(responseBody: unknown) {
  if (!responseBody || typeof responseBody !== "object") {
    return "empty_payload";
  }

  const result = getAliExpressSellerPayload(responseBody);
  if (!result || typeof result !== "object") {
    return "empty_result";
  }

  const baseInfo = isRecord(result.ae_item_base_info_dto) ? result.ae_item_base_info_dto as Record<string, unknown> : null;
  const skuInfo = Array.isArray(result.ae_item_sku_info_dtos)
    ? result.ae_item_sku_info_dtos as unknown[]
    : Array.isArray(result.sku_info)
      ? result.sku_info as unknown[]
      : [];

  if (!baseInfo || Object.keys(baseInfo).length === 0) {
    return "result_without_base_info";
  }

  if (skuInfo.length === 0) {
    return "result_without_skus";
  }

  return "result_with_base_info_and_skus";
}

function summarizeAliExpressExactProductPayload(responseBody: unknown) {
  const result = getAliExpressSellerPayload(responseBody);
  if (!isRecord(result)) {
    return {
      resultKeys: [] as string[],
      baseInfoKeys: [] as string[],
      skuCount: 0,
      title: undefined,
      detailUrl: undefined,
      imageCount: 0,
    };
  }

  const baseInfo = isRecord(result.ae_item_base_info_dto) ? result.ae_item_base_info_dto as Record<string, unknown> : {};
  const multimedia = isRecord(result.ae_multimedia_info_dto) ? result.ae_multimedia_info_dto as Record<string, unknown> : {};
  const skuInfo = Array.isArray(result.ae_item_sku_info_dtos)
    ? result.ae_item_sku_info_dtos as unknown[]
    : Array.isArray(result.sku_info)
      ? result.sku_info as unknown[]
      : [];
  const gallery = uniqueStrings([
    ...splitAliExpressImages(multimedia.image_urls),
    ...splitAliExpressImages(getStringValue(result.image_urls)),
    ...splitAliExpressImages(getStringValue(baseInfo.image_urls)),
    ...collectStrings([
      result.product_main_image_url,
      result.main_image_url,
      result.image_url,
      baseInfo.image_url,
      multimedia.image_url,
    ]),
  ]);

  return {
    resultKeys: Object.keys(result).slice(0, 20),
    baseInfoKeys: Object.keys(baseInfo).slice(0, 20),
    skuCount: skuInfo.length,
    title: getStringValue(baseInfo.subject) ?? getStringValue(result.subject) ?? getStringValue(result.product_title) ?? getStringValue(result.title),
    detailUrl: getStringValue(result.original_link) ?? getStringValue(result.detail_url) ?? getStringValue(result.product_detail_url) ?? getStringValue(baseInfo.detail_url),
    imageCount: gallery.length,
  };
}

function buildAliExpressFallbackSearchSeed(sourceProductId: string, responseBody: unknown, query: string) {
  const result = getAliExpressSellerPayload(responseBody);
  if (!isRecord(result)) {
    return {
      itemId: sourceProductId,
      product_id: sourceProductId,
      title: query,
    } satisfies Record<string, unknown>;
  }

  const baseInfo = isRecord(result.ae_item_base_info_dto) ? result.ae_item_base_info_dto as Record<string, unknown> : {};
  const multimedia = isRecord(result.ae_multimedia_info_dto) ? result.ae_multimedia_info_dto as Record<string, unknown> : {};
  const gallery = uniqueStrings([
    ...splitAliExpressImages(multimedia.image_urls),
    ...splitAliExpressImages(getStringValue(result.image_urls)),
    ...splitAliExpressImages(getStringValue(baseInfo.image_urls)),
    ...collectStrings([
      result.product_main_image_url,
      result.main_image_url,
      result.image_url,
      baseInfo.image_url,
      multimedia.image_url,
    ]),
  ]);

  return {
    itemId: sourceProductId,
    product_id: sourceProductId,
    title: getStringValue(baseInfo.subject) ?? getStringValue(result.subject) ?? getStringValue(result.product_title) ?? getStringValue(result.title) ?? query,
    itemMainPic: gallery[0],
    targetSalePrice: getStringValue(result.target_sale_price) ?? getStringValue(result.sale_price) ?? getStringValue(result.min_price) ?? getStringValue(baseInfo.sale_price),
    salePrice: getStringValue(result.sale_price) ?? getStringValue(result.target_sale_price) ?? getStringValue(result.min_price) ?? getStringValue(baseInfo.sale_price),
    targetOriginalPrice: getStringValue(result.target_original_price) ?? getStringValue(result.original_price) ?? getStringValue(result.max_price) ?? getStringValue(baseInfo.original_price),
    originalPrice: getStringValue(result.original_price) ?? getStringValue(result.target_original_price) ?? getStringValue(result.max_price) ?? getStringValue(baseInfo.original_price),
    min_price: getStringValue(result.min_price) ?? getStringValue(result.sale_price) ?? getStringValue(result.target_sale_price),
    max_price: getStringValue(result.max_price) ?? getStringValue(result.original_price) ?? getStringValue(result.target_original_price),
  } satisfies Record<string, unknown>;
}

function getAliExpressOAuthResponseBody(responseBody: unknown) {
  const normalizedBody = getAliExpressSellerPayload(responseBody) ?? responseBody;
  return isRecord(normalizedBody) ? normalizedBody : null;
}

function getAliExpressOAuthResponseCode(responseBody: unknown) {
  const body = getAliExpressOAuthResponseBody(responseBody);
  const response = isRecord(responseBody) ? responseBody : null;

  return getStringValue(body?.code)
    ?? getStringValue(body?.response_code)
    ?? getStringValue(body?.rsp_code)
    ?? getStringValue(response?.code)
    ?? getStringValue(response?.rsp_code);
}

function getAliExpressOAuthResponseMessage(responseBody: unknown) {
  const body = getAliExpressOAuthResponseBody(responseBody);
  const response = isRecord(responseBody) ? responseBody : null;

  return getStringValue(body?.msg)
    ?? getStringValue(body?.message)
    ?? getStringValue(body?.response_msg)
    ?? getStringValue(body?.rsp_msg)
    ?? getStringValue(response?.message)
    ?? getStringValue(response?.msg)
    ?? getStringValue(response?.rsp_msg);
}

function isAliExpressOAuthTokenResponseSuccessful(responseBody: unknown) {
  const body = getAliExpressOAuthResponseBody(responseBody);
  const accessToken = getStringValue(body?.access_token);
  const code = getAliExpressOAuthResponseCode(responseBody)?.trim().toLowerCase();

  if (!accessToken) {
    return false;
  }

  return !code || ["0", "200", "success", "true"].includes(code);
}

function usesAliExpressSecurityTokenEndpoint(pathOrUrl: string, type: "token" | "refresh") {
  try {
    const url = pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")
      ? new URL(pathOrUrl)
      : new URL(pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`, "https://api-sg.aliexpress.com");
    const normalizedPath = url.pathname.startsWith("/rest/") ? url.pathname.slice(5) : url.pathname;

    return type === "token"
      ? normalizedPath === "/auth/token/security/create"
      : normalizedPath === "/auth/token/security/refresh";
  } catch {
    return false;
  }
}

function buildAliExpressOAuthEndpointVariant(pathOrUrl: string, targetPath: string) {
  try {
    const url = pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")
      ? new URL(pathOrUrl)
      : new URL(pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`, "https://api-sg.aliexpress.com");

    url.pathname = targetPath.startsWith("/rest/") ? targetPath : `/rest${targetPath}`;
    return pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")
      ? url.toString()
      : url.pathname;
  } catch {
    return pathOrUrl;
  }
}

function getAliExpressOAuthEndpointCandidates(pathOrUrl: string, type: "token" | "refresh") {
  const normalized = pathOrUrl.trim();
  const currentIsSecurity = usesAliExpressSecurityTokenEndpoint(normalized, type);
  const alternatePath = type === "token"
    ? currentIsSecurity
      ? "/auth/token/create"
      : "/auth/token/security/create"
    : currentIsSecurity
      ? "/auth/token/refresh"
      : "/auth/token/security/refresh";
  const alternate = buildAliExpressOAuthEndpointVariant(normalized, alternatePath);

  return alternate !== normalized ? [normalized, alternate] : [normalized];
}

function shouldTryAliExpressOAuthAlternateEndpoint(responseBody: unknown) {
  const code = getAliExpressOAuthResponseCode(responseBody)?.trim().toUpperCase();
  const message = getAliExpressOAuthResponseMessage(responseBody)?.trim().toLowerCase();

  return code === "AUTH_TYPE_UNSUPPORTED"
    || code === "INCOMPLETESIGNATURE"
    || code === "ISV.402"
    || message === "creation failed";
}

function encodeAlibabaOAuthState(input: { accountId: string; redirectUri: string }) {
  return `${encodeURIComponent(input.accountId)}|${encodeURIComponent(input.redirectUri)}`;
}

export function decodeAlibabaOAuthState(state?: string | null) {
  if (!state) {
    return null;
  }

  const [encodedAccountId, ...encodedRedirectUriParts] = state.split("|");
  if (!encodedAccountId) {
    return null;
  }

  try {
    return {
      accountId: decodeURIComponent(encodedAccountId),
      redirectUri: encodedRedirectUriParts.length > 0 ? decodeURIComponent(encodedRedirectUriParts.join("|")) : undefined,
    };
  } catch {
    return {
      accountId: state,
      redirectUri: undefined,
    };
  }
}

function extractAliExpressSearchItems(payload: unknown) {
  const parseAliExpressSearchContainer = (value: unknown): unknown => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
      return value;
    }

    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  };

  const isAliExpressSearchRecord = (record: Record<string, unknown>) => {
    return Boolean(
      getStringValue(record.itemId)
      ?? getStringValue(record.item_id)
      ?? getStringValue(record.product_id)
      ?? getStringValue(record.productId),
    ) && Boolean(
      getStringValue(record.title)
      ?? getStringValue(record.item_title)
      ?? getStringValue(record.subject)
      ?? getStringValue(record.itemMainPic)
      ?? getStringValue(record.item_main_pic)
      ?? getStringValue(record.salePrice)
      ?? getStringValue(record.sale_price)
      ?? getStringValue(record.targetSalePrice)
      ?? getStringValue(record.target_sale_price),
    );
  };

  const normalizeAliExpressSearchArray = (value: unknown) => {
    const parsed = parseAliExpressSearchContainer(value);
    if (!Array.isArray(parsed)) {
      return [] as Array<Record<string, unknown>>;
    }

    const records = parsed
      .map((entry) => parseAliExpressSearchContainer(entry))
      .filter(isRecord) as Array<Record<string, unknown>>;

    return records.filter(isAliExpressSearchRecord);
  };

  const parsedPayload = parseAliExpressSearchContainer(payload);
  if (!isRecord(parsedPayload) && !Array.isArray(parsedPayload)) {
    return [] as Array<Record<string, unknown>>;
  }

  const searchArrayKeys = [
    "products",
    "product_list",
    "products_list",
    "productsList",
    "item_list",
    "items",
    "records",
    "result_list",
    "content",
    "list",
    "data",
    "result",
  ];

  for (const candidate of [
    parsedPayload,
    isRecord(parsedPayload) ? parseAliExpressSearchContainer(parsedPayload.data) : undefined,
    isRecord(parsedPayload) ? parseAliExpressSearchContainer(parsedPayload.result) : undefined,
    isRecord(parsedPayload) ? parseAliExpressSearchContainer(parsedPayload.page_result) : undefined,
    isRecord(parsedPayload) ? parseAliExpressSearchContainer(parsedPayload.pageResult) : undefined,
    isRecord(parsedPayload) ? parseAliExpressSearchContainer(parsedPayload.search_result) : undefined,
    isRecord(parsedPayload) ? parseAliExpressSearchContainer(parsedPayload.searchResult) : undefined,
  ]) {
    const records = normalizeAliExpressSearchArray(candidate);
    if (records.length > 0) {
      return records;
    }
  }

  if (!isRecord(parsedPayload)) {
    return [] as Array<Record<string, unknown>>;
  }

  for (const node of collectObjectNodes(parsedPayload)) {
    for (const key of searchArrayKeys) {
      const records = normalizeAliExpressSearchArray(node[key]);
      if (records.length > 0) {
        return records;
      }
    }

    for (const value of Object.values(node)) {
      const records = normalizeAliExpressSearchArray(value);
      if (records.length > 0) {
        return records;
      }
    }
  }

  return [] as Array<Record<string, unknown>>;
}

function parseAlibabaCategoryIdList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.flatMap((entry) => parseAlibabaCategoryIdList(entry)).filter(Boolean))];
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return [String(Math.round(value))];
  }

  if (typeof value !== "string") {
    return [] as string[];
  }

  return [...new Set(
    value
      .split(/[\s,;|>]+/g)
      .map((entry) => entry.trim())
      .filter((entry) => /^\d+$/.test(entry)),
  )];
}

function getAlibabaCategoryLabel(record: Record<string, unknown>) {
  return getStringValue(record.name)
    ?? getStringValue(record.cn_name)
    ?? getStringValue(record.category_name)
    ?? getStringValue(record.title);
}

function extractAlibabaCategoryIdFromPayload(value: unknown, depth = 0): string | undefined {
  if (depth > 6 || value == null) {
    return undefined;
  }

  if (typeof value === "string" || typeof value === "number") {
    const [firstId] = parseAlibabaCategoryIdList(value);
    return firstId;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = extractAlibabaCategoryIdFromPayload(entry, depth + 1);
      if (nested) {
        return nested;
      }
    }

    return undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  for (const key of ["category_id", "categoryId", "cat_id", "catId"]) {
    const [directId] = parseAlibabaCategoryIdList(value[key]);
    if (directId) {
      return directId;
    }
  }

  for (const key of ["category_info", "categoryInfo", "basic_info", "basicInfo", "detail", "search", "rawPayload"]) {
    const nested = extractAlibabaCategoryIdFromPayload(value[key], depth + 1);
    if (nested) {
      return nested;
    }
  }

  for (const nestedValue of Object.values(value)) {
    const nested = extractAlibabaCategoryIdFromPayload(nestedValue, depth + 1);
    if (nested) {
      return nested;
    }
  }

  return undefined;
}

async function fetchAlibabaIcbuCategoryNode(catId: string, credentials?: AlibabaCredentials | null): Promise<AlibabaIcbuCategoryNode | null> {
  const normalizedId = catId.trim();
  if (!/^\d+$/.test(normalizedId) || normalizedId === "0") {
    return null;
  }

  const cached = alibabaIcbuCategoryNodeCache.get(normalizedId);
  if (cached) {
    return cached;
  }

  const pending = (async () => {
    const resolvedCredentials = credentials ?? await resolveAlibabaCredentialsForLiveCall();
    if (!resolvedCredentials) {
      return null;
    }

    const result = await callAlibabaEndpoint("/icbu/product/category/get", {
      cat_id: normalizedId,
    }, {
      credentials: resolvedCredentials,
      method: "GET",
    });

    if (!result.ok) {
      return null;
    }

    const response = isRecord(result.responseBody) ? result.responseBody : null;
    const envelope = response && isRecord(response.result) ? response.result : response;
    const rawNode = envelope && isRecord(envelope.result) ? envelope.result : null;
    const success = envelope && (isTruthyAlibabaFlag(envelope.success) || getStringValue(envelope.response_code) === "200");

    if (!rawNode || !success) {
      return null;
    }

    const title = getAlibabaCategoryLabel(rawNode);
    const categoryId = getStringValue(rawNode.category_id) ?? normalizedId;
    if (!title || !categoryId) {
      return null;
    }

    return {
      categoryId,
      title,
      parentIds: parseAlibabaCategoryIdList(rawNode.parent_ids),
      level: getNumberValue(rawNode.level),
      leafCategory: isTruthyAlibabaFlag(rawNode.leaf_category),
      childIds: parseAlibabaCategoryIdList(rawNode.child_ids),
    } satisfies AlibabaIcbuCategoryNode;
  })().catch(() => null);

  alibabaIcbuCategoryNodeCache.set(normalizedId, pending);
  return pending;
}

export async function resolveAlibabaIcbuCategoryInfo(input: {
  categoryId?: string;
  rawPayload?: unknown;
}): Promise<AlibabaResolvedCategoryInfo | null> {
  const categoryId = input.categoryId ?? extractAlibabaCategoryIdFromPayload(input.rawPayload);
  if (!categoryId) {
    return null;
  }

  const credentials = await resolveAlibabaCredentialsForLiveCall();
  if (!credentials) {
    return null;
  }

  const node = await fetchAlibabaIcbuCategoryNode(categoryId, credentials);
  if (!node) {
    return null;
  }

  const parents = await Promise.all(node.parentIds.map((parentId) => fetchAlibabaIcbuCategoryNode(parentId, credentials)));
  const path = [...parents, node]
    .filter((entry): entry is AlibabaIcbuCategoryNode => Boolean(entry))
    .map((entry) => entry.title)
    .filter(Boolean);

  return {
    categoryId: node.categoryId,
    title: node.title,
    path: path.length > 0 ? path : [node.title],
    leafCategory: node.leafCategory,
  };
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

function parsePositiveNumber(candidate: unknown) {
  if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
    return candidate;
  }

  if (typeof candidate !== "string") {
    return undefined;
  }

  const match = candidate.match(/\d+(?:[.,]\d+)?/);
  if (!match) {
    return undefined;
  }

  const value = Number(match[0].replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function getTierMinimum(label: string) {
  const normalized = label.toLowerCase();
  const betweenMatch = normalized.match(/(\d+)\s*[-~]\s*(\d+)/);
  if (betweenMatch) {
    return Number(betweenMatch[1]);
  }

  const greaterMatch = normalized.match(/(?:>=|over|above|more than)\s*(\d+)/);
  if (greaterMatch) {
    return Number(greaterMatch[1]);
  }

  const directMatch = normalized.match(/\d+/);
  return directMatch ? Number(directMatch[0]) : 1;
}

function buildQuantityLabel(minimumQuantity: number, maximumQuantity?: number, unit = "piece") {
  if (typeof maximumQuantity === "number" && maximumQuantity >= minimumQuantity) {
    return `${minimumQuantity}-${maximumQuantity} ${unit}`;
  }

  return `${minimumQuantity}+ ${unit}`;
}

function normalizeQuantityLabel(label: string, unit = "piece") {
  const normalized = label.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return undefined;
  }

  if (/(piece|pieces|pcs|unit|units|set|sets|qty|quantity)$/i.test(normalized)) {
    return normalized;
  }

  if (/^>=?\s*\d+$/i.test(normalized)) {
    return `${normalized.replace(/^>/, ">=")} ${unit}`;
  }

  if (/^\d+\s*[-~]\s*\d+$/i.test(normalized)) {
    return `${normalized.replace(/~/g, "-")} ${unit}`;
  }

  if (/^\d+\+$/i.test(normalized)) {
    return `${normalized} ${unit}`;
  }

  return normalized;
}

function extractExplicitQuantityLabel(record: Record<string, unknown>, unit = "piece") {
  const candidates = [
    record.quantity_label,
    record.quantityLabel,
    record.quantity_range,
    record.quantityRange,
    record.range,
    record.price_range,
    record.priceRange,
    record.amount_range,
    record.amountRange,
    record.display_range,
    record.displayRange,
    record.begin_amount_text,
    record.beginAmountText,
    record.min_order_desc,
    record.minOrderDesc,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue;
    }

    const normalized = normalizeQuantityLabel(candidate, unit);
    if (normalized && /\d/.test(normalized)) {
      return normalized;
    }
  }

  return undefined;
}

function isTierContextKey(keyHint?: string) {
  return Boolean(keyHint && /(price|tier|ladder|wholesale|trade_info|wholesale_trade|range_price|price_info|price_range|tiered_price|sku_price|skuprice)/i.test(keyHint));
}

function hasExplicitQuantityKey(record: Record<string, unknown>) {
  return [
    "begin_amount",
    "beginAmount",
    "min_order_quantity",
    "minOrderQuantity",
    "minimum_order_quantity",
    "minimumOrderQuantity",
    "quantity_min",
    "quantityMin",
    "min_qty",
    "minQty",
    "start_quantity",
    "startQuantity",
    "max_order_quantity",
    "maxOrderQuantity",
    "quantity_max",
    "quantityMax",
    "max_qty",
    "maxQty",
    "end_quantity",
    "endQuantity",
  ].some((key) => typeof record[key] !== "undefined");
}

function hasExplicitPriceKey(record: Record<string, unknown>) {
  return [
    "price",
    "sale_price",
    "salePrice",
    "discount_price",
    "discountPrice",
    "unit_price",
    "unitPrice",
    "display_price",
    "displayPrice",
    "price_value",
    "priceValue",
    "sku_price",
  ].some((key) => typeof record[key] !== "undefined");
}

function labelHasClosedRange(label: string) {
  return /\d+\s*[-~]\s*\d+/.test(label);
}

function normalizeExtractedPriceTiers(tiers: ExtractedPriceTier[]) {
  const unique = new Map<number, ExtractedPriceTier>();

  for (const tier of tiers) {
    if (!Number.isFinite(tier.priceUsd) || tier.priceUsd <= 0 || !Number.isFinite(tier.minimumQuantity) || tier.minimumQuantity <= 0) {
      continue;
    }

    const normalizedTier = {
      ...tier,
      minimumQuantity: Math.round(tier.minimumQuantity),
      quantityLabel: tier.quantityLabel.trim(),
    };
    const existing = unique.get(normalizedTier.minimumQuantity);

    if (!existing) {
      unique.set(normalizedTier.minimumQuantity, normalizedTier);
      continue;
    }

    const existingHasClosedRange = labelHasClosedRange(existing.quantityLabel);
    const nextHasClosedRange = labelHasClosedRange(normalizedTier.quantityLabel);

    if ((nextHasClosedRange && !existingHasClosedRange)
      || (nextHasClosedRange === existingHasClosedRange && normalizedTier.priceUsd > existing.priceUsd)) {
      unique.set(normalizedTier.minimumQuantity, normalizedTier);
    }
  }

  return [...unique.values()].sort((left, right) => left.minimumQuantity - right.minimumQuantity);
}

function extractPriceTiersFromString(value: string, unit = "piece") {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || !/(?:\d+\s*[-~]\s*\d+|>=?\s*\d+).*(?:[$€£¥]\s*\d+|\d+(?:[.,]\d+)?\s*[$€£¥])/i.test(normalized)) {
    return [] as ExtractedPriceTier[];
  }

  const pattern = /(?:^|\b)(>=\s*)?(\d{1,6})(?:\s*[-~]\s*(\d{1,6}))?\s*(?:pieces?|piece|pcs?|units?|unit|sets?|qty)?[^\d$€£¥]{0,18}(?:[$€£¥]\s*)?(\d+(?:[.,]\d+)?)/gi;
  const tiers: ExtractedPriceTier[] = [];

  for (const match of normalized.matchAll(pattern)) {
    const minimumQuantity = Number(match[2]);
    const maximumQuantity = match[3] ? Number(match[3]) : undefined;
    const priceUsd = Number(match[4].replace(',', '.'));

    if (!Number.isFinite(minimumQuantity) || minimumQuantity <= 0 || !Number.isFinite(priceUsd) || priceUsd <= 0) {
      continue;
    }

    tiers.push({
      minimumQuantity,
      quantityLabel: buildQuantityLabel(minimumQuantity, maximumQuantity, unit),
      priceUsd,
      note: match[1] ? "Grand volume" : undefined,
    });
  }

  return normalizeExtractedPriceTiers(tiers);
}

function extractPriceTierFromRecord(record: Record<string, unknown>, unit = "piece", keyHint?: string) {
  if (!hasExplicitPriceKey(record)) {
    return null;
  }

  if (!hasExplicitQuantityKey(record) && !isTierContextKey(keyHint)) {
    return null;
  }

  const priceUsd = parsePositiveNumber(
    record.price,
  ) ?? parsePositiveNumber(record.sale_price)
    ?? parsePositiveNumber(record.salePrice)
    ?? parsePositiveNumber(record.discount_price)
    ?? parsePositiveNumber(record.discountPrice)
    ?? parsePositiveNumber(record.unit_price)
    ?? parsePositiveNumber(record.unitPrice)
    ?? parsePositiveNumber(record.display_price)
    ?? parsePositiveNumber(record.displayPrice)
    ?? parsePositiveNumber(record.price_value)
    ?? parsePositiveNumber(record.priceValue)
    ?? (record.sku_price && typeof record.sku_price === "object" ? parsePositiveNumber((record.sku_price as Record<string, unknown>).price) : undefined);

  const minimumQuantity = parsePositiveNumber(record.begin_amount)
    ?? parsePositiveNumber(record.beginAmount)
    ?? parsePositiveNumber(record.min_order_quantity)
    ?? parsePositiveNumber(record.minOrderQuantity)
    ?? parsePositiveNumber(record.minimum_order_quantity)
    ?? parsePositiveNumber(record.minimumOrderQuantity)
    ?? parsePositiveNumber(record.quantity_min)
    ?? parsePositiveNumber(record.quantityMin)
    ?? parsePositiveNumber(record.min_qty)
    ?? parsePositiveNumber(record.minQty)
    ?? parsePositiveNumber(record.min_quantity)
    ?? parsePositiveNumber(record.minQuantity)
    ?? parsePositiveNumber(record.start_quantity)
    ?? parsePositiveNumber(record.startQuantity)
    ?? parsePositiveNumber(record.quantity)
    ?? parsePositiveNumber(record.qty)
    ?? (isTierContextKey(keyHint) ? parsePositiveNumber(record.from) : undefined);
  const maximumQuantity = parsePositiveNumber(record.max_order_quantity)
    ?? parsePositiveNumber(record.maxOrderQuantity)
    ?? parsePositiveNumber(record.quantity_max)
    ?? parsePositiveNumber(record.quantityMax)
    ?? parsePositiveNumber(record.max_qty)
    ?? parsePositiveNumber(record.maxQty)
    ?? parsePositiveNumber(record.max_quantity)
    ?? parsePositiveNumber(record.maxQuantity)
    ?? parsePositiveNumber(record.end_quantity)
    ?? parsePositiveNumber(record.endQuantity)
    ?? (isTierContextKey(keyHint) ? parsePositiveNumber(record.to) : undefined);

  if (!priceUsd || !minimumQuantity) {
    return null;
  }

  return {
    minimumQuantity: Math.round(minimumQuantity),
    quantityLabel: extractExplicitQuantityLabel(record, unit)
      ?? buildQuantityLabel(Math.round(minimumQuantity), typeof maximumQuantity === "number" ? Math.round(maximumQuantity) : undefined, unit),
    priceUsd,
    note: getStringValue(record.note) ?? getStringValue(record.remark) ?? getStringValue(record.description),
  } satisfies ExtractedPriceTier;
}

function collectPriceTiers(value: unknown, depth = 0, keyHint?: string, unit = "piece"): ExtractedPriceTier[] {
  if (depth > 6 || value == null) {
    return [];
  }

  if (typeof value === "string") {
    if (isTierContextKey(keyHint) || /(\d+\s*[-~]\s*\d+|>=?\s*\d+).*(?:[$€£¥]\s*\d+|\d+(?:[.,]\d+)?\s*[$€£¥])/i.test(value)) {
      return extractPriceTiersFromString(value, unit);
    }

    return [];
  }

  if (Array.isArray(value)) {
    if (!isTierContextKey(keyHint) && depth > 0) {
      return [];
    }

    return normalizeExtractedPriceTiers(value.flatMap((entry) => collectPriceTiers(entry, depth + 1, keyHint, unit)));
  }

  if (typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  const directTier = extractPriceTierFromRecord(record, unit, keyHint);
  const nestedTiers = Object.entries(record).flatMap(([nestedKey, nestedValue]) => {
    if (!isTierContextKey(nestedKey) && depth > 0) {
      return [] as ExtractedPriceTier[];
    }

    return collectPriceTiers(nestedValue, depth + 1, nestedKey, unit);
  });

  return normalizeExtractedPriceTiers([
    ...(directTier ? [directTier] : []),
    ...nestedTiers,
  ]);
}

function summarizeAlibabaPriceData(input: {
  unit?: string;
  moq?: number;
  values: unknown[];
}) {
  const tiers = normalizeExtractedPriceTiers(input.values.flatMap((value) => collectPriceTiers(value, 0, undefined, input.unit ?? "piece")));
  const boundsFromTiers = tiers.length > 0
    ? resolveProductPriceSummaryUsd({
        tiers,
        moq: Math.max(1, input.moq ?? 1),
      }, {
        quantity: Math.max(1, input.moq ?? 1),
      })
    : { minUsd: undefined, maxUsd: undefined, exact: true };
  const boundsFromRaw = getPriceBounds(...input.values);
  const bounds = hasCoherentPrice({ min: boundsFromTiers.minUsd, max: boundsFromTiers.maxUsd })
    ? { min: boundsFromTiers.minUsd, max: boundsFromTiers.maxUsd }
    : boundsFromRaw;
  const fallbackTiers = hasCoherentPrice(bounds)
    ? [{
        minimumQuantity: Math.max(1, input.moq ?? 1),
        quantityLabel: `${Math.max(1, input.moq ?? 1)}+ ${input.unit ?? "piece"}`,
        priceUsd: bounds.max ?? bounds.min ?? 0,
        note: undefined,
      } satisfies ExtractedPriceTier]
    : [];

  return {
    tiers: tiers.length > 0 ? tiers : fallbackTiers,
    min: bounds.min,
    max: bounds.max,
    verified: tiers.length > 0 || hasCoherentPrice(bounds),
  };
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
  return Boolean(keyHint && /(weight|gross[_ -]?weight|net[_ -]?weight|package[_ -]?weight|shipping[_ -]?weight|item[_ -]?weight|product[_ -]?weight|parcel[_ -]?weight|weight[_ -]?grams|weightgrams|gram|grams|kg|kilogram|lb|lbs|pound|ounces|oz)/i.test(keyHint));
}

function parseWeightToGrams(value: unknown, keyHint?: string) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (keyHint && /gram|grams|weight_grams|weightgrams/i.test(keyHint)) {
      return sanitizeItemWeightGrams(Math.round(value));
    }

    if (keyHint && /kg|kilogram/i.test(keyHint)) {
      return sanitizeItemWeightGrams(Math.round(value * 1000));
    }

    if (isWeightKeyHint(keyHint) && value > 0) {
      return sanitizeItemWeightGrams(Math.round(value < 10 ? value * 1000 : value));
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

  const kilogramMatch = isWeightKeyHint(keyHint)
    ? normalized.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilogram)/i)
    : null;
  if (kilogramMatch) {
    return sanitizeItemWeightGrams(Math.round(Number(kilogramMatch[1].replace(',', '.')) * 1000));
  }

  const poundMatch = isWeightKeyHint(keyHint)
    ? normalized.match(/(\d+(?:[.,]\d+)?)\s*(lb|lbs|pound)/i)
    : null;
  if (poundMatch) {
    return sanitizeItemWeightGrams(Math.round(Number(poundMatch[1].replace(',', '.')) * 453.59237));
  }

  const ounceMatch = isWeightKeyHint(keyHint)
    ? normalized.match(/(\d+(?:[.,]\d+)?)\s*(oz|ounce)/i)
    : null;
  if (ounceMatch) {
    return sanitizeItemWeightGrams(Math.round(Number(ounceMatch[1].replace(',', '.')) * 28.349523125));
  }

  const gramMatch = isWeightKeyHint(keyHint)
    ? normalized.match(/(\d+(?:[.,]\d+)?)\s*(g|gram)s?\b/i)
    : normalized.match(/(?:weight|poids|gross|net|shipping|package|item|product)[^\d]{0,12}(\d+(?:[.,]\d+)?)\s*(g|gram)s?\b/i);
  if (gramMatch && !/2\.4g|5g|4g/i.test(normalized)) {
    return sanitizeItemWeightGrams(Math.round(Number(gramMatch[1].replace(',', '.'))));
  }

  if (isWeightKeyHint(keyHint)) {
    const numeric = Number(normalized.replace(/[^0-9.,-]/g, '').replace(',', '.'));
    if (Number.isFinite(numeric) && numeric > 0) {
      return sanitizeItemWeightGrams(Math.round(numeric < 10 ? numeric * 1000 : numeric));
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

type VariantPair = {
  label: string;
  value: string;
};

function normalizeVariantText(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/[_]+/g, " ")
    .replace(/[\s\u00a0]+/g, " ")
    .replace(/^[\s:;|,./-]+|[\s:;|,./-]+$/g, "")
    .trim();
}

function normalizeVariantLabel(value: string) {
  return normalizeVariantText(value).replace(/[:：]\s*$/u, "");
}

function normalizeVariantValue(value: string) {
  return normalizeVariantText(value);
}

function isVariantLabelCandidate(value: string) {
  return value.length > 0 && !/^(sku|sku code|sku id|item id|product id|price|price range|min price|max price|moq|quantity|qty|unit|inventory|stock|weight|image|picture|photo|video|url|link|currency|lead time|model|model number)$/i.test(value);
}

function isVariantValueCandidate(value: string) {
  return value.length > 0 && value.length <= 80 && !/^https?:\/\//i.test(value);
}

function toVariantPair(label: string | undefined, value: string | undefined) {
  const normalizedLabel = label ? normalizeVariantLabel(label) : "";
  const normalizedValue = value ? normalizeVariantValue(value) : "";

  if (!isVariantLabelCandidate(normalizedLabel) || !isVariantValueCandidate(normalizedValue)) {
    return null;
  }

  return {
    label: normalizedLabel,
    value: normalizedValue,
  } satisfies VariantPair;
}

function extractVariantPairsFromString(value: string, fallbackLabel?: string): VariantPair[] {
  const normalized = normalizeVariantText(value);
  if (!normalized) {
    return [];
  }

  const segments = normalized.split(/[;|]/g).map((segment) => segment.trim()).filter(Boolean);
  const pairs = segments.flatMap((segment) => {
    const match = segment.match(/^([^:=]{1,40})\s*[:=]\s*(.+)$/);
    if (!match) {
      return [];
    }

    const pair = toVariantPair(match[1], match[2]);
    return pair ? [pair] : [];
  });

  if (pairs.length > 0) {
    return pairs;
  }

  const fallbackPair = fallbackLabel ? toVariantPair(fallbackLabel, normalized) : null;
  return fallbackPair ? [fallbackPair] : [];
}

function extractVariantPairsFromAttribute(value: unknown, fallbackLabel?: string, depth = 0): VariantPair[] {
  if (depth > 4 || value == null) {
    return [];
  }

  if (typeof value === "string") {
    return extractVariantPairsFromString(value, fallbackLabel);
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractVariantPairsFromAttribute(entry, fallbackLabel, depth + 1));
  }

  if (typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  const label = getStringValue(record.attribute_name)
    ?? getStringValue(record.attributeName)
    ?? getStringValue(record.attr_name)
    ?? getStringValue(record.attrName)
    ?? getStringValue(record.attr_name_desc)
    ?? getStringValue(record.attrNameDesc)
    ?? getStringValue(record.spec_name)
    ?? getStringValue(record.specName)
    ?? getStringValue(record.prop_name)
    ?? getStringValue(record.propName)
    ?? getStringValue(record.sale_attribute_name)
    ?? getStringValue(record.saleAttributeName)
    ?? getStringValue(record.label)
    ?? getStringValue(record.name)
    ?? getStringValue(record.key)
    ?? fallbackLabel;
  const directValue = getStringValue(record.attribute_value)
    ?? getStringValue(record.attributeValue)
    ?? getStringValue(record.attr_value)
    ?? getStringValue(record.attrValue)
    ?? getStringValue(record.attr_value_desc)
    ?? getStringValue(record.attrValueDesc)
    ?? getStringValue(record.value_name)
    ?? getStringValue(record.valueName)
    ?? getStringValue(record.option_name)
    ?? getStringValue(record.optionName)
    ?? getStringValue(record.display_value)
    ?? getStringValue(record.displayValue)
    ?? getStringValue(record.text)
    ?? (fallbackLabel ? getStringValue(record.value) : undefined);
  const directPair = toVariantPair(label, directValue);
  const nestedKeys = [
    "sale_attributes",
    "saleAttributes",
    "attributes",
    "attribute_list",
    "attributeList",
    "attribute_values",
    "attributeValues",
    "sku_attributes",
    "skuAttributes",
    "sku_attr_list",
    "skuAttrList",
    "spec_attrs",
    "specAttributes",
    "props",
    "properties",
    "options",
    "values",
    "items",
  ];

  return [
    ...(directPair ? [directPair] : []),
    ...nestedKeys.flatMap((key) => extractVariantPairsFromAttribute(record[key], label, depth + 1)),
  ];
}

function extractAlibabaVariantGroups(...sources: Array<Record<string, unknown> | null | undefined>): ProductCatalogItem["variantGroups"] {
  const groups = new Map<string, string[]>();

  const addPair = (pair: VariantPair) => {
    const existingValues = groups.get(pair.label) ?? [];
    if (!existingValues.includes(pair.value)) {
      existingValues.push(pair.value);
      groups.set(pair.label, existingValues);
    }
  };

  for (const source of sources) {
    if (!source) {
      continue;
    }

    const tradeInfo = (source.trade_info && typeof source.trade_info === "object") ? source.trade_info as Record<string, unknown> : {};
    const skuInfo = Array.isArray(source.sku_info)
      ? source.sku_info
      : Array.isArray(tradeInfo.sku_info)
        ? tradeInfo.sku_info
        : Array.isArray(source.skus)
          ? source.skus
          : [];
    const candidates: unknown[] = [
      source.sale_attributes,
      source.saleAttributes,
      source.attributes,
      source.attribute_list,
      source.attributeList,
      source.spec_attrs,
      source.specAttributes,
      source.properties,
      source.props,
      tradeInfo.sale_attributes,
      tradeInfo.saleAttributes,
      tradeInfo.attributes,
      skuInfo,
    ];

    for (const candidate of candidates) {
      extractVariantPairsFromAttribute(candidate).forEach(addPair);
    }

    for (const sku of skuInfo) {
      if (!sku || typeof sku !== "object" || Array.isArray(sku)) {
        continue;
      }

      const skuRecord = sku as Record<string, unknown>;
      Object.entries(skuRecord)
        .filter(([key]) => /(sale|attr|spec|variant|prop)/i.test(key))
        .flatMap(([, entry]) => extractVariantPairsFromAttribute(entry))
        .forEach(addPair);
    }
  }

  return [...groups.entries()]
    .map(([label, values]) => ({ label, values }))
    .filter((group) => group.values.length > 1)
    .slice(0, 4);
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
    ...skuInfo.flatMap((sku) => collectStrings(sku.image)),
    ...skuInfo.flatMap((sku) => collectStrings(sku.sku_attr_list)),
    ...skuInfo.flatMap((sku) => collectStrings(sku.sale_attributes)),
  ]).filter((entry) => entry.startsWith("http") || entry.startsWith("/") || entry.startsWith("//")).map(normalizeAlibabaImageUrl);
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

export function normalizeAlibabaIcbuProductInfo(responseBody: unknown) {
  return extractAlibabaProductDetailRecord(isRecord(responseBody) ? responseBody : null);
}

function hasUsefulAlibabaPayload(responseBody: unknown) {
  const normalizedProduct = normalizeAlibabaIcbuProductInfo(responseBody);
  if (normalizedProduct) {
    return true;
  }

  const response = isRecord(responseBody) ? responseBody : null;
  if (!response) {
    return false;
  }

  if (typeof response.value !== "undefined" && response.value !== null) {
    return true;
  }

  if (Array.isArray(response.tracking_list)) {
    return true;
  }

  const sellerPayload = getAliExpressSellerPayload(responseBody);
  if (sellerPayload) {
    if (Array.isArray(sellerPayload.categories) && sellerPayload.categories.length > 0) {
      return true;
    }

    if (Array.isArray(sellerPayload.delivery_options) && sellerPayload.delivery_options.length > 0) {
      return true;
    }

    if (Array.isArray(sellerPayload.result) && sellerPayload.result.length > 0) {
      return true;
    }

    if (isRecord(sellerPayload.order_list) || Array.isArray(sellerPayload.order_list)) {
      return true;
    }

    if (isRecord(sellerPayload.data)) {
      const data = sellerPayload.data as Record<string, unknown>;
      const trackingLines = extractAliExpressTrackingLines(data.tracking_detail_line_list);
      if (trackingLines.length > 0) {
        return true;
      }
    }
  }

  const respResult = isRecord(response.resp_result) ? response.resp_result as Record<string, unknown> : null;
  const respPayload = respResult && isRecord(respResult.result) ? respResult.result as Record<string, unknown> : null;
  if (respPayload && Array.isArray(respPayload.categories) && respPayload.categories.length > 0) {
    return true;
  }

  return (Array.isArray(response.data) && response.data.length > 0)
    || (isRecord(response.result)
      && Array.isArray((response.result as Record<string, unknown>).data)
      && ((response.result as Record<string, unknown>).data as unknown[]).length > 0);
}

function isAlibabaBusinessSuccess(response: Record<string, unknown> | null) {
  const result = response?.result && typeof response.result === "object" ? response.result as Record<string, unknown> : null;
  const codes = [
    getStringValue(response?.result_code),
    getStringValue(response?.code),
    getStringValue(result?.result_code),
    getStringValue(result?.code),
    getStringValue(response?.success),
  ].filter(Boolean).map((value) => value!.trim().toLowerCase());

  if (codes.length === 0) {
    return true;
  }

  return codes.some((code) => code === "0" || code === "00" || code === "200" || code === "success" || code === "true" || code === "1");
}

function collectObjectNodes(value: unknown, depth = 0): Array<Record<string, unknown>> {
  if (depth > 4 || value == null || typeof value !== "object") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectObjectNodes(entry, depth + 1));
  }

  const record = value as Record<string, unknown>;
  return [
    record,
    ...Object.values(record).flatMap((entry) => collectObjectNodes(entry, depth + 1)),
  ];
}

function scoreAlibabaDetailRecord(record: Record<string, unknown>, sourceProductId: string) {
  let score = 0;
  const recordProductId = getStringValue(record.product_id) ?? getStringValue(record.productId);

  if (recordProductId === sourceProductId) {
    score += 5;
  }

  if (getStringValue(record.detail_url) || getStringValue(record.detailUrl)) {
    score += 3;
  }

  if (record.images != null || record.image != null || record.image_url_list != null || record.imageUrlList != null) {
    score += 2;
  }

  if (record.skus != null || record.sku_info != null || record.wholesale_trade != null || record.trade_info != null) {
    score += 3;
  }

  if (record.supplier != null || record.supplier_info != null || record.e_company_id != null) {
    score += 2;
  }

  if (record.attributes != null || record.key_attributes != null || record.keyattributes != null) {
    score += 1;
  }

  if (record.weight != null || record.logistics_info != null) {
    score += 1;
  }

  return score;
}

function extractAlibabaEcoBuyerDetailRecord(response: Record<string, unknown> | null, sourceProductId: string) {
  if (!response) {
    return null;
  }

  const candidates = collectObjectNodes(response)
    .filter((record) => scoreAlibabaDetailRecord(record, sourceProductId) > 0)
    .sort((left, right) => scoreAlibabaDetailRecord(right, sourceProductId) - scoreAlibabaDetailRecord(left, sourceProductId));

  return candidates[0] ?? null;
}

async function callAlibabaGetWithAppKeyFallback(pathOrUrl: string, payload: Record<string, unknown>, credentials: AlibabaCredentials) {
  let result = await callAlibabaEndpoint(pathOrUrl, payload, {
    credentials,
    method: "GET",
    systemParamsInHeaders: false,
  });
  let response = result.responseBody as Record<string, unknown> | null;

  if (isMissingAlibabaAppKeyMessage(extractAlibabaResponseMessage(response))) {
    result = await callAlibabaEndpoint(pathOrUrl, payload, {
      credentials,
      method: "GET",
      systemParamsInHeaders: true,
    });
    response = result.responseBody as Record<string, unknown> | null;
  }

  return { result, response };
}

async function fetchAlibabaEcoBuyerProductDetail(sourceProductId: string, credentials: AlibabaCredentials) {
  const payloadAttempts = [
    { query_req: { product_id: sourceProductId } },
    { query_req: { offer_id: sourceProductId } },
    { query_req: { productId: sourceProductId } },
  ];

  for (const payload of payloadAttempts) {
    const descriptionCall = await callAlibabaGetWithAppKeyFallback("/eco/buyer/product/description", payload, credentials);
    if (!descriptionCall.result.ok || !isAlibabaBusinessSuccess(descriptionCall.response)) {
      continue;
    }

    const descriptionRecord = extractAlibabaEcoBuyerDetailRecord(descriptionCall.response, sourceProductId);
    if (!descriptionRecord) {
      continue;
    }

    let keyattributesRecord: Record<string, unknown> | null = null;
    const queryReq = (payload.query_req && typeof payload.query_req === "object")
      ? payload.query_req as Record<string, unknown>
      : {};
    const keyattributesPayloads = [
      { query_req: { ...queryReq, attr_type: "ALL" } },
      { query_req: { ...queryReq, type: "ALL" } },
      payload,
    ];

    for (const keyPayload of keyattributesPayloads) {
      const keyattributesCall = await callAlibabaGetWithAppKeyFallback("/eco/buyer/product/keyattributes", keyPayload, credentials);
      if (!keyattributesCall.result.ok || !isAlibabaBusinessSuccess(keyattributesCall.response)) {
        continue;
      }

      keyattributesRecord = extractAlibabaEcoBuyerDetailRecord(keyattributesCall.response, sourceProductId)
        ?? (keyattributesCall.response ?? null);
      break;
    }

    return {
      ...descriptionRecord,
      eco_buyer_description: descriptionCall.response,
      eco_buyer_keyattributes: keyattributesRecord,
    };
  }

  return null;
}

async function fetchAlibabaProductDetail(sourceProductId: string, credentials?: AlibabaCredentials | null) {
  const resolvedCredentials = credentials ?? await resolveAlibabaCredentialsForLiveCall();
  if (!resolvedCredentials) {
    return null;
  }

  const ecoBuyerRecord = await fetchAlibabaEcoBuyerProductDetail(sourceProductId, resolvedCredentials);
  if (ecoBuyerRecord) {
    return ecoBuyerRecord;
  }

  const result = await getAlibabaIcbuProduct({ productId: sourceProductId });

  const response = result.responseBody as Record<string, unknown> | null;
  if (!result.ok || (response && response.success != null && !isTruthyAlibabaFlag(response.success))) {
    return null;
  }

  return extractAlibabaProductDetailRecord(response);
}

export async function fetchAlibabaProductSnapshot(input: {
  sourceProductId: string;
  query?: string;
  shipToCountry?: string;
  targetCurrency?: string;
  targetLanguage?: string;
  provinceCode?: string;
  cityCode?: string;
  supplierAccountId?: string;
}): Promise<AlibabaSearchProduct | null> {
  const snapshot = await fetchAlibabaProductSnapshotWithDebug(input);
  return snapshot.product;
}

export async function fetchAlibabaProductSnapshotWithDebug(input: {
  sourceProductId: string;
  query?: string;
  shipToCountry?: string;
  targetCurrency?: string;
  targetLanguage?: string;
  provinceCode?: string;
  cityCode?: string;
  supplierAccountId?: string;
}): Promise<{ product: AlibabaSearchProduct | null; debug: AlibabaExactProductSnapshotDebug }> {
  const query = input.query?.trim() || input.sourceProductId;
  const debug: AlibabaExactProductSnapshotDebug = {
    externalProductId: input.sourceProductId,
    shipToCountry: input.shipToCountry,
    targetCurrency: input.targetCurrency,
    targetLanguage: input.targetLanguage,
    attempts: [],
    fallbackUsed: false,
    responseShape: "empty_payload",
  };
  const credentials = await resolveAlibabaCredentialsForLiveCall({ accountId: input.supplierAccountId });

  if (isAliExpressCredentials(credentials)) {
    const contexts = buildAliExpressSearchContexts({
      preferredShipToCountry: input.shipToCountry,
      preferredLanguage: input.targetLanguage,
      preferredCurrency: input.targetCurrency,
    }).map((context) => ({
      shipToCountry: context.shipToCountry,
      local: input.targetLanguage ?? context.local,
      currency: input.targetCurrency ?? context.currency,
    })).filter((context, index, values) => values.findIndex((entry) => entry.shipToCountry === context.shipToCountry && entry.local === context.local && entry.currency === context.currency) === index);

    const recordAttempt = (attempt: AlibabaExactProductAttemptDebug, responseBody?: unknown) => {
      debug.attempts.push(attempt);
      debug.providerErrorCode = attempt.providerErrorCode ?? debug.providerErrorCode;
      debug.providerMessage = attempt.providerMessage ?? debug.providerMessage;
      debug.providerRequestId = attempt.providerRequestId ?? debug.providerRequestId;
      debug.responseShape = attempt.responseShape;

      console.info("[aliexpress-exact-import] attempt", {
        externalProductId: input.sourceProductId,
        ...attempt,
        payloadSummary: summarizeAliExpressExactProductPayload(responseBody),
      });
    };

    for (const context of contexts) {
      const detailResult = await getAlibabaIcbuProduct({
        productId: input.sourceProductId,
        shipToCountry: context.shipToCountry,
        targetCurrency: context.currency,
        targetLanguage: context.local,
        provinceCode: input.provinceCode,
        cityCode: input.cityCode,
      });
      const attemptBase = {
        endpoint: detailResult.endpoint,
        shipToCountry: context.shipToCountry,
        targetCurrency: context.currency,
        targetLanguage: context.local,
        ok: detailResult.ok,
        status: detailResult.status,
        providerErrorCode: extractAlibabaOperationCode(detailResult.responseBody),
        providerMessage: extractAlibabaOperationMessage(detailResult.responseBody),
        providerRequestId: findAlibabaFirstStringDeep(detailResult.responseBody, ["request_id", "requestId"]),
        responseShape: describeAliExpressExactProductResponseShape(detailResult.responseBody),
      } satisfies Omit<AlibabaExactProductAttemptDebug, "mappingStatus">;

      if (!detailResult.ok || !isAlibabaOperationSuccessful(detailResult.responseBody)) {
        recordAttempt({ ...attemptBase, mappingStatus: "provider_error" }, detailResult.responseBody);
        continue;
      }

      const mapped = mapAliExpressProductDetailToProduct({
        itemId: input.sourceProductId,
        product_id: input.sourceProductId,
      }, detailResult.responseBody, query);
      if (mapped?.sourceProductId === input.sourceProductId) {
        debug.resolvedRemoteMode = "ds_product";
        recordAttempt({ ...attemptBase, mappingStatus: "mapped" }, detailResult.responseBody);
        return { product: mapped, debug };
      }

      recordAttempt({ ...attemptBase, mappingStatus: "unmapped_payload" }, detailResult.responseBody);
    }

    for (const context of contexts) {
      const wholesaleResult = await getAlibabaIcbuWholesaleProduct({
        productId: input.sourceProductId,
        shipToCountry: context.shipToCountry,
        targetCurrency: context.currency,
        targetLanguage: context.local,
        provinceCode: input.provinceCode,
        cityCode: input.cityCode,
      });
      const attemptBase = {
        endpoint: wholesaleResult.endpoint,
        shipToCountry: context.shipToCountry,
        targetCurrency: context.currency,
        targetLanguage: context.local,
        ok: wholesaleResult.ok,
        status: wholesaleResult.status,
        providerErrorCode: extractAlibabaOperationCode(wholesaleResult.responseBody),
        providerMessage: extractAlibabaOperationMessage(wholesaleResult.responseBody),
        providerRequestId: findAlibabaFirstStringDeep(wholesaleResult.responseBody, ["request_id", "requestId"]),
        responseShape: describeAliExpressExactProductResponseShape(wholesaleResult.responseBody),
      } satisfies Omit<AlibabaExactProductAttemptDebug, "mappingStatus">;

      if (!wholesaleResult.ok || !isAlibabaOperationSuccessful(wholesaleResult.responseBody)) {
        recordAttempt({ ...attemptBase, mappingStatus: "provider_error" }, wholesaleResult.responseBody);
        continue;
      }

      const mapped = mapAliExpressProductDetailToProduct({
        itemId: input.sourceProductId,
        product_id: input.sourceProductId,
      }, wholesaleResult.responseBody, query);
      if (mapped?.sourceProductId === input.sourceProductId) {
        debug.resolvedRemoteMode = "ds_wholesale";
        debug.fallbackUsed = true;
        recordAttempt({ ...attemptBase, mappingStatus: "mapped" }, wholesaleResult.responseBody);
        return { product: mapped, debug };
      }

      recordAttempt({ ...attemptBase, mappingStatus: "unmapped_payload" }, wholesaleResult.responseBody);
    }

    const standardResult = await callAliExpressTopEndpoint("aliexpress.solution.product.info.get", {
      product_id: input.sourceProductId,
    }, {
      credentials,
      includeAccessToken: Boolean(credentials.accessToken),
    }).catch(() => null);

    if (standardResult) {
      const attemptBase = {
        endpoint: standardResult.endpoint,
        shipToCountry: input.shipToCountry,
        targetCurrency: input.targetCurrency,
        targetLanguage: input.targetLanguage,
        ok: standardResult.ok,
        status: standardResult.status,
        providerErrorCode: extractAlibabaOperationCode(standardResult.responseBody),
        providerMessage: extractAlibabaOperationMessage(standardResult.responseBody),
        providerRequestId: findAlibabaFirstStringDeep(standardResult.responseBody, ["request_id", "requestId"]),
        responseShape: describeAliExpressExactProductResponseShape(standardResult.responseBody),
      } satisfies Omit<AlibabaExactProductAttemptDebug, "mappingStatus">;

      if (!standardResult.ok || !isAlibabaOperationSuccessful(standardResult.responseBody)) {
        recordAttempt({ ...attemptBase, mappingStatus: "provider_error" }, standardResult.responseBody);
      } else {
        const mapped = mapAliExpressProductDetailToProduct(
          buildAliExpressFallbackSearchSeed(input.sourceProductId, standardResult.responseBody, query),
          standardResult.responseBody,
          query,
        ) ?? mapAliExpressSearchItemFallbackToProduct(
          buildAliExpressFallbackSearchSeed(input.sourceProductId, standardResult.responseBody, query),
          query,
          input.shipToCountry ?? process.env.ALIEXPRESS_DEFAULT_SHIP_TO_COUNTRY ?? "FR",
        );

        if (mapped?.sourceProductId === input.sourceProductId) {
          debug.resolvedRemoteMode = "standard_product";
          debug.fallbackUsed = true;
          recordAttempt({ ...attemptBase, mappingStatus: "mapped" }, standardResult.responseBody);
          return { product: mapped, debug };
        }

        recordAttempt({ ...attemptBase, mappingStatus: "unmapped_payload" }, standardResult.responseBody);
      }
    }

    const affiliateSnapshot = await fetchAliExpressAffiliateProductSnapshot({
      sourceProductId: input.sourceProductId,
      query,
      shipToCountry: input.shipToCountry,
      targetCurrency: input.targetCurrency,
      targetLanguage: input.targetLanguage,
      supplierAccountId: input.supplierAccountId,
    }).catch(() => null);

    if (affiliateSnapshot?.sourceProductId === input.sourceProductId) {
      debug.resolvedRemoteMode = "affiliate_exact";
      debug.fallbackUsed = true;
      recordAttempt({
        endpoint: "aliexpress.affiliate.product.sku.detail.get",
        shipToCountry: input.shipToCountry,
        targetCurrency: input.targetCurrency,
        targetLanguage: input.targetLanguage,
        ok: true,
        responseShape: "result_with_base_info_and_skus",
        mappingStatus: "mapped",
      }, affiliateSnapshot.rawPayload);
      return { product: affiliateSnapshot, debug };
    }

    recordAttempt({
      endpoint: "aliexpress.affiliate.product.sku.detail.get",
      shipToCountry: input.shipToCountry,
      targetCurrency: input.targetCurrency,
      targetLanguage: input.targetLanguage,
      ok: false,
      responseShape: "empty_result",
      mappingStatus: "fallback_failed",
    });

    return { product: null, debug };
  }

  const detailResult = await getAlibabaIcbuProduct({
    productId: input.sourceProductId,
    shipToCountry: input.shipToCountry,
    targetCurrency: input.targetCurrency,
    targetLanguage: input.targetLanguage,
    provinceCode: input.provinceCode,
    cityCode: input.cityCode,
  });

  const response = detailResult.responseBody as Record<string, unknown> | null;
  const detailRecord = response ? extractAlibabaProductDetailRecord(response) : null;

  if (!detailRecord) {
    return { product: null, debug };
  }

  const mapped = mapAlibabaIcbuProductToProduct(detailRecord, query)
    ?? mapAlibabaSearchResultToProduct(detailRecord, query);

  if (!mapped) {
    return { product: null, debug };
  }

  debug.resolvedRemoteMode = "icbu_product";
  return { product: enrichAlibabaSearchProduct(mapped, detailRecord), debug };
}

export async function getAlibabaIcbuProduct(input: {
  productId?: string | number;
  skuId?: string | number;
  shipToCountry?: string;
  targetCurrency?: string;
  targetLanguage?: string;
  removePersonalBenefit?: boolean;
  provinceCode?: string;
  cityCode?: string;
  bizModel?: string;
}) {
  if (!input.productId && !input.skuId) {
    throw new Error("product_id ou sku_id est obligatoire pour lire un produit Alibaba.");
  }

  const credentials = await resolveAlibabaCredentialsForLiveCall();
  if (isAliExpressCredentials(credentials) && input.productId) {
    return callAliExpressTopEndpoint("aliexpress.ds.product.get", {
      ship_to_country: String(input.shipToCountry ?? process.env.ALIEXPRESS_DEFAULT_SHIP_TO_COUNTRY ?? "US").trim().toUpperCase(),
      product_id: String(input.productId),
      target_currency: String(input.targetCurrency ?? process.env.ALIEXPRESS_DS_PAYMENT_CURRENCY ?? "USD").trim().toUpperCase(),
      target_language: String(input.targetLanguage ?? process.env.ALIEXPRESS_DEFAULT_LANGUAGE ?? "en_US").trim(),
      remove_personal_benefit: String(input.removePersonalBenefit ?? false),
      ...(String(input.provinceCode ?? "").trim() ? { province_code: String(input.provinceCode).trim() } : {}),
      ...(String(input.cityCode ?? "").trim() ? { city_code: String(input.cityCode).trim() } : {}),
      ...(String(input.bizModel ?? process.env.ALIEXPRESS_DS_BIZ_MODEL ?? "").trim() ? { biz_model: String(input.bizModel ?? process.env.ALIEXPRESS_DS_BIZ_MODEL).trim() } : {}),
    }, {
      credentials,
      method: "POST",
    });
  }

  return callAlibabaEndpoint("/alibaba/icbu/product/get/v2", {
    ...(input.productId ? { product_id: String(input.productId) } : {}),
    ...(input.skuId ? { sku_id: String(input.skuId) } : {}),
  }, {
    credentials,
    method: "GET",
  });
}

async function getAlibabaIcbuWholesaleProduct(input: {
  productId?: string | number;
  shipToCountry?: string;
  targetCurrency?: string;
  targetLanguage?: string;
  provinceCode?: string;
  cityCode?: string;
  bizModel?: string;
}) {
  if (!input.productId) {
    throw new Error("product_id est obligatoire pour lire un produit AliExpress DS wholesale.");
  }

  const credentials = await resolveAlibabaCredentialsForLiveCall();
  return callAliExpressTopEndpoint("aliexpress.ds.product.wholesale.get", {
    ship_to_country: String(input.shipToCountry ?? process.env.ALIEXPRESS_DEFAULT_SHIP_TO_COUNTRY ?? "US").trim().toUpperCase(),
    product_id: String(input.productId),
    target_currency: String(input.targetCurrency ?? process.env.ALIEXPRESS_DS_PAYMENT_CURRENCY ?? "USD").trim().toUpperCase(),
    target_language: String(input.targetLanguage ?? process.env.ALIEXPRESS_DEFAULT_LANGUAGE ?? "en_US").trim(),
    ...(String(input.provinceCode ?? "").trim() ? { province_code: String(input.provinceCode).trim() } : {}),
    ...(String(input.cityCode ?? "").trim() ? { city_code: String(input.cityCode).trim() } : {}),
    ...(String(input.bizModel ?? process.env.ALIEXPRESS_DS_BIZ_MODEL ?? "").trim() ? { biz_model: String(input.bizModel ?? process.env.ALIEXPRESS_DS_BIZ_MODEL).trim() } : {}),
  }, {
    credentials,
    method: "POST",
  });
}

function enrichAlibabaSearchProduct(product: AlibabaSearchProduct, detailRecord: Record<string, unknown> | null): AlibabaSearchProduct {
  if (!detailRecord) {
    return product;
  }

  const tradeInfo = (detailRecord.trade_info && typeof detailRecord.trade_info === "object") ? detailRecord.trade_info as Record<string, unknown> : {};
  const logisticsInfo = (detailRecord.logistics_info && typeof detailRecord.logistics_info === "object") ? detailRecord.logistics_info as Record<string, unknown> : {};
  const initialMoqInfo = resolveAlibabaMoq({
    rawValue: [detailRecord, tradeInfo],
    fallback: product.moq,
  });
  const detailPriceData = summarizeAlibabaPriceData({
    unit: product.unit,
    moq: initialMoqInfo.value ?? product.moq,
    values: [
      detailRecord.price,
      detailRecord.min_price,
      detailRecord.max_price,
      detailRecord.wholesale_trade,
      detailRecord.trade_info,
      detailRecord.price_info,
      (tradeInfo.price as { range_price?: { min_price?: unknown; max_price?: unknown } } | undefined)?.range_price,
      (tradeInfo.price as { tiered_price?: Array<{ price?: unknown }> } | undefined)?.tiered_price,
      detailRecord,
    ],
  });
  const fallbackPriceBounds = product.priceVerified
    ? {
        min: product.minUsd,
        max: product.maxUsd,
      }
    : {
        min: undefined,
        max: undefined,
      };
  const priceBounds = detailPriceData.verified ? { min: detailPriceData.min, max: detailPriceData.max } : fallbackPriceBounds;
  const moqInfo = resolveAlibabaMoq({
    rawValue: [detailRecord, tradeInfo],
    tiers: detailPriceData.tiers,
    fallback: product.moq,
  });
  const moq = moqInfo.value ?? product.moq;
  const weightFromLogistics = getNumberValue(logisticsInfo.weight);
  const extractedWeightGrams = extractWeightGrams(detailRecord) ?? sanitizeItemWeightGrams(weightFromLogistics ? Math.round(weightFromLogistics * (weightFromLogistics < 10 ? 1000 : 1)) : undefined);
  const weightGrams = resolveCoherentItemWeightGrams(extractedWeightGrams, {
    title: product.title,
    shortTitle: product.shortTitle,
    keywords: product.keywords,
    lotCbm: product.lotCbm,
    moq,
  });
  const images = extractImagesFromAlibabaRecord(detailRecord);
  const variantGroups = extractAlibabaVariantGroups(detailRecord);
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
    variantGroups: variantGroups.length > 0 ? variantGroups : product.variantGroups,
    tiers: detailPriceData.tiers.length > 0
      ? detailPriceData.tiers.map((tier) => ({
          quantityLabel: tier.quantityLabel,
          priceUsd: tier.priceUsd,
          note: tier.note,
        }))
      : product.tiers,
    moqVerified: moqInfo.verified,
    weightVerified: typeof weightGrams === "number" && weightGrams > 0,
    priceVerified: detailPriceData.verified || product.priceVerified === true,
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

  const unit = getStringValue(raw.unit) ?? getStringValue(raw.unit_name) ?? "piece";
  const initialMoqInfo = resolveAlibabaMoq({ rawValue: raw });
  const priceData = summarizeAlibabaPriceData({
    unit,
    moq: initialMoqInfo.value,
    values: [
      raw.min_price,
      raw.minPrice,
      raw.price,
      raw.sale_price,
      raw.max_price,
      raw.maxPrice,
      raw.priceRange,
      raw.price_range,
      raw.price_info,
      raw.wholesale_trade,
      raw,
    ],
  });
  const minUsd = priceData.min ?? 1;
  const maxUsd = priceData.max;
  const moqInfo = resolveAlibabaMoq({ rawValue: raw, tiers: priceData.tiers, fallback: 1 });
  const moq = moqInfo.value ?? 1;
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
  const extractedWeightGrams = extractWeightGrams(raw);
  const resolvedWeightGrams = resolveCoherentItemWeightGrams(extractedWeightGrams, {
    title,
    query,
    keywords,
    lotCbm: getStringValue(raw.cbm) ?? "0.01",
    moq,
  });
  const variantGroups = extractAlibabaVariantGroups(raw);

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
    itemWeightGrams: resolvedWeightGrams ?? 0,
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
    variantGroups,
    tiers: priceData.tiers.map((tier) => ({ quantityLabel: tier.quantityLabel, priceUsd: tier.priceUsd, note: tier.note })),
    specs,
    moqVerified: moqInfo.verified,
    weightVerified: typeof resolvedWeightGrams === "number" && resolvedWeightGrams > 0,
    priceVerified: priceData.verified,
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
  const unit = getStringValue(tradeInfo.unit) ?? "piece";
  const initialMoqInfo = resolveAlibabaMoq({ rawValue: [raw, tradeInfo] });
  const priceData = summarizeAlibabaPriceData({
    unit,
    moq: initialMoqInfo.value,
    values: [
      tradeInfo.price,
      tradeInfo.wholesale_trade,
      raw.wholesale_trade,
      skuInfo,
      raw.price_info,
      raw,
    ],
  });
  const minUsd = priceData.min ?? 1;
  const maxUsd = priceData.max;
  const moqInfo = resolveAlibabaMoq({ rawValue: [raw, tradeInfo], tiers: priceData.tiers, fallback: 1 });
  const moq = moqInfo.value ?? 1;
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
  const extractedWeightGrams = extractWeightGrams(raw);
  const verifiedWeightGrams = resolveCoherentItemWeightGrams(
    extractedWeightGrams ?? sanitizeItemWeightGrams(weight ? Math.round(weight * (weight < 10 ? 1000 : 1)) : undefined),
    {
      title,
      query,
      keywords,
      categoryTitle: getStringValue(categoryInfo.category_name),
      lotCbm: getStringValue(logisticsInfo.desi) ?? "0.01",
      moq,
    },
  );
  const variantGroups = extractAlibabaVariantGroups(raw, tradeInfo);

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
    unit,
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
    variantGroups,
    tiers: priceData.tiers.map((tier) => ({ quantityLabel: tier.quantityLabel, priceUsd: tier.priceUsd, note: tier.note })),
    specs,
    moqVerified: moqInfo.verified,
    weightVerified: typeof verifiedWeightGrams === "number" && verifiedWeightGrams > 0,
    priceVerified: priceData.verified,
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
      responseBody: { message: "AliExpress credentials are missing" },
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

async function callAliExpressTopEndpoint(apiMethod: string, payload: Record<string, unknown>, options?: {
  accessToken?: string;
  includeAccessToken?: boolean;
  credentials?: AlibabaCredentials | null;
  method?: "GET" | "POST";
}): Promise<AliExpressTopCallResult> {
  const credentials = options?.credentials ?? (options?.includeAccessToken === false ? await resolveAlibabaCredentials() : await resolveAlibabaCredentialsForLiveCall());
  if (!credentials) {
    return {
      ok: false,
      endpoint: apiMethod,
      requestBody: payload,
      responseBody: { message: "AliExpress credentials are missing" },
      status: 400,
    };
  }

  const query = new URLSearchParams();
  query.set("method", apiMethod);
  query.set("app_key", credentials.appKey);
  query.set("timestamp", String(Date.now()));
  query.set("sign_method", "sha256");
  if (options?.includeAccessToken !== false && (options?.accessToken ?? credentials.accessToken)) {
    query.set("access_token", options?.accessToken ?? credentials.accessToken ?? "");
  }

  for (const [key, value] of Object.entries(payload)) {
    query.set(key, serializeValue(value));
  }

  query.set("sign", signAliExpressTopRequest(apiMethod, query, credentials.appSecret));

  const requestUrl = `${normalizeBaseUrl(credentials.apiBaseUrl)}/sync`;
  const response = await fetch((options?.method ?? "POST") === "GET" ? `${requestUrl}?${query.toString()}` : requestUrl, {
    method: options?.method ?? "POST",
    headers: (options?.method ?? "POST") === "POST"
      ? { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" }
      : undefined,
    body: (options?.method ?? "POST") === "POST" ? query.toString() : undefined,
    cache: "no-store",
  });
  const text = await response.text();

  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // keep raw response
  }

  const apiLevelError = response.ok && isRecord(parsed) && isRecord((parsed as Record<string, unknown>).error_response);
  return {
    ok: response.ok && !apiLevelError,
    endpoint: apiMethod,
    requestBody: payload,
    responseBody: parsed,
    status: response.status,
  };
}

async function callAlibabaMultipartEndpoint(input: {
  pathOrUrl: string;
  payload: Record<string, unknown>;
  fileFieldName: string;
  fileName: string;
  fileBytes: Uint8Array;
  credentials?: AlibabaCredentials | null;
  includeAccessToken?: boolean;
  accessToken?: string;
}): Promise<AlibabaCallResult> {
  const credentials = input.credentials ?? (input.includeAccessToken === false ? await resolveAlibabaCredentials() : await resolveAlibabaCredentialsForLiveCall());
  if (!credentials) {
    return {
      ok: false,
      endpoint: input.pathOrUrl,
      requestBody: {
        ...input.payload,
        [input.fileFieldName]: { fileName: input.fileName, size: input.fileBytes.byteLength },
      },
      responseBody: { message: "AliExpress credentials are missing" },
      status: 400,
    };
  }

  const endpoint = resolveEndpoint({
    pathOrUrl: input.pathOrUrl,
    apiBaseUrl: credentials.apiBaseUrl,
  });

  const systemParams = new URLSearchParams();
  systemParams.set("app_key", credentials.appKey);
  systemParams.set("timestamp", String(Date.now()));
  systemParams.set("sign_method", "sha256");
  systemParams.set("simplify", "true");
  if (input.includeAccessToken !== false && (input.accessToken ?? credentials.accessToken)) {
    systemParams.set("access_token", input.accessToken ?? credentials.accessToken ?? "");
  }

  const payloadParams = new URLSearchParams();
  for (const [key, value] of Object.entries(input.payload)) {
    payloadParams.set(key, serializeValue(value));
  }

  const signingParams = new URLSearchParams(systemParams);
  for (const [key, value] of payloadParams.entries()) {
    signingParams.set(key, value);
  }

  const sign = signAlibabaRequest(endpoint.apiPath, signingParams, credentials.appSecret);
  const formData = new FormData();
  const uploadBytes = new Uint8Array(input.fileBytes.byteLength);
  uploadBytes.set(input.fileBytes);
  for (const [key, value] of payloadParams.entries()) {
    formData.append(key, value);
  }
  for (const [key, value] of systemParams.entries()) {
    formData.append(key, value);
  }
  formData.append("sign", sign);
  formData.append(input.fileFieldName, new Blob([uploadBytes]), input.fileName);

  const response = await fetch(endpoint.requestUrl, {
    method: "POST",
    body: formData,
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
    requestBody: {
      ...input.payload,
      [input.fileFieldName]: {
        fileName: input.fileName,
        size: input.fileBytes.byteLength,
      },
    },
    responseBody: parsed,
    status: response.status,
  };
}

async function refreshAlibabaAccountTokens(account: AlibabaSupplierAccount) {
  const credentials = getAccountCredentials(account);
  if (!credentials?.refreshToken) {
    throw new Error("Aucun refresh token Alibaba disponible.");
  }

  const refreshUrl = account.refreshUrl || credentials.refreshUrl;
  let result: Awaited<ReturnType<typeof callAlibabaEndpoint>> | null = null;

  for (const candidateUrl of getAliExpressOAuthEndpointCandidates(refreshUrl, "refresh")) {
    result = await callAlibabaEndpoint(candidateUrl, {
      refresh_token: credentials.refreshToken,
    }, {
      includeAccessToken: false,
      credentials,
    });

    if (result.ok && isAliExpressOAuthTokenResponseSuccessful(result.responseBody)) {
      break;
    }

    if (!shouldTryAliExpressOAuthAlternateEndpoint(result.responseBody) || candidateUrl === getAliExpressOAuthEndpointCandidates(refreshUrl, "refresh").at(-1)) {
      throw new Error(getAliExpressOAuthResponseMessage(result.responseBody) ?? "Refresh du token AliExpress impossible.");
    }
  }

  if (!result || !result.ok || !isAliExpressOAuthTokenResponseSuccessful(result.responseBody)) {
    throw new Error(result ? (getAliExpressOAuthResponseMessage(result.responseBody) ?? "Refresh du token AliExpress impossible.") : "Refresh du token AliExpress impossible.");
  }

  const body = getAliExpressOAuthResponseBody(result.responseBody) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: string | number;
    refresh_expires_in?: string | number;
    country?: string;
    locale?: string;
    account_id?: string;
    account?: string;
    account_platform?: string;
    havana_id?: string;
    seller_id?: string;
    user_id?: string;
    user_nick?: string;
    user_info?: { loginId?: string; seller_id?: string; user_id?: string };
  };

  const nextAccount: AlibabaSupplierAccount = {
    ...account,
    accountPlatform: mapAliExpressOAuthAccountPlatform(body.account_platform) ?? account.accountPlatform,
    accessToken: body.access_token ?? account.accessToken,
    refreshToken: body.refresh_token ?? account.refreshToken,
    accessTokenExpiresAt: body.expires_in ? new Date(Date.now() + Number(body.expires_in) * 1000).toISOString() : account.accessTokenExpiresAt,
    refreshTokenExpiresAt: body.refresh_expires_in ? new Date(Date.now() + Number(body.refresh_expires_in) * 1000).toISOString() : account.refreshTokenExpiresAt,
    oauthCountry: body.country ?? body.locale ?? account.oauthCountry,
    accountId: body.account_id ?? body.user_id ?? body.havana_id ?? account.accountId,
    accountLogin: body.account ?? body.user_nick ?? body.user_info?.loginId ?? account.accountLogin,
    accountName: body.user_nick ?? body.user_info?.loginId ?? account.accountName,
    memberId: body.seller_id ?? body.user_id ?? body.user_info?.seller_id ?? body.user_info?.user_id ?? account.memberId,
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

async function resolveAlibabaCredentialsForLiveCall(input?: { accountId?: string }) {
  const accounts = await getAlibabaSupplierAccounts();
  const eligible = accounts.filter((account) => account.status !== "disabled" && account.appKey && account.appSecret);
  const preferredAccount = input?.accountId
    ? eligible.find((account) => account.id === input.accountId)
      ?? null
    : eligible.find((account) => account.isActive && account.status === "connected")
    ?? eligible.find((account) => account.status === "connected")
    ?? eligible.find((account) => account.isActive && (account.accessToken || account.refreshToken))
    ?? eligible.find((account) => account.accessToken || account.refreshToken)
    ?? eligible.find((account) => account.isActive)
    ?? eligible[0]
    ?? null;

  if (!preferredAccount) {
    return getEnvCredentials();
  }

  if ((!preferredAccount.accessToken || isTokenExpiringSoon(preferredAccount.accessTokenExpiresAt)) && preferredAccount.refreshToken) {
    const refreshedAccount = await refreshAlibabaAccountTokens(preferredAccount);
    return getAccountCredentials(refreshedAccount) ?? getEnvCredentials();
  }

  const preferredCredentials = getAccountCredentials(preferredAccount);
  if (preferredCredentials?.accessToken) {
    return preferredCredentials;
  }

  return getEnvCredentials() ?? preferredCredentials;
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

function applyAliExpressMargin(priceUsd: number) {
  const marginRate = Number(process.env.ALIEXPRESS_MARGIN_RATE ?? "0.1");
  const configuredMargin = Number.isFinite(marginRate) && marginRate >= 0 ? marginRate : 0.1;
  const boundedMargin = Math.min(configuredMargin, 0.2);
  const dynamicMargin = priceUsd <= 5
    ? Math.min(boundedMargin, 0.05)
    : priceUsd <= 20
      ? Math.min(boundedMargin, 0.08)
      : boundedMargin;
  return Number((priceUsd * (1 + dynamicMargin)).toFixed(2));
}

function mapAliExpressSearchItemFallbackToProduct(
  searchItem: Record<string, unknown>,
  query: string,
  shipToCountry: string,
): AlibabaSearchProduct | null {
  const sourceProductId = getStringValue(searchItem.itemId)
    ?? getStringValue(searchItem.item_id)
    ?? getStringValue(searchItem.product_id)
    ?? getStringValue(searchItem.productId);
  if (!sourceProductId) {
    return null;
  }

  const gallery = uniqueStrings([
    ...collectStrings(searchItem.itemMainPic),
    ...collectStrings(searchItem.item_main_pic),
    ...collectStrings(searchItem.item_main_pic_url),
    ...collectStrings(searchItem.image_url),
    ...collectStrings(searchItem.imageUrl),
    ...collectStrings(searchItem.productMainImageUrl),
    ...collectStrings(searchItem.product_main_image_url),
    ...collectStrings(searchItem.productSmallImageUrls),
    ...collectStrings(searchItem.product_small_image_urls),
  ]);
  const primaryImage = gallery[0];
  if (!primaryImage) {
    return null;
  }

  const salePriceBounds = getPriceBounds(
    searchItem.targetSalePrice,
    searchItem.salePrice,
    searchItem.discountPrice,
    searchItem.appSalePrice,
    searchItem.target_sale_price,
    searchItem.sale_price,
    searchItem.discount_price,
    searchItem.app_sale_price,
    searchItem.min_price,
    searchItem.max_price,
  );
  const fallbackPriceBounds = getPriceBounds(
    searchItem.targetOriginalPrice,
    searchItem.originalPrice,
    searchItem.target_original_price,
    searchItem.original_price,
    searchItem.originMinPrice,
    searchItem.origin_min_price,
  );
  const minRawPrice = salePriceBounds.min ?? fallbackPriceBounds.min;
  if (!minRawPrice) {
    return null;
  }

  const title = getStringValue(searchItem.title)
    ?? getStringValue(searchItem.product_title)
    ?? getStringValue(searchItem.item_title)
    ?? getStringValue(searchItem.subject)
    ?? query;
  const minUsd = applyAliExpressMargin(minRawPrice);
  const maxCandidate = salePriceBounds.max ?? fallbackPriceBounds.max;
  const maxUsd = typeof maxCandidate === "number" ? applyAliExpressMargin(maxCandidate) : undefined;
  const soldCount = getStringValue(searchItem.orders)
    ?? getStringValue(searchItem.latest_volume)
    ?? getStringValue(searchItem.tradeDesc)
    ?? getStringValue(searchItem.trade_desc)
    ?? getStringValue(searchItem.sales_count)
    ?? getStringValue(searchItem.salesCount)
    ?? "0";
  const supplierName = getStringValue(searchItem.storeName)
    ?? getStringValue(searchItem.store_name)
    ?? getStringValue(searchItem.sellerName)
    ?? getStringValue(searchItem.seller_name)
    ?? getStringValue(searchItem.shop_name)
    ?? "Selection AfriPay+";
  const supplierLocation = getStringValue(searchItem.storeCountryCode)
    ?? getStringValue(searchItem.store_country_code)
    ?? getStringValue(searchItem.ship_from)
    ?? "CN";

  return {
    sourceProductId,
    slug: sourceProductId,
    title,
    shortTitle: title.slice(0, 96),
    keywords: title.toLowerCase().split(/[^a-z0-9]+/i).filter((entry) => entry.length > 2).slice(0, 12),
    image: primaryImage,
    gallery,
    packaging: "Selon catalogue",
    itemWeightGrams: 0,
    lotCbm: "0.0000",
    minUsd,
    maxUsd,
    moq: 1,
    unit: "piece",
    badge: "AfriPay+",
    supplierName,
    supplierLocation,
    responseTime: "AfriPay+",
    yearsInBusiness: 0,
    transactionsLabel: "Selection AfriPay+",
    soldLabel: `${soldCount} ventes`,
    customizationLabel: "Fiche verifiee AfriPay+",
    shippingLabel: "Expédition",
    overview: [
      "Selection verifiee AfriPay+",
      `${soldCount} ventes`,
      "Version importee depuis la selection AfriPay+.",
    ],
    variantGroups: [],
    tiers: [{ quantityLabel: "1+", priceUsd: minUsd }],
    specs: [
      { label: "Source", value: "Catalogue AfriPay+" },
      { label: "Destination", value: shipToCountry },
    ],
    inventory: 50,
    rawPayload: {
      provider: "aliexpress-ds",
      search: searchItem,
      detail: null,
      supplier_price_usd: minRawPrice,
      margin_rate: Number(process.env.ALIEXPRESS_MARGIN_RATE ?? "0.1"),
      fallback: true,
    },
    moqVerified: false,
    weightVerified: false,
    priceVerified: true,
  };
}

function buildAliExpressSearchContexts(input?: {
  preferredShipToCountry?: string;
  preferredLanguage?: string;
  preferredCurrency?: string;
}) {
  const configuredCountry = (input?.preferredShipToCountry ?? process.env.ALIEXPRESS_DEFAULT_SHIP_TO_COUNTRY ?? "FR").trim().toUpperCase();
  const configuredLanguage = (input?.preferredLanguage ?? process.env.ALIEXPRESS_TARGET_LANGUAGE ?? process.env.ALIEXPRESS_DEFAULT_LANGUAGE ?? "fr_FR").trim();
  const configuredCurrency = (input?.preferredCurrency ?? process.env.ALIEXPRESS_TARGET_CURRENCY ?? process.env.ALIEXPRESS_DS_PAYMENT_CURRENCY ?? "USD").trim().toUpperCase();

  const candidates = [
    { shipToCountry: configuredCountry || "FR", local: configuredLanguage || "fr_FR", currency: configuredCurrency || "USD" },
    { shipToCountry: configuredCountry || "FR", local: "en_US", currency: configuredCurrency || "USD" },
    { shipToCountry: "US", local: "en_US", currency: configuredCurrency || "USD" },
    { shipToCountry: "US", local: "fr_FR", currency: configuredCurrency || "USD" },
    { shipToCountry: "FR", local: "fr_FR", currency: configuredCurrency || "USD" },
    { shipToCountry: "FR", local: "en_US", currency: configuredCurrency || "USD" },
    { shipToCountry: "GB", local: "en_US", currency: configuredCurrency || "USD" },
  ];

  return candidates.filter((candidate, index, values) => values.findIndex((entry) => entry.shipToCountry === candidate.shipToCountry && entry.local === candidate.local && entry.currency === candidate.currency) === index);
}

const ALIEXPRESS_SEARCH_TOKEN_TRANSLATIONS: Record<string, string> = {
  bague: "ring",
  bagues: "rings",
  bracelet: "bracelet",
  bracelets: "bracelets",
  collier: "necklace",
  colliers: "necklaces",
  boucle: "earring",
  boucles: "earrings",
  montre: "watch",
  montres: "watches",
  chaussure: "shoes",
  chaussures: "shoes",
  robe: "dress",
  robes: "dresses",
  sac: "bag",
  sacs: "bags",
  portefeuille: "wallet",
  portefeuilles: "wallets",
  perruque: "wig",
  perruques: "wigs",
  carte: "card",
  graphique: "graphics",
  graphiques: "graphics",
  moniteur: "monitor",
  moniteurs: "monitors",
  ecran: "screen",
  ecrans: "screens",
  display: "monitor",
  creme: "cream",
  cremes: "creams",
  solaire: "sun",
  soleil: "sun",
  friteuse: "fryer",
  friteuses: "fryers",
  air: "air",
  gaming: "gaming",
  ordinateur: "computer",
  informatique: "computer",
  femme: "women",
  femmes: "women",
  homme: "men",
  hommes: "men",
  enfant: "kids",
  enfants: "kids",
};

const ALIEXPRESS_SEARCH_PHRASE_TRANSLATIONS: Array<[string, string[]]> = [
  ["carte graphique", ["graphics card", "gpu", "video card"]],
  ["creme solaire", ["sunscreen", "sun cream"]],
  ["moniteur de jeu", ["gaming monitor", "game monitor", "computer monitor"]],
  ["moniteur gaming", ["gaming monitor", "game monitor", "computer monitor"]],
  ["moniteur pc", ["computer monitor", "pc monitor", "desktop monitor"]],
  ["ecran gaming", ["gaming monitor", "gaming screen"]],
  ["ecran pc", ["computer monitor", "pc monitor"]],
  ["friteuse a air", ["air fryer", "airfryer"]],
  ["friteuse air", ["air fryer", "airfryer"]],
  ["case computer", ["computer case", "pc case"]],
];

function normalizeAliExpressSearchTerm(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeAliExpressHardwareTerms(value: string) {
  return value
    .replace(/(\d+)\s*(?:giga|gig|go)\b/gi, "$1gb")
    .replace(/\brx\s*(\d{3,4})\b/gi, "rx$1")
    .replace(/\brtx\s*(\d{3,4})\b/gi, "rtx$1")
    .replace(/\bgtx\s*(\d{3,4})\b/gi, "gtx$1")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAliExpressProductId(query: string) {
  const trimmed = query.trim();
  if (!trimmed) {
    return undefined;
  }

  const directMatch = trimmed.match(/(?:^|\D)(\d{12,20})(?:\D|$)/);
  if (directMatch?.[1]) {
    return directMatch[1];
  }

  try {
    const url = new URL(trimmed);
    const pathnameMatch = url.pathname.match(/\/item\/(\d{12,20})\.html/i);
    if (pathnameMatch?.[1]) {
      return pathnameMatch[1];
    }

    const xObjectId = url.searchParams.get("x_object_id");
    if (xObjectId && /^\d{12,20}$/.test(xObjectId)) {
      return xObjectId;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function buildAliExpressQueryCandidates(query: string) {
  const trimmed = query.trim();
  const normalized = normalizeAliExpressHardwareTerms(normalizeAliExpressSearchTerm(trimmed));
  const normalizedTokens = normalized.split(/\s+/g).map((token) => token.trim()).filter(Boolean);
  const translatedTokens = normalizedTokens.map((token) => ALIEXPRESS_SEARCH_TOKEN_TRANSLATIONS[token] ?? token);
  const translated = translatedTokens.join(" ").trim();
  const phraseTranslations = ALIEXPRESS_SEARCH_PHRASE_TRANSLATIONS
    .filter(([phrase]) => normalized.includes(phrase))
    .flatMap(([, translations]) => translations);
  const informativeTokens = uniqueStrings([
    ...translatedTokens,
    ...normalizedTokens,
  ]).filter((token) => token.length >= 3 && token !== "women" && token !== "men" && token !== "kids" && !/^\d+$/.test(token));
  const shortestUsefulTranslation = informativeTokens[0] ?? "";
  const longestUsefulTranslation = [...informativeTokens].sort((left, right) => right.length - left.length)[0] ?? "";

  return uniqueStrings([
    trimmed,
    normalized !== trimmed.toLowerCase() ? normalized : "",
    translated !== normalized ? translated : "",
    ...phraseTranslations,
    ...informativeTokens,
    shortestUsefulTranslation,
    longestUsefulTranslation,
  ]).filter((entry) => entry.length > 0);
}

const ALIEXPRESS_RELEVANCE_STOPWORDS = new Set([
  "de",
  "du",
  "des",
  "la",
  "le",
  "les",
  "pour",
  "avec",
  "sur",
  "and",
  "the",
  "for",
  "with",
  "from",
  "of",
]);

const ALIEXPRESS_GAMING_TERMS = ["gaming", "game", "gamer", "jeu", "esport"];
const ALIEXPRESS_MONITOR_TERMS = ["monitor", "monitors", "screen", "screens", "display", "displays"];
const ALIEXPRESS_MONITOR_ACCESSORY_TERMS = ["hdmi", "cable", "cables", "adapter", "adapters", "support", "supports", "mount", "stand", "bracket", "splitter", "converter"];

function normalizeAliExpressRelevanceText(value: string) {
  return normalizeAliExpressHardwareTerms(normalizeAliExpressSearchTerm(value))
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeAliExpressRelevanceText(value: string) {
  const normalized = normalizeAliExpressRelevanceText(value);
  if (!normalized) {
    return [] as string[];
  }

  const baseTokens = normalized.split(" ").filter(Boolean);
  const translatedTokens = baseTokens.map((token) => ALIEXPRESS_SEARCH_TOKEN_TRANSLATIONS[token] ?? token);
  return uniqueStrings([...baseTokens, ...translatedTokens]);
}

function scoreAliExpressSearchProductRelevance(product: AlibabaSearchProduct, query: string) {
  const queryTokens = tokenizeAliExpressRelevanceText(query)
    .filter((token) => token.length >= 3 && !ALIEXPRESS_RELEVANCE_STOPWORDS.has(token) && !/^\d+$/.test(token));
  const normalizedQuery = normalizeAliExpressRelevanceText(query);
  const productText = normalizeAliExpressRelevanceText([
    product.title,
    product.shortTitle,
    ...(Array.isArray(product.keywords) ? product.keywords : []),
    ...(Array.isArray(product.overview) ? product.overview : []),
  ].join(" "));
  const titleText = normalizeAliExpressRelevanceText([product.title, product.shortTitle].join(" "));
  const productTokenSet = new Set(tokenizeAliExpressRelevanceText(productText));
  const titleTokenSet = new Set(tokenizeAliExpressRelevanceText(titleText));

  const matchCount = queryTokens.reduce((count, token) => (productTokenSet.has(token) ? count + 1 : count), 0);
  const titleMatchCount = queryTokens.reduce((count, token) => (titleTokenSet.has(token) ? count + 1 : count), 0);
  const phraseMatch = normalizedQuery.length >= 6 && productText.includes(normalizedQuery);
  const hasGamingIntent = ALIEXPRESS_GAMING_TERMS.some((term) => normalizedQuery.includes(term));
  const hasGamingToken = ALIEXPRESS_GAMING_TERMS.some((term) => productTokenSet.has(term));
  const hasMonitorIntent = queryTokens.some((token) => ALIEXPRESS_MONITOR_TERMS.includes(token));
  const hasMonitorToken = ALIEXPRESS_MONITOR_TERMS.some((term) => productTokenSet.has(term));
  const accessoryOnlyForMonitorIntent = hasMonitorIntent
    && !hasMonitorToken
    && ALIEXPRESS_MONITOR_ACCESSORY_TERMS.some((term) => productTokenSet.has(term));

  let strictMatch = false;
  if (queryTokens.length <= 1) {
    strictMatch = matchCount >= 1 || phraseMatch;
  } else {
    strictMatch = matchCount >= 2 || phraseMatch;
  }

  if (hasGamingIntent && !hasGamingToken) {
    strictMatch = false;
  }

  if (hasMonitorIntent && !hasMonitorToken) {
    strictMatch = false;
  }

  if (accessoryOnlyForMonitorIntent) {
    strictMatch = false;
  }

  const score = (matchCount * 4)
    + (titleMatchCount * 2)
    + (phraseMatch ? 8 : 0)
    + (hasGamingIntent && hasGamingToken ? 4 : 0)
    + (hasMonitorIntent && hasMonitorToken ? 5 : 0)
    - (accessoryOnlyForMonitorIntent ? 12 : 0);

  return {
    score,
    strictMatch,
  };
}

function shouldAllowLooseAliExpressMatches(query: string) {
  const queryTokens = tokenizeAliExpressRelevanceText(query)
    .filter((token) => token.length >= 3 && !ALIEXPRESS_RELEVANCE_STOPWORDS.has(token) && !/^\d+$/.test(token));

  return queryTokens.length <= 1;
}

function mapAliExpressProductDetailToProduct(
  searchItem: Record<string, unknown>,
  detailResponseBody: unknown,
  query: string,
): AlibabaSearchProduct | null {
  const detailResult = getAliExpressSellerPayload(detailResponseBody);
  if (!detailResult) {
    return null;
  }

  const baseInfo = isRecord(detailResult.ae_item_base_info_dto) ? detailResult.ae_item_base_info_dto as Record<string, unknown> : {};
  const multimedia = isRecord(detailResult.ae_multimedia_info_dto) ? detailResult.ae_multimedia_info_dto as Record<string, unknown> : {};
  const storeInfo = isRecord(detailResult.ae_store_info) ? detailResult.ae_store_info as Record<string, unknown> : {};
  const packageInfo = isRecord(detailResult.package_info_dto) ? detailResult.package_info_dto as Record<string, unknown> : {};
  const logisticsInfo = isRecord(detailResult.logistics_info_dto) ? detailResult.logistics_info_dto as Record<string, unknown> : {};
  const skuInfo = Array.isArray(detailResult.ae_item_sku_info_dtos)
    ? detailResult.ae_item_sku_info_dtos as Array<Record<string, unknown>>
    : Array.isArray(detailResult.sku_info)
      ? detailResult.sku_info as Array<Record<string, unknown>>
      : [];
  const properties = Array.isArray(detailResult.ae_item_properties) ? detailResult.ae_item_properties as Array<Record<string, unknown>> : [];
  const videoDtos = Array.isArray(multimedia.ae_video_dtos) ? multimedia.ae_video_dtos as Array<Record<string, unknown>> : [];

  const sourceProductId = getStringValue(baseInfo.product_id) ?? getStringValue(searchItem.itemId) ?? getStringValue(searchItem.product_id);
  if (!sourceProductId) {
    return null;
  }

  const gallery = uniqueStrings([
    ...splitAliExpressImages(multimedia.image_urls),
    ...splitAliExpressImages(getStringValue(multimedia.image_url)),
    ...splitAliExpressImages(getStringValue(baseInfo.image_urls)),
    ...splitAliExpressImages(getStringValue(detailResult.image_urls)),
    ...collectStrings(searchItem.itemMainPic),
    ...collectStrings(searchItem.product_main_image_url),
    ...collectStrings(searchItem.productMainImageUrl),
    ...collectStrings([
      multimedia.image_url,
      baseInfo.image_url,
      detailResult.main_image_url,
      detailResult.product_main_image_url,
      detailResult.image_url,
    ]),
  ].filter(Boolean));
  const primaryImage = gallery[0];
  if (!primaryImage) {
    return null;
  }

  const skuPrices = skuInfo
    .map((sku) => getNumberValue(sku.offer_sale_price, sku.sku_price))
    .filter((value): value is number => typeof value === "number" && value > 0);
  const detailSalePriceBounds = getPriceBounds(
    detailResult.targetSalePrice,
    detailResult.salePrice,
    detailResult.discountPrice,
    detailResult.target_sale_price,
    detailResult.sale_price,
    detailResult.discount_price,
    detailResult.min_price,
    detailResult.max_price,
    detailResult.price,
    baseInfo.target_sale_price,
    baseInfo.sale_price,
    baseInfo.discount_price,
    baseInfo.min_price,
    baseInfo.max_price,
  );
  const searchSalePriceBounds = getPriceBounds(
    searchItem.targetSalePrice,
    searchItem.salePrice,
    searchItem.discountPrice,
    searchItem.appSalePrice,
    searchItem.target_sale_price,
    searchItem.sale_price,
    searchItem.discount_price,
    searchItem.app_sale_price,
    searchItem.min_price,
    searchItem.max_price,
  );
  const searchFallbackPriceBounds = getPriceBounds(
    searchItem.targetOriginalPrice,
    searchItem.originalPrice,
    searchItem.target_original_price,
    searchItem.original_price,
  );
  const detailFallbackPriceBounds = getPriceBounds(
    detailResult.targetOriginalPrice,
    detailResult.originalPrice,
    detailResult.target_original_price,
    detailResult.original_price,
    baseInfo.target_original_price,
    baseInfo.original_price,
  );
  const minRawPrice = skuPrices.length > 0
    ? Math.min(...skuPrices)
    : (detailSalePriceBounds.min ?? searchSalePriceBounds.min ?? detailFallbackPriceBounds.min ?? searchFallbackPriceBounds.min);
  if (!minRawPrice) {
    return null;
  }

  const maxRawPrice = skuPrices.length > 1
    ? Math.max(...skuPrices)
    : (detailSalePriceBounds.max ?? searchSalePriceBounds.max ?? detailFallbackPriceBounds.max ?? searchFallbackPriceBounds.max);
  const moq = skuInfo
    .map((sku) => getNumberValue(sku.sku_bulk_order))
    .filter((value): value is number => typeof value === "number" && value > 0)[0] ?? 1;
  const stock = skuInfo.reduce((max, sku) => {
    const value = getNumberValue(sku.sku_available_stock);
    return typeof value === "number" ? Math.max(max, value) : max;
  }, 0);
  const title = getStringValue(baseInfo.subject) ?? getStringValue(detailResult.subject) ?? getStringValue(detailResult.product_title) ?? getStringValue(detailResult.title) ?? getStringValue(searchItem.title) ?? query;
  const keywords = title.toLowerCase().split(/[^a-z0-9]+/i).filter((entry) => entry.length > 2).slice(0, 12);
  const extractedWeightGrams = extractWeightGrams(detailResult)
    ?? extractWeightGrams(detailResponseBody)
    ?? sanitizeItemWeightGrams(
      (() => {
        const weightKg = getNumberValue(packageInfo.gross_weight);
        if (typeof weightKg !== "number") {
          return undefined;
        }

        return Math.round(weightKg * (weightKg < 10 ? 1000 : 1));
      })(),
    );
  const packageLength = getNumberValue(packageInfo.package_length) ?? 20;
  const packageWidth = getNumberValue(packageInfo.package_width) ?? 15;
  const packageHeight = getNumberValue(packageInfo.package_height) ?? 8;
  const packageDimensionsCm = {
    lengthCm: packageLength,
    widthCm: packageWidth,
    heightCm: packageHeight,
  };
  const lotCbm = ((packageLength * packageWidth * packageHeight) / 1_000_000).toFixed(4);
  const weightGrams = resolveCoherentItemWeightGrams(extractedWeightGrams, {
    title,
    shortTitle: title.slice(0, 96),
    query,
    keywords,
    lotCbm,
    moq,
  });
  const variantGroups = [...new Map(
    skuInfo.flatMap((sku) => {
      const propertyDtos = Array.isArray(sku.ae_sku_property_dtos) ? sku.ae_sku_property_dtos as Array<Record<string, unknown>> : [];
      return propertyDtos.map((property) => ({
        label: getStringValue(property.sku_property_name) ?? "Option",
        value: getStringValue(property.property_value_definition_name) ?? getStringValue(property.sku_property_value) ?? "Valeur",
      }));
    }).map((entry) => [`${entry.label}:${entry.value}`, entry]),
  ).values()].reduce<Array<{ label: string; values: string[] }>>((groups, entry) => {
    const current = groups.find((group) => group.label === entry.label);
    if (current) {
      if (!current.values.includes(entry.value)) {
        current.values.push(entry.value);
      }
      return groups;
    }

    return [...groups, { label: entry.label, values: [entry.value] }];
  }, []);
  const variantPricing = skuInfo.flatMap((sku, index) => {
    const propertyDtos = Array.isArray(sku.ae_sku_property_dtos) ? sku.ae_sku_property_dtos as Array<Record<string, unknown>> : [];
    const selections = Object.fromEntries(propertyDtos.map((property, propertyIndex) => [
      getStringValue(property.sku_property_name) ?? `Option ${propertyIndex + 1}`,
      getStringValue(property.property_value_definition_name) ?? getStringValue(property.sku_property_value) ?? "Valeur",
    ]));

    if (Object.keys(selections).length === 0) {
      return [];
    }

    const skuPriceUsd = applyAliExpressMargin(getNumberValue(sku.offer_sale_price, sku.sku_price) ?? minRawPrice);
    if (!Number.isFinite(skuPriceUsd) || skuPriceUsd <= 0) {
      return [];
    }

    return [{
      selections,
      priceUsd: skuPriceUsd,
      minPriceUsd: skuPriceUsd,
      minimumQuantity: Math.max(1, Math.round(getNumberValue(sku.sku_bulk_order) ?? moq)),
      quantityLabel: `${Math.max(1, Math.round(getNumberValue(sku.sku_bulk_order) ?? moq))}+`,
      note: getStringValue(sku.sku_attr) ?? `SKU ${index + 1}`,
    }];
  });
  const specs = properties.slice(0, 12).map((property) => ({
    label: getStringValue(property.attr_name) ?? "Attribut",
    value: getStringValue(property.attr_value) ?? getStringValue(property.attr_value_start) ?? "-",
  }));
  const minUsd = applyAliExpressMargin(minRawPrice);
  const maxUsd = typeof maxRawPrice === "number" ? applyAliExpressMargin(maxRawPrice) : undefined;
  const tiers = skuInfo.slice(0, 6).map((sku, index) => ({
    quantityLabel: `${Math.max(1, Math.round(getNumberValue(sku.sku_bulk_order) ?? moq))}+`,
    priceUsd: applyAliExpressMargin(getNumberValue(sku.offer_sale_price, sku.sku_price) ?? minRawPrice),
    note: getStringValue(sku.sku_attr) ?? `SKU ${index + 1}`,
  }));
  const variantSkus = skuInfo.flatMap((sku) => {
    const skuId = getStringValue(sku.sku_id) ?? getStringValue(sku.id);
    if (!skuId) {
      return [] as ProductVariantSku[];
    }

    const propertyDtos = Array.isArray(sku.ae_sku_property_dtos) ? sku.ae_sku_property_dtos as Array<Record<string, unknown>> : [];

    return [{
      skuId,
      skuCode: getStringValue(sku.sku_code),
      inventory: getNumberValue(sku.sku_available_stock) ?? undefined,
      image: getStringValue(sku.sku_image) ?? getStringValue(sku.image_url),
      selections: Object.fromEntries(propertyDtos.map((property, index) => [
        getStringValue(property.sku_property_name) ?? `Option ${index + 1}`,
        getStringValue(property.property_value_definition_name) ?? getStringValue(property.sku_property_value) ?? "Valeur",
      ])),
    } satisfies ProductVariantSku];
  });
  const hasSkuVariants = variantSkus.length > 0;
  const sourceUrl = getStringValue(detailResult.original_link)
    ?? getStringValue(detailResult.detail_url)
    ?? getStringValue(detailResult.product_detail_url)
    ?? getStringValue(baseInfo.detail_url)
    ?? getStringValue(baseInfo.product_detail_url)
    ?? `https://www.aliexpress.com/item/${sourceProductId}.html`;
  const warnings = hasSkuVariants ? [] : ["Produit trouve, mais aucun SKU DS exploitable n'a ete renvoye par l'API AliExpress."];

  return {
    sourceProductId,
    slug: sourceProductId,
    title,
    shortTitle: title.slice(0, 96),
    keywords,
    image: primaryImage,
    gallery,
    videoUrl: getStringValue(videoDtos[0]?.media_url),
    videoPoster: getStringValue(videoDtos[0]?.poster_url) ?? primaryImage,
    packaging: `${packageLength} x ${packageWidth} x ${packageHeight} cm`,
    packageDimensionsCm,
    itemWeightGrams: weightGrams ?? 0,
    lotCbm,
    minUsd,
    maxUsd,
    moq,
    unit: "piece",
    badge: "AfriPay+",
    supplierName: getStringValue(storeInfo.store_name) ?? "AfriPay+",
    supplierLocation: "AfriPay+",
    supplierCompanyId: getStringValue(storeInfo.store_id),
    responseTime: "AfriPay+",
    yearsInBusiness: 0,
    transactionsLabel: `${getStringValue(baseInfo.evaluation_count) ?? "0"} avis`,
    soldLabel: `${getStringValue(baseInfo.sales_count) ?? "0"} ventes`,
    customizationLabel: hasSkuVariants ? "Attributs et variantes synchronises" : "Produit importe sans SKU DS exploitable",
    shippingLabel: "Expédition",
    overview: [
      "Selection verifiee AfriPay+",
      `${getStringValue(baseInfo.sales_count) ?? "0"} ventes · note ${getStringValue(baseInfo.avg_evaluation_rating) ?? "n/a"}`,
      `Livraison estimée ${getStringValue(logisticsInfo.delivery_time) ?? "variable"} jour(s)`,
      ...warnings,
    ],
    variantGroups,
    variantPricing,
    variantSkus,
    tiers: tiers.length > 0 ? tiers : [{ quantityLabel: `${moq}+`, priceUsd: minUsd }],
    specs,
    inventory: stock > 0 ? stock : 50,
    rawPayload: {
      provider: "aliexpress-ds",
      search: searchItem,
      detail: detailResponseBody,
      source_url: sourceUrl,
      warnings,
      response_has_skus: skuInfo.length > 0,
      supplier_price_usd: minRawPrice,
      margin_rate: Number(process.env.ALIEXPRESS_MARGIN_RATE ?? "0.1"),
    },
    moqVerified: true,
    weightVerified: typeof weightGrams === "number" && weightGrams > 0,
    priceVerified: minUsd > 0,
  };
}

async function searchAliExpressProducts(input: {
  query: string;
  limit: number;
  preferredShipToCountry?: string;
  preferredLanguage?: string;
  preferredCurrency?: string;
  supplierAccountId?: string;
}): Promise<AlibabaProductSearchResult> {
  const credentials = await resolveAlibabaCredentialsForLiveCall({ accountId: input.supplierAccountId });
  if (!credentials) {
    return {
      ok: false,
      endpoint: "aliexpress.ds.text.search",
      responseBody: null,
      products: [],
      errorMessage: "Identifiants AliExpress manquants.",
    };
  }

  const searchContexts = buildAliExpressSearchContexts({
    preferredShipToCountry: input.preferredShipToCountry,
    preferredLanguage: input.preferredLanguage,
    preferredCurrency: input.preferredCurrency,
  });
  const desiredCount = Math.min(Math.max(input.limit, 1), 40);
  const pageSize = Math.min(20, desiredCount);
  const maxPages = Math.max(1, Math.ceil(desiredCount / pageSize));
  const maxCollectedCandidates = Math.max(desiredCount * 4, 40);
  const collectedByProductId = new Map<string, {
    product: AlibabaSearchProduct;
    score: number;
    strictMatch: boolean;
  }>();
  const queryCandidates = buildAliExpressQueryCandidates(input.query);
  const directProductId = extractAliExpressProductId(input.query);
  let lastResponse: unknown = null;
  let lastSearchError: AlibabaProductSearchResult | null = null;
  const getStrictMatchCount = () => {
    let count = 0;
    for (const candidate of collectedByProductId.values()) {
      if (candidate.strictMatch) {
        count += 1;
      }
    }

    return count;
  };

  if (directProductId) {
    for (const context of searchContexts) {
      const detailResult = await callAliExpressTopEndpoint("aliexpress.ds.product.get", {
        ship_to_country: context.shipToCountry,
        product_id: directProductId,
        target_currency: context.currency,
        target_language: context.local,
        remove_personal_benefit: "false",
      }, {
        credentials,
        method: "POST",
      });
      lastResponse = detailResult.responseBody;

      if (!detailResult.ok) {
        continue;
      }

      const searchSeed = {
        itemId: directProductId,
        product_id: directProductId,
      } satisfies Record<string, unknown>;
      const normalized = mapAliExpressProductDetailToProduct(searchSeed, detailResult.responseBody, input.query)
        ?? mapAliExpressSearchItemFallbackToProduct(searchSeed, input.query, context.shipToCountry);

      if (!normalized) {
        continue;
      }

      return {
        ok: true,
        endpoint: "aliexpress.ds.product.get",
        responseBody: lastResponse,
        products: [normalized],
      };
    }
  }

  for (const queryCandidate of queryCandidates) {
    for (const context of searchContexts) {
      for (let pageIndex = 1; pageIndex <= maxPages && collectedByProductId.size < maxCollectedCandidates; pageIndex += 1) {
        const searchResult = await callAliExpressTopEndpoint("aliexpress.ds.text.search", {
          keyWord: queryCandidate,
          local: context.local,
          countryCode: context.shipToCountry,
          sortBy: "orders,desc",
          pageSize,
          pageIndex,
          currency: context.currency,
        }, {
          credentials,
          method: "POST",
        });
        lastResponse = searchResult.responseBody;
        if (!searchResult.ok) {
          if (collectedByProductId.size > 0) {
            break;
          }

          const apiError = isRecord(searchResult.responseBody) && isRecord((searchResult.responseBody as Record<string, unknown>).error_response)
            ? searchResult.responseBody.error_response as Record<string, unknown>
            : null;
          const apiErrorMsg = apiError
            ? (getStringValue(apiError.en_desc) ?? getStringValue(apiError.sub_msg) ?? getStringValue(apiError.zh_desc))
            : undefined;
          lastSearchError = {
            ok: false,
            endpoint: "aliexpress.ds.text.search",
            responseBody: searchResult.responseBody,
            products: [],
            errorMessage: apiErrorMsg
              ? `AliExpress DS: ${apiErrorMsg}`
              : "Recherche AliExpress DS impossible.",
          };

          continue;
        }

        const payload = getAliExpressSellerPayload(searchResult.responseBody);
        const products = extractAliExpressSearchItems(payload);
        if (products.length === 0) {
          break;
        }

        for (const searchItem of products) {
          const productId = getStringValue(searchItem.itemId)
            ?? getStringValue(searchItem.item_id)
            ?? getStringValue(searchItem.product_id)
            ?? getStringValue(searchItem.productId);
          if (!productId) {
            continue;
          }

          let normalized: AlibabaSearchProduct | null = null;
          const detailResult = await callAliExpressTopEndpoint("aliexpress.ds.product.get", {
            ship_to_country: context.shipToCountry,
            product_id: productId,
            target_currency: context.currency,
            target_language: context.local,
            remove_personal_benefit: "false",
          }, {
            credentials,
            method: "POST",
          });

          if (detailResult.ok) {
            normalized = mapAliExpressProductDetailToProduct(searchItem, detailResult.responseBody, input.query);
          }

          if (!normalized) {
            normalized = mapAliExpressSearchItemFallbackToProduct(searchItem, input.query, context.shipToCountry);
          }

          if (!normalized) {
            continue;
          }

          const relevance = scoreAliExpressSearchProductRelevance(normalized, input.query);
          const existing = collectedByProductId.get(productId);

          if (!existing || relevance.score > existing.score || (relevance.strictMatch && !existing.strictMatch)) {
            collectedByProductId.set(productId, {
              product: normalized,
              score: relevance.score,
              strictMatch: relevance.strictMatch,
            });
          }

          if (collectedByProductId.size >= maxCollectedCandidates) {
            break;
          }
        }

        if (getStrictMatchCount() >= desiredCount) {
          break;
        }
      }

      if (getStrictMatchCount() >= desiredCount) {
        break;
      }
    }

    if (getStrictMatchCount() >= desiredCount) {
      break;
    }
  }

  const strictMatches = [...collectedByProductId.values()]
    .filter((entry) => entry.strictMatch)
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.product);
  const looseMatches = [...collectedByProductId.values()]
    .filter((entry) => !entry.strictMatch)
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.product);
  const foundProducts = shouldAllowLooseAliExpressMatches(input.query)
    ? [...strictMatches, ...looseMatches].slice(0, desiredCount)
    : strictMatches.slice(0, desiredCount);

  console.error("[aliexpress/import] no usable DS products", {
    query: input.query,
    queryCandidates,
    directProductId,
    searchContexts,
    lastResponse,
    strictMatches: strictMatches.length,
    looseMatches: looseMatches.length,
  });

  return {
    ok: foundProducts.length > 0,
    endpoint: "aliexpress.ds.text.search",
    responseBody: foundProducts.length > 0 ? lastResponse : (lastSearchError?.responseBody ?? lastResponse),
    products: foundProducts,
    errorMessage: foundProducts.length > 0
      ? undefined
      : lastSearchError?.errorMessage ?? "Aucun produit AliExpress exploitable n'a été trouvé. Essaie un mot-cle plus simple ou verifie le pays de destination configure.",
  };
}

function affiliateLanguageCode(local: string) {
  const mapping: Record<string, string> = {
    "fr_fr": "FR",
    "en_us": "EN",
    "ar_ma": "AR",
    "pt_br": "PT",
    "es_es": "ES",
    "de_de": "DE",
    "it_it": "IT",
    "tr_tr": "TR",
    "nl_nl": "NL",
    "pl_pl": "PL",
    "ru_ru": "RU",
    "id_id": "ID",
    "th_th": "TH",
    "vi_vn": "VI",
  };
  return mapping[local.toLowerCase()] ?? local.slice(0, 2).toUpperCase();
}

function extractAliExpressAffiliateItems(responseBody: unknown): Array<Record<string, unknown>> {
  const payload = getAliExpressSellerPayload(responseBody);
  if (!isRecord(payload)) {
    return [];
  }

  const productsNode = isRecord(payload.products) ? payload.products as Record<string, unknown> : null;
  if (productsNode) {
    if (Array.isArray(productsNode.product)) {
      return (productsNode.product as unknown[]).filter(isRecord) as Array<Record<string, unknown>>;
    }
    if (Array.isArray(productsNode.string)) {
      return (productsNode.string as unknown[]).filter(isRecord) as Array<Record<string, unknown>>;
    }
  }

  if (Array.isArray(payload.products)) {
    return (payload.products as unknown[]).filter(isRecord) as Array<Record<string, unknown>>;
  }

  return extractAliExpressSearchItems(payload);
}

function mapAliExpressAffiliateItemToProduct(
  item: Record<string, unknown>,
  query: string,
  shipToCountry: string,
): AlibabaSearchProduct | null {
  const productId = getStringValue(item.product_id) ?? getStringValue(item.productId);
  if (!productId) {
    return null;
  }

  const mainImage = getStringValue(item.product_main_image_url) ?? getStringValue(item.productMainImageUrl) ?? getStringValue(item.image_url);
  if (!mainImage) {
    return null;
  }

  const smallImages: string[] = [];
  if (isRecord(item.product_small_image_urls)) {
    const container = item.product_small_image_urls as Record<string, unknown>;
    const list = Array.isArray(container.string) ? container.string : Array.isArray(container.url) ? container.url : [];
    smallImages.push(...(list as unknown[]).filter((entry): entry is string => typeof entry === "string").filter(Boolean));
  }
  const gallery = uniqueStrings([mainImage, ...smallImages]);

  const rawPrice = getStringValue(item.target_sale_price)
    ?? getStringValue(item.sale_price)
    ?? getStringValue(item.app_sale_price)
    ?? getStringValue(item.sale_price_min);
  const minRawPrice = rawPrice ? Number(rawPrice.replace(/[^0-9.]/g, "")) : null;
  if (!minRawPrice || !Number.isFinite(minRawPrice) || minRawPrice <= 0) {
    return null;
  }

  const rawOriginal = getStringValue(item.target_original_price) ?? getStringValue(item.original_price);
  const maxCandidate = rawOriginal ? Number(rawOriginal.replace(/[^0-9.]/g, "")) : undefined;
  const maxRawPrice = maxCandidate && Number.isFinite(maxCandidate) && maxCandidate > minRawPrice ? maxCandidate : undefined;

  const title = getStringValue(item.product_title)
    ?? getStringValue(item.title)
    ?? getStringValue(item.item_title)
    ?? query;
  const firstCategoryName = getStringValue(item.first_level_category_name) ?? getStringValue(item.firstLevelCategoryName);
  const secondCategoryName = getStringValue(item.second_level_category_name) ?? getStringValue(item.secondLevelCategoryName);
  const categoryNames = [firstCategoryName, secondCategoryName].filter((value): value is string => typeof value === "string" && value.length > 0);
  const keywords = uniqueStrings([
    ...title.toLowerCase().split(/[^a-z0-9]+/i).filter((t) => t.length > 2),
    ...categoryNames
      .flatMap((value) => value.toLowerCase().split(/[^a-z0-9]+/i).filter((token) => token.length > 2)),
  ]).slice(0, 16);
  const soldLabel = getStringValue(item.lastest_volume)
    ?? getStringValue(item.latest_volume)
    ?? getStringValue(item.orders)
    ?? "0";
  const minUsd = applyAliExpressMargin(minRawPrice);
  const maxUsd = maxRawPrice ? applyAliExpressMargin(maxRawPrice) : undefined;
  const commissionRate = getStringValue(item.commission_rate) ?? getStringValue(item.hot_product_commission_rate);
  const shopId = getStringValue(item.shop_id) ?? getStringValue(item.shopId) ?? "AliExpress";
  const promotionLink = getStringValue(item.promotion_link) ?? getStringValue(item.product_detail_url);
  const evaluateRate = getStringValue(item.evaluate_rate) ?? getStringValue(item.evaluateRate);
  const sourceWeightGrams = extractWeightGrams(item);
  const supplierLocation = getStringValue(item.shop_country_code)
    ?? getStringValue(item.shopCountryCode)
    ?? getStringValue(item.ship_from)
    ?? "Non fourni";
  const affiliateOverview = [
    secondCategoryName,
    firstCategoryName,
    soldLabel !== "0" ? `${soldLabel} ventes` : "",
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  return {
    sourceProductId: productId,
    slug: productId,
    title,
    shortTitle: title.slice(0, 96),
    keywords,
    image: mainImage,
    gallery,
    packaging: "Non fourni par affiliation",
    itemWeightGrams: sourceWeightGrams ?? 0,
    lotCbm: "0.0000",
    minUsd,
    maxUsd,
    moq: 1,
    unit: "piece",
    badge: "AliExpress Affiliate",
    supplierName: `Boutique ${shopId}`,
    supplierLocation,
    responseTime: "AliExpress Affiliate",
    yearsInBusiness: 0,
    transactionsLabel: evaluateRate ? `Note ${evaluateRate}` : `Boutique ${shopId}`,
    soldLabel: `${soldLabel} ventes`,
    customizationLabel: "Import affiliation",
    shippingLabel: "Expédition",
    overview: affiliateOverview.length > 0 ? affiliateOverview : [title],
    variantGroups: [],
    tiers: [{ quantityLabel: "1+", priceUsd: minUsd }],
    specs: [
      { label: "Source", value: "AliExpress Affiliate" },
      { label: "Destination", value: shipToCountry },
      ...(secondCategoryName ? [{ label: "Categorie", value: secondCategoryName }] : []),
      ...(commissionRate ? [{ label: "Commission", value: commissionRate }] : []),
    ],
    inventory: 1,
    rawPayload: {
      provider: "aliexpress-affiliate",
      item,
      source_weight_grams: sourceWeightGrams ?? null,
      supplier_price_usd: minRawPrice,
      margin_rate: Number(process.env.ALIEXPRESS_MARGIN_RATE ?? "0.1"),
      promotion_link: promotionLink,
      affiliate: true,
    },
    moqVerified: false,
    weightVerified: typeof sourceWeightGrams === "number" && sourceWeightGrams > 0,
    priceVerified: true,
  };
}

function normalizeAliExpressAffiliatePropertyLabel(label: string) {
  const normalized = label.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "Option";
  }

  if (normalized.length <= 5 && normalized === normalized.toUpperCase()) {
    return normalized;
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function collectAliExpressAffiliatePropertyPairs(value: unknown): Array<{ label: string; value: string }> {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      return collectAliExpressAffiliatePropertyPairs(JSON.parse(trimmed) as unknown);
    } catch {
      return [];
    }
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectAliExpressAffiliatePropertyPairs(entry));
  }

  if (!isRecord(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([label, entryValue]) => {
    const parsedValue = getStringValue(entryValue);
    if (!parsedValue) {
      return [];
    }

    return [{ label: normalizeAliExpressAffiliatePropertyLabel(label), value: parsedValue }];
  });
}

function extractAliExpressAffiliateSkuSelections(sku: Record<string, unknown>) {
  const selections = new Map<string, string>();

  for (const pair of collectAliExpressAffiliatePropertyPairs(sku.sku_properties)) {
    if (!selections.has(pair.label)) {
      selections.set(pair.label, pair.value);
    }
  }

  const propertyDtos = Array.isArray(sku.ae_sku_property_dtos) ? sku.ae_sku_property_dtos as Array<Record<string, unknown>> : [];
  for (const property of propertyDtos) {
    const label = getStringValue(property.sku_property_name) ?? getStringValue(property.property_name) ?? getStringValue(property.attr_name);
    const value = getStringValue(property.property_value_definition_name) ?? getStringValue(property.sku_property_value) ?? getStringValue(property.property_value_name) ?? getStringValue(property.attr_value);
    if (!label || !value) {
      continue;
    }

    const normalizedLabel = normalizeAliExpressAffiliatePropertyLabel(label);
    if (!selections.has(normalizedLabel)) {
      selections.set(normalizedLabel, value);
    }
  }

  const explicitPairs = [
    ["Color", getStringValue(sku.color)],
    ["Size", getStringValue(sku.size)],
    ["Model", getStringValue(sku.model)],
    ["Bundle", getStringValue(sku.bundle)],
    ["Material", getStringValue(sku.material)],
    ["Style", getStringValue(sku.style)],
    ["Plug Type", getStringValue(sku.plug_type)],
  ] as const;

  for (const [label, value] of explicitPairs) {
    if (value && !selections.has(label)) {
      selections.set(label, value);
    }
  }

  return Object.fromEntries(selections);
}

function extractAliExpressAffiliateSkuDetailProjection(
  responseBody: unknown,
  fallback: {
    productId: string;
    query: string;
    shipToCountry: string;
    fallbackTitle?: string;
    fallbackImage?: string;
    fallbackGallery?: string[];
    fallbackSupplierName?: string;
    fallbackSupplierLocation?: string;
    fallbackMinRawPrice?: number;
    fallbackMaxRawPrice?: number;
  },
) {
  const payload = getAliExpressSellerPayload(responseBody);
  const detailResult = isRecord(payload?.result) ? payload.result as Record<string, unknown> : payload;
  if (!isRecord(detailResult)) {
    return null;
  }

  const itemInfo = isRecord(detailResult.ae_item_info) ? detailResult.ae_item_info as Record<string, unknown> : {};
  const skuInfo = Array.isArray(detailResult.ae_item_sku_info)
    ? detailResult.ae_item_sku_info as Array<Record<string, unknown>>
    : Array.isArray(detailResult.ae_item_sku_info_dtos)
      ? detailResult.ae_item_sku_info_dtos as Array<Record<string, unknown>>
      : [];
  const title = getStringValue(itemInfo.en_title)
    ?? getStringValue(itemInfo.title)
    ?? fallback.fallbackTitle
    ?? fallback.query;
  const gallery = uniqueStrings([
    getStringValue(itemInfo.image_link) ?? "",
    getStringValue(itemInfo.image_white) ?? "",
    ...collectStrings(itemInfo.additional_image_links),
    ...skuInfo.map((sku) => getStringValue(sku.sku_image_link) ?? ""),
    ...(fallback.fallbackGallery ?? []),
    fallback.fallbackImage ?? "",
  ].filter(Boolean));
  const image = gallery[0];
  const rawPrices = skuInfo
    .map((sku) => getNumberValue(sku.sale_price_with_tax, sku.sale_price, sku.price_with_tax, sku.offer_sale_price, sku.sku_price))
    .filter((value): value is number => typeof value === "number" && value > 0);
  const minRawPrice = rawPrices.length > 0 ? Math.min(...rawPrices) : fallback.fallbackMinRawPrice;
  if (!image || typeof minRawPrice !== "number" || minRawPrice <= 0) {
    return null;
  }

  const maxRawPrice = rawPrices.length > 1 ? Math.max(...rawPrices) : fallback.fallbackMaxRawPrice;
  const variantGroups = [...new Map(
    skuInfo.flatMap((sku) => {
      const selections = extractAliExpressAffiliateSkuSelections(sku);
      return Object.entries(selections).map(([label, value]) => ({ label, value }));
    }).map((entry) => [`${entry.label}:${entry.value}`, entry]),
  ).values()].reduce<Array<{ label: string; values: string[] }>>((groups, entry) => {
    const existing = groups.find((group) => group.label === entry.label);
    if (existing) {
      if (!existing.values.includes(entry.value)) {
        existing.values.push(entry.value);
      }
      return groups;
    }

    return [...groups, { label: entry.label, values: [entry.value] }];
  }, []);
  const variantPricing = skuInfo.flatMap((sku, index) => {
    const selections = extractAliExpressAffiliateSkuSelections(sku);
    if (Object.keys(selections).length === 0) {
      return [];
    }

    const rawSkuPrice = getNumberValue(sku.sale_price_with_tax, sku.sale_price, sku.price_with_tax, sku.offer_sale_price, sku.sku_price) ?? minRawPrice;
    const priceUsd = applyAliExpressMargin(rawSkuPrice);
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
      return [];
    }

    return [{
      selections,
      priceUsd,
      minPriceUsd: priceUsd,
      minimumQuantity: 1,
      quantityLabel: "1+",
      note: getStringValue(sku.ean_code) ?? `SKU ${index + 1}`,
    }];
  });
  const variantSkus = skuInfo.flatMap((sku) => {
    const skuId = getStringValue(sku.sku_id);
    if (!skuId) {
      return [] as ProductVariantSku[];
    }

    const selections = extractAliExpressAffiliateSkuSelections(sku);
    if (Object.keys(selections).length === 0) {
      return [] as ProductVariantSku[];
    }

    return [{
      skuId,
      skuCode: getStringValue(sku.ean_code),
      image: getStringValue(sku.sku_image_link),
      selections,
    } satisfies ProductVariantSku];
  });
  const minDeliveryDays = skuInfo
    .map((sku) => getNumberValue(sku.min_delivery_days, sku.delivery_days))
    .filter((value): value is number => typeof value === "number" && value > 0);
  const maxDeliveryDays = skuInfo
    .map((sku) => getNumberValue(sku.max_delivery_days, sku.delivery_days))
    .filter((value): value is number => typeof value === "number" && value > 0);
  const shippingLabel = minDeliveryDays.length > 0
    ? `Livraison ${Math.min(...minDeliveryDays)}-${Math.max(...(maxDeliveryDays.length > 0 ? maxDeliveryDays : minDeliveryDays))} j`
    : "Expédition";
  const orderNumber = getStringValue(itemInfo.order_number) ?? "0";
  const reviewNumber = getStringValue(itemInfo.review_number);
  const productScore = getStringValue(itemInfo.product_score);
  const overview = uniqueStrings([
    orderNumber !== "0" ? `${orderNumber} ventes` : "",
    reviewNumber ? `${reviewNumber} avis clients` : "",
    productScore ? `Note ${productScore}` : "",
    getStringValue(itemInfo.display_category_name_l3) ?? getStringValue(itemInfo.display_category_name_l2) ?? getStringValue(itemInfo.product_category) ?? "",
  ]).slice(0, 4);
  const specs = [
    { label: "Source", value: "AliExpress Affiliate" },
    { label: "Destination", value: fallback.shipToCountry },
    { label: "Categorie", value: getStringValue(itemInfo.display_category_name_l3) ?? getStringValue(itemInfo.display_category_name_l2) ?? getStringValue(itemInfo.display_category_name_l1) ?? getStringValue(itemInfo.product_category) ?? "Selon catalogue" },
    { label: "Marque", value: getStringValue(itemInfo.brand) ?? "Selon catalogue" },
    { label: "Etat", value: getStringValue(itemInfo.condition) ?? "Selon catalogue" },
  ];
  const keywords = uniqueStrings([
    ...title.toLowerCase().split(/[^a-z0-9]+/i).filter((entry) => entry.length > 2),
    ...variantGroups.flatMap((group) => [group.label.toLowerCase(), ...group.values.map((value) => value.toLowerCase())]),
  ]).slice(0, 24);
  const extractedWeightGrams = extractWeightGrams(detailResult) ?? extractWeightGrams(responseBody);
  const itemWeightGrams = sanitizeItemWeightGrams(extractedWeightGrams) ?? 0;

  return {
    title,
    shortTitle: title.slice(0, 96),
    keywords,
    image,
    gallery,
    minUsd: applyAliExpressMargin(minRawPrice),
    maxUsd: typeof maxRawPrice === "number" ? applyAliExpressMargin(maxRawPrice) : undefined,
    supplierName: getStringValue(itemInfo.store_name) ?? fallback.fallbackSupplierName ?? "Boutique AliExpress",
    supplierLocation: getStringValue(skuInfo[0]?.ship_from_country) ?? fallback.fallbackSupplierLocation ?? "Non fourni",
    transactionsLabel: productScore ? `Note ${productScore}` : (reviewNumber ? `${reviewNumber} avis` : "Boutique AliExpress"),
    soldLabel: `${orderNumber} ventes`,
    shippingLabel,
    overview: overview.length > 0 ? overview : [title],
    variantGroups,
    variantPricing,
    variantSkus,
    tiers: variantPricing.slice(0, 6).map((entry, index) => ({ quantityLabel: entry.quantityLabel ?? "1+", priceUsd: entry.priceUsd, note: entry.note ?? `SKU ${index + 1}` })),
    specs,
    itemWeightGrams,
    weightVerified: itemWeightGrams > 0,
    sourceUrl: getStringValue(itemInfo.original_link),
    rawResponse: responseBody,
  };
}

function extractAliExpressSolutionProductPackageMetrics(responseBody: unknown) {
  const payload = getAliExpressSellerPayload(responseBody);
  const result = isRecord(payload?.result) ? payload.result as Record<string, unknown> : payload;
  if (!isRecord(result)) {
    return {};
  }

  const packageInfo = isRecord(result.package_info_dto) ? result.package_info_dto as Record<string, unknown> : undefined;

  const rawWeight = getNumberValue(
    result.gross_weight,
    result.package_weight,
    result.weight,
    packageInfo?.gross_weight,
    packageInfo?.package_weight,
    packageInfo?.weight,
  );
  const rawWeightUnit = getStringValue(result.weight_unit) ?? getStringValue(packageInfo ? packageInfo.weight_unit : undefined) ?? "1";
  const weightUnit = rawWeightUnit.trim().toLowerCase();
  let weightGrams: number | undefined;

  if (typeof rawWeight === "number" && rawWeight > 0) {
    if (["1", "kg", "kgs", "kilogram", "kilograms"].includes(weightUnit)) {
      weightGrams = sanitizeItemWeightGrams(Math.round(rawWeight * 1000));
    } else if (["2", "g", "gram", "grams"].includes(weightUnit)) {
      weightGrams = sanitizeItemWeightGrams(Math.round(rawWeight));
    } else {
      weightGrams = sanitizeItemWeightGrams(Math.round(rawWeight < 10 ? rawWeight * 1000 : rawWeight));
    }
  }

  const packageLength = getNumberValue(result.package_length, packageInfo?.package_length);
  const packageWidth = getNumberValue(result.package_width, packageInfo?.package_width);
  const packageHeight = getNumberValue(result.package_height, packageInfo?.package_height);
  const resolvedPackageLength = typeof packageLength === "number" && packageLength > 0 ? packageLength : undefined;
  const resolvedPackageWidth = typeof packageWidth === "number" && packageWidth > 0 ? packageWidth : undefined;
  const resolvedPackageHeight = typeof packageHeight === "number" && packageHeight > 0 ? packageHeight : undefined;
  const hasPackageDimensions = typeof resolvedPackageLength === "number" && typeof resolvedPackageWidth === "number" && typeof resolvedPackageHeight === "number";

  const formatDimension = (value: number) => (Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2))));
  let lotCbm: string | undefined;
  let packaging: string | undefined;
  if (hasPackageDimensions) {
    lotCbm = ((resolvedPackageLength * resolvedPackageWidth * resolvedPackageHeight) / 1_000_000).toFixed(4);
    packaging = `${formatDimension(resolvedPackageLength)} x ${formatDimension(resolvedPackageWidth)} x ${formatDimension(resolvedPackageHeight)} cm`;
  }

  return {
    weightGrams,
    packaging,
    lotCbm,
  };
}

async function enrichAliExpressAffiliateProduct(
  product: AlibabaSearchProduct,
  searchItem: Record<string, unknown>,
  context: { shipToCountry: string; local: string; currency: string },
  credentials: AlibabaCredentials,
) {
  const [affiliateResponse, sellerProductInfoResponse] = await Promise.all([
    callAliExpressTopEndpoint("aliexpress.affiliate.product.sku.detail.get", {
      ship_to_country: context.shipToCountry,
      product_id: product.sourceProductId,
      target_currency: context.currency,
      target_language: affiliateLanguageCode(context.local),
      need_deliver_info: "No",
    }, {
      credentials,
      includeAccessToken: Boolean(credentials.accessToken),
    }).catch(() => null),
    callAliExpressTopEndpoint("aliexpress.solution.product.info.get", {
      product_id: product.sourceProductId,
    }, {
      credentials,
      includeAccessToken: Boolean(credentials.accessToken),
    }).catch(() => null),
  ]);
  if (!affiliateResponse?.ok) {
    return product;
  }

  const projection = extractAliExpressAffiliateSkuDetailProjection(affiliateResponse.responseBody, {
    productId: product.sourceProductId,
    query: product.title,
    shipToCountry: context.shipToCountry,
    fallbackTitle: product.title,
    fallbackImage: product.image,
    fallbackGallery: product.gallery,
    fallbackSupplierName: product.supplierName,
    fallbackSupplierLocation: product.supplierLocation,
    fallbackMinRawPrice: product.minUsd,
    fallbackMaxRawPrice: product.maxUsd,
  });
  if (!projection) {
    return product;
  }

  const sellerPackageMetrics = sellerProductInfoResponse?.ok
    ? extractAliExpressSolutionProductPackageMetrics(sellerProductInfoResponse.responseBody)
    : undefined;
  const itemWeightGrams = sellerPackageMetrics?.weightGrams ?? projection.itemWeightGrams;
  const weightVerified = typeof itemWeightGrams === "number" && itemWeightGrams > 0;

  return {
    ...product,
    title: projection.title,
    shortTitle: projection.shortTitle,
    keywords: projection.keywords,
    image: projection.image,
    gallery: projection.gallery,
    packaging: sellerPackageMetrics?.packaging ?? product.packaging,
    itemWeightGrams,
    lotCbm: sellerPackageMetrics?.lotCbm ?? product.lotCbm,
    minUsd: projection.minUsd,
    maxUsd: projection.maxUsd,
    supplierName: projection.supplierName,
    supplierLocation: projection.supplierLocation,
    transactionsLabel: projection.transactionsLabel,
    soldLabel: projection.soldLabel,
    customizationLabel: projection.variantGroups.length > 0 ? "Variantes synchronisées" : product.customizationLabel,
    shippingLabel: projection.shippingLabel,
    overview: projection.overview,
    variantGroups: projection.variantGroups,
    variantPricing: projection.variantPricing,
    variantSkus: projection.variantSkus,
    tiers: projection.tiers.length > 0 ? projection.tiers : product.tiers,
    specs: projection.specs,
    weightVerified,
    rawPayload: {
      ...(isRecord(product.rawPayload) ? product.rawPayload as Record<string, unknown> : { item: searchItem }),
      provider: "aliexpress-affiliate",
      affiliate: true,
      promotion_link: projection.sourceUrl ?? getStringValue(searchItem.promotion_link) ?? getStringValue(searchItem.product_detail_url),
      affiliate_sku_detail: projection.rawResponse,
      seller_product_info: sellerProductInfoResponse?.ok ? sellerProductInfoResponse.responseBody : undefined,
      source_weight_grams: itemWeightGrams > 0 ? itemWeightGrams : null,
      source_package_cbm: sellerPackageMetrics?.lotCbm ?? null,
    },
  };
}

async function searchAliExpressAffiliateProducts(input: {
  query: string;
  limit: number;
  credentials: AlibabaCredentials;
  preferredShipToCountry?: string;
  preferredLanguage?: string;
  preferredCurrency?: string;
}): Promise<AlibabaProductSearchResult> {
  const desiredCount = Math.min(Math.max(input.limit, 1), 40);
  const pageSize = Math.min(50, desiredCount);
  const maxPages = Math.max(1, Math.ceil(desiredCount / pageSize));
  const maxCollectedCandidates = Math.max(desiredCount * 4, 40);
  const queryCandidates = buildAliExpressQueryCandidates(input.query);
  const searchContexts = buildAliExpressSearchContexts({
    preferredShipToCountry: input.preferredShipToCountry,
    preferredLanguage: input.preferredLanguage,
    preferredCurrency: input.preferredCurrency,
  });
  const allowLooseMatches = shouldAllowLooseAliExpressMatches(input.query);
  const collectedByProductId = new Map<string, {
    product: AlibabaSearchProduct;
    score: number;
    strictMatch: boolean;
    item: Record<string, unknown>;
    context: { shipToCountry: string; local: string; currency: string };
  }>();
  let lastResponse: unknown = null;
  let lastSearchError: AlibabaProductSearchResult | null = null;

  for (const queryCandidate of queryCandidates) {
    for (const context of searchContexts) {
      for (let pageNo = 1; pageNo <= maxPages && collectedByProductId.size < maxCollectedCandidates; pageNo += 1) {
        const searchResult = await callAliExpressTopEndpoint("aliexpress.affiliate.product.query", {
          keywords: queryCandidate,
          target_language: affiliateLanguageCode(context.local),
          target_currency: context.currency,
          ship_to_country: context.shipToCountry,
          page_no: pageNo,
          page_size: pageSize,
          tracking_id: process.env.ALIEXPRESS_AFFILIATE_TRACKING_ID ?? "",
          fields: "product_id,product_title,product_main_image_url,product_small_image_urls,target_sale_price,target_original_price,sale_price,original_price,app_sale_price,lastest_volume,evaluate_rate,first_level_category_name,second_level_category_name,shop_id,promotion_link,commission_rate,discount",
        }, {
          credentials: input.credentials,
          includeAccessToken: Boolean(input.credentials.accessToken),
        });

        lastResponse = searchResult.responseBody;

        if (!searchResult.ok) {
          if (collectedByProductId.size > 0) {
            break;
          }

          const apiError = isRecord(searchResult.responseBody) && isRecord((searchResult.responseBody as Record<string, unknown>).error_response)
            ? (searchResult.responseBody as Record<string, unknown>).error_response as Record<string, unknown>
            : null;
          const apiErrorMsg = apiError
            ? (getStringValue(apiError.en_desc) ?? getStringValue(apiError.sub_msg) ?? getStringValue(apiError.zh_desc))
            : undefined;
          lastSearchError = {
            ok: false,
            endpoint: "aliexpress.affiliate.product.query",
            responseBody: searchResult.responseBody,
            products: [],
            errorMessage: apiErrorMsg
              ? `AliExpress Affiliate: ${apiErrorMsg}`
              : "Recherche AliExpress Affiliate impossible.",
          };
          continue;
        }

        const items = extractAliExpressAffiliateItems(searchResult.responseBody);
        if (items.length === 0) {
          break;
        }

        for (const item of items) {
          const productId = getStringValue(item.product_id) ?? getStringValue(item.productId);
          if (!productId || collectedByProductId.has(productId)) {
            continue;
          }

          const normalized = mapAliExpressAffiliateItemToProduct(item, input.query, context.shipToCountry);
          if (!normalized) {
            continue;
          }

          const relevance = scoreAliExpressSearchProductRelevance(normalized, input.query);
          collectedByProductId.set(productId, {
            product: normalized,
            score: relevance.score,
            strictMatch: relevance.strictMatch,
            item,
            context,
          });

          if (collectedByProductId.size >= maxCollectedCandidates) {
            break;
          }
        }
      }

      if (collectedByProductId.size >= desiredCount) {
        break;
      }
    }

    if (collectedByProductId.size >= desiredCount) {
      break;
    }
  }

  const strictMatches = [...collectedByProductId.values()]
    .filter((entry) => entry.strictMatch)
    .sort((left, right) => right.score - left.score);
  const looseMatches = [...collectedByProductId.values()]
    .filter((entry) => !entry.strictMatch)
    .sort((left, right) => right.score - left.score);
  const foundEntries = allowLooseMatches
    ? [...strictMatches, ...looseMatches].slice(0, desiredCount)
    : strictMatches.slice(0, desiredCount);
  const foundProducts = await Promise.all(foundEntries.map((entry) => enrichAliExpressAffiliateProduct(entry.product, entry.item, entry.context, input.credentials)));

  return {
    ok: foundProducts.length > 0,
    endpoint: "aliexpress.affiliate.product.query",
    responseBody: foundProducts.length > 0 ? lastResponse : (lastSearchError?.responseBody ?? lastResponse),
    products: foundProducts,
    errorMessage: foundProducts.length > 0
      ? undefined
      : lastSearchError?.errorMessage ?? "Aucun produit AliExpress Affiliate trouvé. Essaie un mot-clé plus simple.",
  };
}

export async function fetchAliExpressAffiliateProductSnapshot(input: {
  sourceProductId: string;
  query?: string;
  shipToCountry?: string;
  targetCurrency?: string;
  targetLanguage?: string;
  supplierAccountId?: string;
}): Promise<AlibabaSearchProduct | null> {
  const credentials = await resolveAlibabaCredentialsForLiveCall({ accountId: input.supplierAccountId });
  if (!isAliExpressCredentials(credentials)) {
    return null;
  }

  const shipToCountry = String(input.shipToCountry ?? process.env.ALIEXPRESS_DEFAULT_SHIP_TO_COUNTRY ?? "FR").trim().toUpperCase();
  const currency = String(input.targetCurrency ?? process.env.ALIEXPRESS_TARGET_CURRENCY ?? "USD").trim().toUpperCase();
  const local = String(input.targetLanguage ?? process.env.ALIEXPRESS_TARGET_LANGUAGE ?? "fr_FR").trim();
  const [affiliateResponse, sellerProductInfoResponse] = await Promise.all([
    callAliExpressTopEndpoint("aliexpress.affiliate.product.sku.detail.get", {
      ship_to_country: shipToCountry,
      product_id: input.sourceProductId,
      target_currency: currency,
      target_language: affiliateLanguageCode(local),
      need_deliver_info: "No",
    }, {
      credentials,
      includeAccessToken: Boolean(credentials.accessToken),
    }).catch(() => null),
    callAliExpressTopEndpoint("aliexpress.solution.product.info.get", {
      product_id: input.sourceProductId,
    }, {
      credentials,
      includeAccessToken: Boolean(credentials.accessToken),
    }).catch(() => null),
  ]);
  if (!affiliateResponse?.ok) {
    return null;
  }

  const projection = extractAliExpressAffiliateSkuDetailProjection(affiliateResponse.responseBody, {
    productId: input.sourceProductId,
    query: input.query?.trim() || input.sourceProductId,
    shipToCountry,
  });
  if (!projection) {
    return null;
  }

  const sellerPackageMetrics = sellerProductInfoResponse?.ok
    ? extractAliExpressSolutionProductPackageMetrics(sellerProductInfoResponse.responseBody)
    : undefined;
  const itemWeightGrams = sellerPackageMetrics?.weightGrams ?? projection.itemWeightGrams;
  const weightVerified = typeof itemWeightGrams === "number" && itemWeightGrams > 0;

  return {
    sourceProductId: input.sourceProductId,
    slug: input.sourceProductId,
    title: projection.title,
    shortTitle: projection.shortTitle,
    keywords: projection.keywords,
    image: projection.image,
    gallery: projection.gallery,
    packaging: sellerPackageMetrics?.packaging ?? "Non fourni par affiliation",
    itemWeightGrams,
    lotCbm: sellerPackageMetrics?.lotCbm ?? "0.0000",
    minUsd: projection.minUsd,
    maxUsd: projection.maxUsd,
    moq: 1,
    unit: "piece",
    badge: "AliExpress Affiliate",
    supplierName: projection.supplierName,
    supplierLocation: projection.supplierLocation,
    responseTime: "AliExpress Affiliate",
    yearsInBusiness: 0,
    transactionsLabel: projection.transactionsLabel,
    soldLabel: projection.soldLabel,
    customizationLabel: projection.variantGroups.length > 0 ? "Variantes synchronisées" : "Import affiliation",
    shippingLabel: projection.shippingLabel,
    overview: projection.overview,
    variantGroups: projection.variantGroups,
    variantPricing: projection.variantPricing,
    variantSkus: projection.variantSkus,
    tiers: projection.tiers.length > 0 ? projection.tiers : [{ quantityLabel: "1+", priceUsd: projection.minUsd }],
    specs: projection.specs,
    inventory: 1,
    rawPayload: {
      provider: "aliexpress-affiliate",
      affiliate: true,
      promotion_link: projection.sourceUrl,
      affiliate_sku_detail: projection.rawResponse,
      seller_product_info: sellerProductInfoResponse?.ok ? sellerProductInfoResponse.responseBody : undefined,
      source_weight_grams: itemWeightGrams > 0 ? itemWeightGrams : null,
      source_package_cbm: sellerPackageMetrics?.lotCbm ?? null,
    },
    moqVerified: false,
    weightVerified,
    priceVerified: true,
  };
}

export async function searchAlibabaProducts(input: {
  query: string;
  limit: number;
  fulfillmentChannel: AlibabaFulfillmentChannel;
  preferredShipToCountry?: string;
  preferredLanguage?: string;
  preferredCurrency?: string;
  supplierAccountId?: string;
}): Promise<AlibabaProductSearchResult> {
  const credentials = await resolveAlibabaCredentialsForLiveCall({ accountId: input.supplierAccountId });
  if (!isAliExpressCredentials(credentials)) {
    return {
      ok: false,
      endpoint: "aliexpress.affiliate.product.query",
      responseBody: {
        message: "AliExpress credentials are missing",
      },
      products: [],
      errorMessage: "Import AliExpress indisponible: connecte un compte AliExpress ou configure l'App Key et l'App Secret AliExpress.",
    };
  }

  const importProvider = String(process.env.ALIEXPRESS_IMPORT_PROVIDER ?? "affiliate").trim().toLowerCase();
  if (importProvider === "ds") {
    return searchAliExpressProducts({
      query: input.query,
      limit: input.limit,
      preferredShipToCountry: input.preferredShipToCountry,
      preferredLanguage: input.preferredLanguage,
      preferredCurrency: input.preferredCurrency,
      supplierAccountId: input.supplierAccountId,
    });
  }

  return searchAliExpressAffiliateProducts({
    query: input.query,
    limit: input.limit,
    credentials,
    preferredShipToCountry: input.preferredShipToCountry,
    preferredLanguage: input.preferredLanguage,
    preferredCurrency: input.preferredCurrency,
  });
}

function matchesAlibabaExactIdentifier(product: AlibabaSearchProduct, identifier: string) {
  const normalizedIdentifier = identifier.trim().toLowerCase();
  if (!normalizedIdentifier) {
    return false;
  }

  const rawPayload = product.rawPayload && typeof product.rawPayload === "object" && !Array.isArray(product.rawPayload)
    ? product.rawPayload as Record<string, unknown>
    : null;
  const basicInfo = rawPayload?.basic_info && typeof rawPayload.basic_info === "object"
    ? rawPayload.basic_info as Record<string, unknown>
    : {};
  const tradeInfo = rawPayload?.trade_info && typeof rawPayload.trade_info === "object"
    ? rawPayload.trade_info as Record<string, unknown>
    : {};
  const skuInfo = Array.isArray(rawPayload?.sku_info)
    ? rawPayload?.sku_info as Array<Record<string, unknown>>
    : Array.isArray(tradeInfo.sku_info)
      ? tradeInfo.sku_info as Array<Record<string, unknown>>
      : [];

  const candidateValues = [
    product.sourceProductId,
    getStringValue(basicInfo.model_number),
    getStringValue(rawPayload?.model_number),
    ...skuInfo.map((sku) => getStringValue(sku.sku_code)),
  ];

  return candidateValues.some((value) => value?.trim().toLowerCase() === normalizedIdentifier);
}

export async function searchAlibabaExactIdentifierProducts(input: {
  identifier: string;
  limit: number;
}): Promise<AlibabaProductSearchResult> {
  const normalizedIdentifier = input.identifier.trim();
  const result = await searchAlibabaIcbuProducts({
    query: normalizedIdentifier,
    limit: Math.min(Math.max(input.limit, 1), 20),
  });

  if (!result.ok) {
    return result;
  }

  const exactProducts = result.products.filter((product) => matchesAlibabaExactIdentifier(product, normalizedIdentifier));

  return {
    ...result,
    products: exactProducts.slice(0, input.limit),
  };
}

export async function createAlibabaBuyNowOrder(payload: Record<string, unknown>) {
  const credentials = await resolveAlibabaCredentialsForLiveCall();
  if (isAliExpressCredentials(credentials)) {
    const wrappedOrderRequest = payload.param_place_order_request4_open_api_d_t_o;
    const camelWrappedOrderRequest = payload.paramPlaceOrderRequest4OpenApiDto;
    const rawOrderRequest = isRecord(wrappedOrderRequest)
      ? wrappedOrderRequest as Record<string, unknown>
      : isRecord(camelWrappedOrderRequest)
        ? camelWrappedOrderRequest as Record<string, unknown>
        : Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "ds_extend_request" && key !== "dsExtendRequest"));
    const rawDsExtendRequest = payload.ds_extend_request ?? payload.dsExtendRequest;
    const autoPayFlag = String(process.env.ALIEXPRESS_DS_AUTO_PAY_ENABLED ?? "true").trim().toLowerCase();
    const shouldAutoPay = !(autoPayFlag === "false" || autoPayFlag === "0" || autoPayFlag === "off" || autoPayFlag === "no");
    const defaultPayment = {
      pay_currency: process.env.ALIEXPRESS_DS_PAYMENT_CURRENCY ?? "USD",
      // Keep string values for broad compatibility with DS gateway payload parsing.
      try_to_pay: shouldAutoPay ? "true" : "false",
    };
    const dsExtendRequest = typeof rawDsExtendRequest === "string"
      ? rawDsExtendRequest
      : JSON.stringify(
          isRecord(rawDsExtendRequest)
            ? {
                ...rawDsExtendRequest,
                payment: {
                  ...defaultPayment,
                  ...(isRecord(rawDsExtendRequest.payment) ? rawDsExtendRequest.payment as Record<string, unknown> : {}),
                },
              }
            : {
                payment: defaultPayment,
              },
        );

    return callAliExpressTopEndpoint("aliexpress.ds.order.create", {
      ds_extend_request: dsExtendRequest,
      param_place_order_request4_open_api_d_t_o: JSON.stringify(rawOrderRequest),
    }, {
      credentials,
      method: "POST",
    });
  }

  return callAlibabaEndpoint("/buynow/order/create", payload, {
    credentials,
  });
}

function normalizeAlibabaAiOptimizationConfig(config?: AlibabaAiOptimizationConfig) {
  if (!config) {
    return undefined;
  }

  const normalized = {
    keyword_optimization_enabled: String(config.keywordOptimizationEnabled ?? true),
    description_optimization_enabled: String(config.descriptionOptimizationEnabled ?? true),
    title_optimization_enabled: String(config.titleOptimizationEnabled ?? true),
  };

  return normalized;
}

function isAlibabaOperationSuccessful(responseBody: unknown) {
  const response = isRecord(responseBody) ? responseBody : null;
  const respResult = response && isRecord(response.resp_result) ? response.resp_result as Record<string, unknown> : null;
  const envelope = response && isRecord(response.result)
    ? response.result as Record<string, unknown>
    : respResult && isRecord(respResult.result)
      ? respResult.result as Record<string, unknown>
      : response;

  if (!envelope) {
    return false;
  }

  const code = extractAlibabaOperationCode(responseBody)?.trim().toLowerCase();
  const hasUsefulPayload = hasUsefulAlibabaPayload(responseBody);

  if (code && !["0", "200", "null", "success", "true"].includes(code) && !hasUsefulPayload) {
    return false;
  }

  if (typeof envelope.success !== "undefined") {
    return isTruthyAlibabaFlag(envelope.success) || hasUsefulPayload;
  }

  const respCode = getStringValue(respResult?.resp_code)?.trim().toLowerCase();
  if (respCode) {
    return ["0", "200", "null", "success", "true"].includes(respCode)
      && (hasUsefulPayload || getStringValue(respResult?.resp_msg)?.trim().toLowerCase() === "success");
  }

  return hasUsefulPayload;
}

function extractAlibabaOperationMessage(responseBody: unknown) {
  const response = isRecord(responseBody) ? responseBody : null;
  const respResult = response && isRecord(response.resp_result) ? response.resp_result as Record<string, unknown> : null;
  const envelope = response && isRecord(response.result)
    ? response.result as Record<string, unknown>
    : respResult && isRecord(respResult.result)
      ? respResult.result as Record<string, unknown>
      : response;

  return getStringValue(envelope?.message)
    ?? getStringValue(envelope?.msg)
    ?? getStringValue(envelope?.error_msg)
    ?? getStringValue(envelope?.response_msg)
    ?? getStringValue(respResult?.resp_msg)
    ?? getStringValue(response?.message)
    ?? getStringValue(response?.msg);
}

function extractAlibabaOperationCode(responseBody: unknown) {
  const response = isRecord(responseBody) ? responseBody : null;
  const respResult = response && isRecord(response.resp_result) ? response.resp_result as Record<string, unknown> : null;
  const envelope = response && isRecord(response.result)
    ? response.result as Record<string, unknown>
    : respResult && isRecord(respResult.result)
      ? respResult.result as Record<string, unknown>
      : response;

  return getStringValue(envelope?.msg_code)
    ?? getStringValue(envelope?.error_code)
    ?? getStringValue(envelope?.code)
    ?? getStringValue(envelope?.response_code)
    ?? getStringValue(respResult?.resp_code)
    ?? getStringValue(response?.code);
}

function extractAlibabaTradeId(responseBody: unknown): string | undefined {
  const response = isRecord(responseBody) ? responseBody : null;
  const envelope = response && isRecord(response.result) ? response.result : response;
  const value = envelope && isRecord(envelope.value) ? envelope.value : response && isRecord(response.value) ? response.value : null;
  const data = envelope && isRecord(envelope.data) ? envelope.data : response && isRecord(response.data) ? response.data : null;
  const orderList = envelope && isRecord(envelope.order_list)
    ? envelope.order_list as Record<string, unknown>
    : response && isRecord(response.order_list)
      ? response.order_list as Record<string, unknown>
      : null;
  const orderNumbers = orderList
    ? Array.isArray(orderList.number)
      ? orderList.number
      : Array.isArray(orderList.order_ids)
        ? orderList.order_ids
        : []
    : [];
  const firstOrderNumber = orderNumbers.find((entry) => typeof entry === "string" || typeof entry === "number");

  return getStringValue(envelope?.trade_id)
    ?? getStringValue(response?.trade_id)
    ?? getStringValue(data?.trade_id)
    ?? getStringValue(value?.trade_id)
    ?? getStringValue(value?.order_id)
    ?? getStringValue(data?.order_id)
    ?? getStringValue(firstOrderNumber);
}

export async function createAlibabaIcbuProductListing(input: {
  productInfo: Record<string, unknown>;
  aiOptimizationConfig?: AlibabaAiOptimizationConfig;
}) {
  if (!isRecord(input.productInfo) || Object.keys(input.productInfo).length === 0) {
    throw new Error("product_info est obligatoire pour creer une fiche Alibaba.");
  }

  return callAlibabaEndpoint("/alibaba/icbu/product/listing/v2", {
    product_info: input.productInfo,
    ...(normalizeAlibabaAiOptimizationConfig(input.aiOptimizationConfig)
      ? { ai_optimization_config: normalizeAlibabaAiOptimizationConfig(input.aiOptimizationConfig) }
      : {}),
  }, {
    credentials: await resolveAlibabaCredentialsForLiveCall(),
  });
}

export async function getAlibabaIcbuCategories(input?: {
  parentCategoryId?: string | number;
  language?: string;
  appSignature?: string;
}) {
  const credentials = await resolveAlibabaCredentialsForLiveCall();
  if (isAliExpressCredentials(credentials)) {
    return callAliExpressTopEndpoint("aliexpress.ds.category.get", {
      ...(typeof input?.parentCategoryId !== "undefined" && input.parentCategoryId !== null && String(input.parentCategoryId).trim().length > 0
        ? { categoryId: String(input.parentCategoryId) }
        : {}),
      language: input?.language ?? process.env.ALIEXPRESS_DEFAULT_LANGUAGE?.split("_")[0] ?? "en",
      ...(String(input?.appSignature ?? "").trim() ? { app_signature: String(input?.appSignature).trim() } : {}),
    }, {
      credentials,
      method: "GET",
    });
  }

  return callAlibabaEndpoint("/alibaba/icbu/category/get/v2", {
    ...(typeof input?.parentCategoryId !== "undefined" && input.parentCategoryId !== null && String(input.parentCategoryId).trim().length > 0
      ? { parent_category_id: String(input.parentCategoryId) }
      : {}),
  }, {
    credentials,
    method: "GET",
  });
}

function normalizeAliExpressLocalizedNames(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value).flatMap(([key, candidate]) => {
    const text = getStringValue(candidate);
    return text ? [[key, text] as const] : [];
  });

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function normalizeAliExpressAttributePath(value: unknown) {
  if (Array.isArray(value)) {
    const parts = value.flatMap((entry) => collectStrings(entry));
    return parts.length > 0 ? parts.join(",") : undefined;
  }

  const text = getStringValue(value);
  return text || undefined;
}

export async function getAliExpressPostCategoryChildAttributes(input: {
  postCategoryId?: string | number;
  attributePath?: string | string[];
  locale?: string;
  channelSellerId?: string | number;
  channel?: string;
  productType?: string | number;
}) {
  const credentials = await resolveAlibabaCredentialsForLiveCall();

  return callAliExpressTopEndpoint("aliexpress.category.redefining.getchildattributesresultbypostcateidandpath", {
    ...(typeof input.channelSellerId !== "undefined" && input.channelSellerId !== null && String(input.channelSellerId).trim().length > 0
      ? { channel_seller_id: String(input.channelSellerId).trim() }
      : {}),
    ...(String(input.channel ?? "").trim() ? { channel: String(input.channel).trim() } : {}),
    ...(String(input.locale ?? "").trim() ? { locale: String(input.locale).trim() } : {}),
    ...(typeof input.productType !== "undefined" && input.productType !== null && String(input.productType).trim().length > 0
      ? { product_type: String(input.productType).trim() }
      : {}),
    ...(typeof input.postCategoryId !== "undefined" && input.postCategoryId !== null && String(input.postCategoryId).trim().length > 0
      ? { param1: String(input.postCategoryId).trim() }
      : {}),
    ...(normalizeAliExpressAttributePath(input.attributePath)
      ? { param2: normalizeAliExpressAttributePath(input.attributePath) }
      : {}),
  }, {
    credentials,
    method: "GET",
  });
}

export async function getAliExpressPostCategoryTree(input?: {
  categoryId?: string | number;
  onlyWithPermission?: boolean;
  channelSellerId?: string | number;
  channel?: string;
}) {
  const credentials = await resolveAlibabaCredentialsForLiveCall();

  return callAliExpressTopEndpoint("aliexpress.category.tree.list", {
    ...(typeof input?.channelSellerId !== "undefined" && input.channelSellerId !== null && String(input.channelSellerId).trim().length > 0
      ? { channel_seller_id: String(input.channelSellerId).trim() }
      : {}),
    ...(String(input?.channel ?? "").trim() ? { channel: String(input?.channel).trim() } : {}),
    ...(typeof input?.onlyWithPermission === "boolean" ? { only_with_permission: input.onlyWithPermission } : {}),
    ...(typeof input?.categoryId !== "undefined" && input.categoryId !== null && String(input.categoryId).trim().length > 0
      ? { category_id: String(input.categoryId).trim() }
      : {}),
  }, {
    credentials,
    method: "GET",
  });
}

export async function getAliExpressCategoryItemQualifications(input: {
  categoryId: string | number;
  locale?: string;
  channelSellerId?: string | number;
}) {
  const credentials = await resolveAlibabaCredentialsForLiveCall();

  return callAliExpressTopEndpoint("aliexpress.category.itemQualification.list", {
    category_id: String(input.categoryId).trim(),
    ...(String(input.locale ?? "").trim() ? { local: String(input.locale).trim() } : {}),
    ...(typeof input.channelSellerId !== "undefined" && input.channelSellerId !== null && String(input.channelSellerId).trim().length > 0
      ? { channel_seller_id: String(input.channelSellerId).trim() }
      : {}),
  }, {
    credentials,
    method: "GET",
  });
}

export async function queryAliExpressCategoryCascadeProperties(input: {
  categoryId: string | number;
  locale: string;
}) {
  const credentials = await resolveAlibabaCredentialsForLiveCall();

  return callAliExpressTopEndpoint("aliexpress.category.redefining.queryCascadeProperties", {
    category_id: String(input.categoryId).trim(),
    locale: String(input.locale).trim(),
  }, {
    credentials,
    method: "GET",
  });
}

export async function queryAliExpressSkuAttributes(input: {
  categoryId?: string | number;
  aliexpressCategoryId?: string | number;
  request?: Record<string, unknown>;
}) {
  const credentials = await resolveAlibabaCredentialsForLiveCall();

  return callAliExpressTopEndpoint("aliexpress.solution.sku.attribute.query", {
    query_sku_attribute_info_request: isRecord(input.request)
      ? input.request
      : {
          ...(typeof input.categoryId !== "undefined" && input.categoryId !== null && String(input.categoryId).trim().length > 0
            ? { category_id: String(input.categoryId).trim() }
            : {}),
          ...(typeof input.aliexpressCategoryId !== "undefined" && input.aliexpressCategoryId !== null && String(input.aliexpressCategoryId).trim().length > 0
            ? { aliexpress_category_id: String(input.aliexpressCategoryId).trim() }
            : {}),
        },
  }, {
    credentials,
    method: "GET",
  });
}

export async function queryAliExpressSellerCategoryTree(input: {
  categoryId: string | number;
  filterNoPermission?: boolean;
}) {
  const credentials = await resolveAlibabaCredentialsForLiveCall();

  return callAliExpressTopEndpoint("aliexpress.solution.seller.category.tree.query", {
    category_id: String(input.categoryId).trim(),
    filter_no_permission: input.filterNoPermission,
  }, {
    credentials,
    method: "GET",
  });
}

export function normalizeAlibabaIcbuCategories(responseBody: unknown): AlibabaIcbuCategorySummary[] {
  const response = isRecord(responseBody) ? responseBody : null;
  const sellerPayload = getAliExpressSellerPayload(responseBody);
  const entries = Array.isArray(response?.data)
    ? response.data
    : Array.isArray(sellerPayload?.categories)
      ? sellerPayload.categories
      : [];

  return entries.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [] as AlibabaIcbuCategorySummary[];
    }

    const categoryId = getStringValue(entry.category_id) ?? getStringValue(entry.id);
    const categoryName = getStringValue(entry.category_name)
      ?? getStringValue(entry.title)
      ?? getStringValue(entry.name)
      ?? getStringValue(entry.categoryName);
    if (!categoryId || !categoryName) {
      return [] as AlibabaIcbuCategorySummary[];
    }

    return [{
      categoryId,
      categoryName,
      level: getNumberValue(entry.level),
      leafCategory: typeof entry.isleaf !== "undefined"
        ? isTruthyAlibabaFlag(entry.isleaf)
        : isTruthyAlibabaFlag(entry.leaf_category),
    } satisfies AlibabaIcbuCategorySummary];
  });
}

export function normalizeAliExpressSellerCategoryTree(responseBody: unknown) {
  return normalizeAlibabaIcbuCategories(responseBody);
}

export function normalizeAliExpressPostCategoryTree(responseBody: unknown) {
  const response = isRecord(responseBody) ? responseBody : null;
  const sellerPayload = getAliExpressSellerPayload(responseBody);
  const entries = Array.isArray(response?.aeop_post_category_list)
    ? response.aeop_post_category_list
    : Array.isArray(sellerPayload?.aeop_post_category_list)
      ? sellerPayload.aeop_post_category_list
      : Array.isArray(sellerPayload?.categories)
        ? sellerPayload.categories
        : [];

  return entries.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [] as Array<Record<string, unknown>>;
    }

    const categoryId = getStringValue(entry.id) ?? getStringValue(entry.children_category_id);
    const names = normalizeAliExpressLocalizedNames(entry.names) ?? normalizeAliExpressLocalizedNames(entry.multi_language_names);
    const categoryName = names?.en ?? names?.fr ?? getStringValue(entry.category_name) ?? getStringValue(entry.title) ?? getStringValue(entry.name);
    if (!categoryId || !categoryName) {
      return [] as Array<Record<string, unknown>>;
    }

    return [{
      categoryId,
      categoryName,
      level: getNumberValue(entry.level),
      leafCategory: typeof entry.isleaf !== "undefined"
        ? isTruthyAlibabaFlag(entry.isleaf)
        : isTruthyAlibabaFlag(entry.is_leaf_category),
      features: uniqueStrings(collectStrings(entry.features)),
      names,
    }];
  });
}

export function normalizeAliExpressPostCategoryChildAttributes(responseBody: unknown) {
  const sellerPayload = getAliExpressSellerPayload(responseBody);
  const entries = Array.isArray(sellerPayload?.attributes) ? sellerPayload.attributes : [];

  return entries.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [] as Array<Record<string, unknown>>;
    }

    const attributeId = getStringValue(entry.id) ?? getStringValue(entry.attr_id) ?? getStringValue(entry.attribute_id);
    if (!attributeId) {
      return [] as Array<Record<string, unknown>>;
    }

    const names = normalizeAliExpressLocalizedNames(entry.names);
    const values = Array.isArray(entry.values)
      ? entry.values.flatMap((value) => {
          if (!isRecord(value)) {
            return [] as Array<Record<string, unknown>>;
          }

          const valueId = getStringValue(value.id) ?? getStringValue(value.value_id);
          if (!valueId) {
            return [] as Array<Record<string, unknown>>;
          }

          const valueNames = normalizeAliExpressLocalizedNames(value.names);
          return [{
            valueId,
            valueName: valueNames?.en ?? valueNames?.fr ?? getStringValue(value.name) ?? getStringValue(value.label),
            names: valueNames,
            hasSubAttributes: isTruthyAlibabaFlag(value.has_sub_attr),
            valueTags: uniqueStrings(collectStrings(value.value_tags)),
            afId: getStringValue(value.af_id),
          }];
        })
      : [];
    const units = Array.isArray(entry.units)
      ? entry.units.flatMap((unit) => {
          if (!isRecord(unit)) {
            return [] as Array<Record<string, unknown>>;
          }

          const unitName = getStringValue(unit.unit_name);
          return unitName ? [{ unitName, rate: getNumberValue(unit.rate) }] : [];
        })
      : [];

    return [{
      attributeId,
      attributeName: names?.en ?? names?.fr ?? getStringValue(entry.attribute_name) ?? getStringValue(entry.name),
      names,
      inputType: getStringValue(entry.input_type),
      skuStyleValue: getStringValue(entry.sku_style_value),
      attributeShowTypeValue: getStringValue(entry.attribute_show_type_value),
      visible: typeof entry.visible === "undefined" ? true : isTruthyAlibabaFlag(entry.visible),
      required: isTruthyAlibabaFlag(entry.required),
      keyAttribute: isTruthyAlibabaFlag(entry.key_attribute),
      customizedName: isTruthyAlibabaFlag(entry.customized_name),
      customizedPic: isTruthyAlibabaFlag(entry.customized_pic),
      values,
      units,
    }];
  });
}

export function normalizeAliExpressCategoryQualifications(responseBody: unknown) {
  const response = isRecord(responseBody) ? responseBody : null;
  const sellerPayload = getAliExpressSellerPayload(responseBody);
  const entries = Array.isArray(response?.qualification_module_list)
    ? response.qualification_module_list
    : Array.isArray(sellerPayload?.qualification_module_list)
      ? sellerPayload.qualification_module_list
      : [];

  return entries.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [] as Array<Record<string, unknown>>;
    }

    return [{
      key: getStringValue(entry.key),
      label: getStringValue(entry.label),
      type: getStringValue(entry.type),
      tips: getStringValue(entry.tips),
      parentName: getStringValue(entry.parentName),
      countryCode: getStringValue(entry.countryCode),
      required: isTruthyAlibabaFlag(entry.required),
    }];
  });
}

export function normalizeAliExpressCategoryCascadeProperties(responseBody: unknown) {
  const sellerPayload = getAliExpressSellerPayload(responseBody);
  const entries = Array.isArray(sellerPayload?.category_cascade_properties)
    ? sellerPayload.category_cascade_properties
    : [];

  const normalizeEntry = (entry: unknown): Record<string, unknown> | null => {
    if (!isRecord(entry)) {
      return null;
    }

    return {
      propId: getStringValue(entry.prop_id),
      propName: getStringValue(entry.prop_name),
      valueId: getStringValue(entry.value_id),
      label: getStringValue(entry.label),
      level: getNumberValue(entry.level),
      parentPropId: getStringValue(entry.parent_prop_id),
      parentValueId: getStringValue(entry.parent_value_id),
      groupId: getStringValue(entry.group_id),
      features: getStringValue(entry.features),
      valueName: getStringValue(entry.value_name),
      required: isTruthyAlibabaFlag(entry.required),
      subValues: Array.isArray(entry.sub_values)
        ? entry.sub_values.flatMap((subValue) => {
            const normalized = normalizeEntry(subValue);
            return normalized ? [normalized] : [];
          })
        : [],
    };
  };

  return entries.flatMap((entry) => {
    const normalized = normalizeEntry(entry);
    return normalized ? [normalized] : [];
  });
}

export function normalizeAliExpressSkuAttributeInfo(responseBody: unknown) {
  const sellerPayload = getAliExpressSellerPayload(responseBody);
  const commonEntries = Array.isArray(sellerPayload?.supporting_common_attribute_list)
    ? sellerPayload.supporting_common_attribute_list
    : [];
  const skuEntries = Array.isArray(sellerPayload?.supporting_sku_attribute_list)
    ? sellerPayload.supporting_sku_attribute_list
    : [];

  return {
    commonAttributes: commonEntries.flatMap((entry) => {
      if (!isRecord(entry)) {
        return [] as Array<Record<string, unknown>>;
      }

      return [{
        attributeNameId: getStringValue(entry.aliexpress_common_attribute_name_id),
        attributeName: getStringValue(entry.aliexpress_common_attribute_name),
        required: isTruthyAlibabaFlag(entry.required),
        values: Array.isArray(entry.aliexpress_common_attribute_value_list)
          ? entry.aliexpress_common_attribute_value_list.flatMap((value) => {
              if (!isRecord(value)) {
                return [] as Array<Record<string, unknown>>;
              }

              return [{
                valueId: getStringValue(value.aliexpress_common_attribute_value_id),
                valueName: getStringValue(value.aliexpress_common_attribute_value),
              }];
            })
          : [],
      }];
    }),
    skuAttributes: skuEntries.flatMap((entry) => {
      if (!isRecord(entry)) {
        return [] as Array<Record<string, unknown>>;
      }

      return [{
        skuNameId: getStringValue(entry.aliexpress_sku_name_id),
        skuName: getStringValue(entry.aliexpress_sku_name),
        required: isTruthyAlibabaFlag(entry.required),
        supportCustomizedPicture: isTruthyAlibabaFlag(entry.support_customized_picture),
        supportCustomizedName: isTruthyAlibabaFlag(entry.support_customized_name),
        values: Array.isArray(entry.aliexpress_sku_value_list)
          ? entry.aliexpress_sku_value_list.flatMap((value) => {
              if (!isRecord(value)) {
                return [] as Array<Record<string, unknown>>;
              }

              return [{
                valueId: getStringValue(value.aliexpress_sku_value_id),
                valueName: getStringValue(value.aliexpress_sku_value_name),
              }];
            })
          : [],
      }];
    }),
  };
}

export async function queryAliExpressDsFreight(input: {
  productId: string | number;
  quantity: string | number;
  shipToCountry: string;
  selectedSkuId?: string | number;
  provinceCode?: string;
  cityCode?: string;
  language?: string;
  currency?: string;
  locale?: string;
}) {
  if (!String(input.shipToCountry).trim()) {
    throw new Error("ship_to_country est obligatoire pour interroger le fret AliExpress DS.");
  }

  if (!String(input.productId).trim()) {
    throw new Error("product_id est obligatoire pour interroger le fret AliExpress DS.");
  }

  if (!String(input.quantity).trim()) {
    throw new Error("quantity est obligatoire pour interroger le fret AliExpress DS.");
  }

  return callAliExpressTopEndpoint("aliexpress.ds.freight.query", {
    queryDeliveryReq: JSON.stringify({
      quantity: String(input.quantity).trim(),
      shipToCountry: String(input.shipToCountry).trim().toUpperCase(),
      productId: String(input.productId).trim(),
      ...(String(input.selectedSkuId ?? "").trim() ? { selectedSkuId: String(input.selectedSkuId).trim() } : {}),
      ...(String(input.provinceCode ?? "").trim() ? { provinceCode: String(input.provinceCode).trim() } : {}),
      ...(String(input.cityCode ?? "").trim() ? { cityCode: String(input.cityCode).trim() } : {}),
      language: input.language ?? process.env.ALIEXPRESS_DEFAULT_LANGUAGE ?? "en_US",
      currency: input.currency ?? process.env.ALIEXPRESS_DS_PAYMENT_CURRENCY ?? "USD",
      locale: input.locale ?? process.env.ALIEXPRESS_DEFAULT_LOCALE ?? process.env.ALIEXPRESS_DEFAULT_LANGUAGE ?? "en_US",
    }),
  }, {
    credentials: await resolveAlibabaCredentialsForLiveCall(),
    method: "POST",
  });
}

export async function queryAliExpressDsAddress(input: {
  countryCode: string;
  language?: string;
  isMultiLanguage?: boolean;
}) {
  if (!String(input.countryCode).trim()) {
    throw new Error("countryCode est obligatoire pour interroger l'adresse DS AliExpress.");
  }

  return callAliExpressTopEndpoint("aliexpress.ds.address.get", {
    countryCode: String(input.countryCode).trim().toUpperCase(),
    ...(String(input.language ?? "").trim() ? { language: String(input.language).trim() } : {}),
    ...(typeof input.isMultiLanguage === "boolean" ? { isMultiLanguage: String(input.isMultiLanguage) } : {}),
  }, {
    credentials: await resolveAlibabaCredentialsForLiveCall(),
    method: "POST",
  });
}

export function normalizeAliExpressDsAddressOptions(responseBody: unknown): AliExpressDsAddressOption[] {
  const sellerPayload = getAliExpressSellerPayload(responseBody);
  const data = sellerPayload && typeof sellerPayload === "object" && sellerPayload !== null
    ? (sellerPayload as Record<string, unknown>).data
    : undefined;

  const entries = Array.isArray(data)
    ? data
    : data && typeof data === "object" && !Array.isArray(data)
      ? [data]
      : [];

  return entries.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [] as AliExpressDsAddressOption[];
    }

    return [{
      countryCode: getStringValue(entry.country),
      type: getStringValue(entry.type),
      childrenJson: getStringValue(entry.children),
    } satisfies AliExpressDsAddressOption];
  });
}

export async function editAlibabaIcbuProductPrice(input: AlibabaEditProductPriceInput) {
  if (!String(input.productId).trim()) {
    throw new Error("product_id est obligatoire pour modifier le prix Alibaba.");
  }

  if ((!input.price || Object.keys(input.price).length === 0) && (!input.skuPrice || input.skuPrice.length === 0)) {
    throw new Error("Renseignez soit le prix SPU, soit les prix SKU.");
  }

  if (input.price && Object.keys(input.price).length > 0 && input.skuPrice && input.skuPrice.length > 0) {
    throw new Error("Impossible de modifier simultanement les prix SPU et SKU.");
  }

  return callAlibabaEndpoint("/icbu/product/edit-price", {
    product_id: String(input.productId),
    ...(input.price && Object.keys(input.price).length > 0 ? { price: input.price } : {}),
    ...(input.skuPrice && input.skuPrice.length > 0 ? { sku_price: input.skuPrice } : {}),
  }, {
    credentials: await resolveAlibabaCredentialsForLiveCall(),
  });
}

export async function updateAlibabaIcbuProduct(input: {
  productInfo: Record<string, unknown>;
}) {
  if (!isRecord(input.productInfo) || Object.keys(input.productInfo).length === 0) {
    throw new Error("product_info est obligatoire pour mettre a jour une fiche Alibaba.");
  }

  return callAlibabaEndpoint("/alibaba/icbu/product/update/v2", {
    product_info: input.productInfo,
  }, {
    credentials: await resolveAlibabaCredentialsForLiveCall(),
  });
}

export async function calculateAlibabaBasicFreight(input: AlibabaBasicFreightInput) {
  if (!String(input.destinationCountry).trim()) {
    throw new Error("destination_country est obligatoire pour estimer le fret Alibaba.");
  }

  if (!String(input.productId).trim()) {
    throw new Error("product_id est obligatoire pour estimer le fret Alibaba.");
  }

  if (!String(input.quantity).trim()) {
    throw new Error("quantity est obligatoire pour estimer le fret Alibaba.");
  }

  const credentials = await resolveAlibabaCredentialsForLiveCall();
  if (isAliExpressCredentials(credentials)) {
    return queryAliExpressDsFreight({
      productId: input.productId,
      quantity: input.quantity,
      shipToCountry: input.destinationCountry,
      selectedSkuId: input.selectedSkuId,
      provinceCode: input.provinceCode,
      cityCode: input.cityCode,
      language: input.language,
      currency: input.currency,
      locale: input.locale,
    });
  }

  return callAlibabaEndpoint("/shipping/freight/calculate", {
    destination_country: String(input.destinationCountry).trim().toUpperCase(),
    product_id: String(input.productId).trim(),
    quantity: String(input.quantity).trim(),
    ...(String(input.zipCode ?? "").trim() ? { zip_code: String(input.zipCode).trim() } : {}),
    ...(String(input.dispatchLocation ?? "").trim() ? { dispatch_location: String(input.dispatchLocation).trim() } : {}),
    ...(typeof input.enableDistributionWaybill === "boolean"
      ? { enable_distribution_waybill: input.enableDistributionWaybill }
      : {}),
  }, {
    credentials,
  });
}

export async function calculateAlibabaAdvancedFreight(input: AlibabaAdvancedFreightInput) {
  if (!String(input.destinationCountry).trim()) {
    throw new Error("destination_country est obligatoire pour le calcul avance du fret Alibaba.");
  }

  if (!Array.isArray(input.logisticsProductList) || input.logisticsProductList.length === 0) {
    throw new Error("logistics_product_list doit contenir au moins un produit.");
  }

  const credentials = await resolveAlibabaCredentialsForLiveCall();
  if (isAliExpressCredentials(credentials)) {
    const primaryItem = input.logisticsProductList[0];
    if (input.logisticsProductList.length > 1) {
      throw new Error("AliExpress DS freight.query ne gere qu'un produit par appel. Envoie un seul article pour le calcul de fret DS.");
    }

    const address = isRecord(input.address) ? input.address : null;
    return queryAliExpressDsFreight({
      productId: primaryItem.productId,
      quantity: primaryItem.quantity,
      selectedSkuId: primaryItem.skuId,
      shipToCountry: input.destinationCountry,
      provinceCode: input.provinceCode ?? getStringValue(address?.provinceCode) ?? getStringValue(address?.province_code),
      cityCode: input.cityCode ?? getStringValue(address?.cityCode) ?? getStringValue(address?.city_code),
      language: input.language,
      currency: input.currency,
      locale: input.locale,
    });
  }

  if (!String(input.eCompanyId).trim()) {
    throw new Error("e_company_id est obligatoire pour le calcul avance du fret Alibaba.");
  }

  return callAlibabaEndpoint("/order/freight/calculate", {
    e_company_id: String(input.eCompanyId).trim(),
    destination_country: String(input.destinationCountry).trim().toUpperCase(),
    logistics_product_list: input.logisticsProductList.map((item) => ({
      quantity: String(item.quantity).trim(),
      product_id: String(item.productId).trim(),
      ...(String(item.skuId ?? "").trim() ? { sku_id: String(item.skuId).trim() } : {}),
    })),
    ...(input.address && isRecord(input.address) ? { address: input.address } : {}),
    ...(String(input.dispatchLocation ?? "").trim() ? { dispatch_location: String(input.dispatchLocation).trim() } : {}),
    ...(typeof input.enableDistributionWaybill === "boolean"
      ? { enable_distribution_waybill: input.enableDistributionWaybill }
      : {}),
  }, {
    credentials,
  });
}

export function normalizeAlibabaFreightOptions(responseBody: unknown): AlibabaFreightOption[] {
  const response = isRecord(responseBody) ? responseBody : null;
  const sellerPayload = getAliExpressSellerPayload(responseBody);
  const deliveryOptions = Array.isArray(sellerPayload?.delivery_options)
    ? sellerPayload.delivery_options
    : isRecord(sellerPayload?.delivery_options) && Array.isArray(sellerPayload.delivery_options.delivery_option_d_t_o)
      ? sellerPayload.delivery_options.delivery_option_d_t_o
      : [];
  if (deliveryOptions.length > 0) {
    return deliveryOptions.flatMap((entry) => {
      if (!isRecord(entry)) {
        return [] as AlibabaFreightOption[];
      }

      return [{
        destinationCountry: getStringValue(sellerPayload?.ship_to_country),
        vendorCode: getStringValue(entry.code),
        vendorName: getStringValue(entry.company),
        shippingType: getStringValue(entry.code),
        dispatchCountry: getStringValue(entry.ship_from_country),
        deliveryTime: getStringValue(entry.delivery_date_desc)
          ?? getStringValue(entry.estimated_delivery_time)
          ?? (getStringValue(entry.min_delivery_days) || getStringValue(entry.max_delivery_days)
            ? `${getStringValue(entry.min_delivery_days) ?? "?"}-${getStringValue(entry.max_delivery_days) ?? "?"} jours`
            : undefined),
        feeAmount: getNumberValue(entry.shipping_fee_cent, entry.shipping_fee),
        feeCurrency: getStringValue(entry.shipping_fee_currency),
      } satisfies AlibabaFreightOption];
    });
  }

  const entries = Array.isArray(response?.value) ? response.value : [];

  return entries.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [] as AlibabaFreightOption[];
    }

    const fee = isRecord(entry.fee) ? entry.fee : null;
    return [{
      destinationCountry: getStringValue(entry.destination_country),
      vendorCode: getStringValue(entry.vendor_code),
      vendorName: getStringValue(entry.vendor_name),
      shippingType: getStringValue(entry.shipping_type),
      dispatchCountry: getStringValue(entry.dispatch_country),
      solutionBizType: getStringValue(entry.solution_biz_type),
      tradeTerm: getStringValue(entry.trade_term),
      deliveryTime: getStringValue(entry.delivery_time),
      storeType: getStringValue(entry.store_type),
      feeAmount: getNumberValue(fee?.amount),
      feeCurrency: getStringValue(fee?.currency),
    } satisfies AlibabaFreightOption];
  });
}

export async function queryAlibabaMergePay(input: { orderIds: Array<string | number> }) {
  const orderIds = Array.isArray(input.orderIds)
    ? input.orderIds.map((value) => String(value).trim()).filter(Boolean)
    : [];

  if (orderIds.length === 0) {
    throw new Error("order_ids doit contenir au moins une commande.");
  }

  return callAlibabaEndpoint("/order/merge/pay/query", {
    order_ids: orderIds,
  }, {
    credentials: await resolveAlibabaCredentialsForLiveCall(),
  });
}

export function normalizeAlibabaMergePayGroups(responseBody: unknown): AlibabaMergePayGroup[] {
  const response = isRecord(responseBody) ? responseBody : null;
  const value = isRecord(response?.value) ? response.value : null;
  const groups = Array.isArray(value?.groups) ? value.groups : [];

  return groups.flatMap((group) => {
    if (!isRecord(group)) {
      return [] as AlibabaMergePayGroup[];
    }

    const canMergePayOrderItems = Array.isArray(group.can_merge_pay_order_items)
      ? group.can_merge_pay_order_items
      : [];
    const canNotMergePayOrderItems = Array.isArray(group.can_not_merge_pay_order_items)
      ? group.can_not_merge_pay_order_items
      : [];

    return [{
      groupCode: getStringValue(group.group_code),
      canMergePay: isTruthyAlibabaFlag(group.can_merge_pay),
      canNotMergePayReason: getStringValue(group.can_not_merge_pay_reason),
      canNotMergePayReasonMessage: getStringValue(group.can_not_merge_pay_reason_message),
      canMergePayOrderIds: canMergePayOrderItems.flatMap((item) => {
        if (!isRecord(item)) {
          return [] as string[];
        }

        const orderId = getStringValue(item.order_id);
        return orderId ? [orderId] : [];
      }),
      canNotMergePayOrderItems: canNotMergePayOrderItems.flatMap((item) => {
        if (!isRecord(item)) {
          return [] as AlibabaMergePayGroup["canNotMergePayOrderItems"];
        }

        return [{
          orderId: getStringValue(item.order_id),
          reason: getStringValue(item.can_not_merge_pay_reason),
          reasonMessage: getStringValue(item.can_not_merge_pay_reason_message),
        }];
      }),
    } satisfies AlibabaMergePayGroup];
  });
}

export async function queryAlibabaOrderLogisticsTracking(input: { tradeId: string | number; language?: string }) {
  if (!String(input.tradeId).trim()) {
    throw new Error("trade_id est obligatoire pour lire le suivi logistique Alibaba.");
  }

  const credentials = await resolveAlibabaCredentialsForLiveCall();
  if (isAliExpressCredentials(credentials)) {
    return callAliExpressTopEndpoint("aliexpress.ds.order.tracking.get", {
      ae_order_id: String(input.tradeId).trim(),
      language: input.language ?? process.env.ALIEXPRESS_DEFAULT_LANGUAGE ?? "en_US",
    }, {
      credentials,
      method: "POST",
    });
  }

  return callAlibabaEndpoint("/order/logistics/tracking/get", {
    trade_id: String(input.tradeId).trim(),
  }, {
    credentials,
  });
}

export async function uploadAlibabaOrderAttachment(input: {
  fileName: string;
  data: Uint8Array | ArrayBuffer;
}) {
  const normalizedName = String(input.fileName).trim();
  if (!normalizedName) {
    throw new Error("file_name est obligatoire pour envoyer une piece jointe Alibaba.");
  }

  if (!/\.(jpg|jpeg|png|pdf|doc)$/i.test(normalizedName)) {
    throw new Error("file_name doit terminer par .jpg, .jpeg, .png, .pdf ou .doc.");
  }

  const fileBytes = input.data instanceof Uint8Array ? input.data : new Uint8Array(input.data);
  if (fileBytes.byteLength === 0) {
    throw new Error("Le fichier Alibaba est vide.");
  }

  if (fileBytes.byteLength > 5 * 1024 * 1024) {
    throw new Error("Le fichier depasse la limite Alibaba de 5 MB.");
  }

  return callAlibabaMultipartEndpoint({
    pathOrUrl: "/alibaba/order/attachment/upload",
    payload: {
      file_name: normalizedName,
    },
    fileFieldName: "data",
    fileName: normalizedName,
    fileBytes,
  });
}

function extractAliExpressTrackingLines(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isRecord(value)) {
    return [] as unknown[];
  }

  if (Array.isArray(value.tracking_detail)) {
    return value.tracking_detail;
  }

  if (Array.isArray(value.tracking_detail_line_list)) {
    return value.tracking_detail_line_list;
  }

  return [] as unknown[];
}

function extractAliExpressTrackingDetailNodes(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isRecord(value)) {
    return [] as unknown[];
  }

  if (Array.isArray(value.detail_node)) {
    return value.detail_node;
  }

  if (Array.isArray(value.detail_node_list)) {
    return value.detail_node_list;
  }

  return [] as unknown[];
}

function normalizeAliExpressTrackingEventTime(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  return getStringValue(value);
}

export function normalizeAlibabaLogisticsTracking(responseBody: unknown): AlibabaLogisticsTracking[] {
  const sellerPayload = getAliExpressSellerPayload(responseBody);
  const trackingData = sellerPayload && isRecord(sellerPayload.data) ? sellerPayload.data : null;
  const trackingLines = extractAliExpressTrackingLines(trackingData?.tracking_detail_line_list);
  if (trackingLines.length > 0) {
    return trackingLines.flatMap((entry) => {
      if (!isRecord(entry)) {
        return [] as AlibabaLogisticsTracking[];
      }

      const detailNodes = extractAliExpressTrackingDetailNodes(entry.detail_node_list);
      const normalizedEvents = detailNodes.flatMap((event) => {
        if (!isRecord(event)) {
          return [] as AlibabaLogisticsTrackingEvent[];
        }

        return [{
          eventCode: getStringValue(event.tracking_name),
          eventLocation: getStringValue(event.location),
          eventName: getStringValue(event.tracking_detail_desc) ?? getStringValue(event.tracking_name),
          eventTime: normalizeAliExpressTrackingEventTime(event.time_stamp),
        } satisfies AlibabaLogisticsTrackingEvent];
      });

      return [{
        carrier: getStringValue(entry.carrier_name),
        trackingNumber: getStringValue(entry.mail_no),
        currentEventCode: normalizedEvents[0]?.eventCode,
        eventList: normalizedEvents,
      } satisfies AlibabaLogisticsTracking];
    });
  }

  const response = isRecord(responseBody) ? responseBody : null;
  const entries = Array.isArray(response?.tracking_list) ? response.tracking_list : [];

  return entries.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [] as AlibabaLogisticsTracking[];
    }

    const eventList = Array.isArray(entry.event_list) ? entry.event_list : [];
    return [{
      carrier: getStringValue(entry.carrier),
      trackingNumber: getStringValue(entry.tracking_number),
      trackingUrl: getStringValue(entry.tracking_url),
      currentEventCode: getStringValue(entry.current_event_code),
      eventList: eventList.flatMap((event) => {
        if (!isRecord(event)) {
          return [] as AlibabaLogisticsTrackingEvent[];
        }

        return [{
          eventCode: getStringValue(event.event_code),
          eventLocation: getStringValue(event.event_location),
          eventName: getStringValue(event.event_name),
          eventTime: getStringValue(event.event_time),
        } satisfies AlibabaLogisticsTrackingEvent];
      }),
    } satisfies AlibabaLogisticsTracking];
  });
}

export async function cancelAlibabaOrder(input: { tradeId: string | number }) {
  if (!String(input.tradeId).trim()) {
    throw new Error("trade_id est obligatoire pour annuler une commande Alibaba.");
  }

  return callAlibabaEndpoint("/alibaba/order/cancel", {
    trade_id: String(input.tradeId).trim(),
  }, {
    credentials: await resolveAlibabaCredentialsForLiveCall(),
  });
}

export { extractAlibabaOperationCode, extractAlibabaOperationMessage, extractAlibabaTradeId, isAlibabaOperationSuccessful };

export async function createAlibabaDropshippingPayment(input: {
  tradeId?: string;
  paymentRequest?: Record<string, unknown>;
}) {
  const credentials = await resolveAlibabaCredentialsForLiveCall();
  if (isAliExpressCredentials(credentials)) {
    return {
      ok: true,
      endpoint: "aliexpress.ds.order.create",
      requestBody: input.paymentRequest ?? { tradeId: input.tradeId },
      responseBody: {
        code: "0",
        result: {
          success: "true",
          provider: "aliexpress-ds",
          mode: "embedded_order_create_or_autopay",
          message: "AliExpress DS utilise order.create avec try_to_pay ou l'auto-pay du compte, sans endpoint de paiement separe dans ce flux.",
        },
      },
      status: 200,
    };
  }

  const paymentRequest = input.paymentRequest && isRecord(input.paymentRequest)
    ? input.paymentRequest
    : undefined;

  if (!paymentRequest && !String(input.tradeId ?? "").trim()) {
    throw new Error("tradeId ou paymentRequest est obligatoire pour le paiement dropshipping Alibaba.");
  }

  return callAlibabaEndpoint("/alibaba/dropshipping/order/pay", {
    ...(paymentRequest
      ? { param_order_pay_request: paymentRequest }
      : { trade_id: String(input.tradeId).trim() }),
  }, {
    credentials,
  });
}

export async function queryAlibabaPaymentResult(input: { tradeId: string }) {
  const credentials = await resolveAlibabaCredentialsForLiveCall();
  if (isAliExpressCredentials(credentials)) {
    return callAliExpressTopEndpoint("aliexpress.trade.ds.order.get", {
      single_order_query: JSON.stringify({ order_id: input.tradeId }),
    }, {
      credentials,
      method: "POST",
    });
  }

  return callAlibabaEndpoint("/alibaba/order/pay/result/query", {
    trade_id: input.tradeId,
  }, {
    credentials,
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
  authorizeUrl.searchParams.set("state", encodeAlibabaOAuthState({
    accountId: input.account.id,
    redirectUri: input.redirectUri,
  }));
  if (isAliExpressAccount(input.account)) {
    authorizeUrl.searchParams.set("force_auth", "true");
  }

  return authorizeUrl.toString();
}

export async function exchangeAlibabaOAuthCode(input: { accountId: string; code: string; redirectUri?: string }) {
  const accounts = await getAlibabaSupplierAccounts();
  const persistedAccount = accounts.find((entry) => entry.id === input.accountId);
  const envCredentials = getEnvCredentials();
  let account = persistedAccount;
  let credentials = getAccountCredentials(account);

  if ((!account || !credentials) && envCredentials) {
    const timestamp = new Date().toISOString();
    account = {
      id: input.accountId,
      name: "AliExpress OAuth",
      email: "oauth@aliexpress.local",
      accountPlatform: "seller",
      countryCode: "CI",
      defaultDispatchLocation: "CN",
      status: "needs_auth",
      appKey: envCredentials.appKey,
      appSecret: envCredentials.appSecret,
      authorizeUrl: envCredentials.authorizeUrl,
      tokenUrl: envCredentials.tokenUrl,
      refreshUrl: envCredentials.refreshUrl,
      apiBaseUrl: envCredentials.apiBaseUrl,
      isActive: true,
      hasAppSecret: Boolean(envCredentials.appSecret),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    credentials = getAccountCredentials(account);
    console.warn("[aliexpress/oauth] supplier account missing at callback; using env credential fallback", {
      accountId: input.accountId,
    });
  }

  if (!account || !credentials) {
    throw new Error("Compte Alibaba introuvable ou incomplet. Verifie la persistance des comptes (DB ou Vercel Blob) et reconnecte le compte.");
  }

  const tokenUrl = account.tokenUrl || credentials.tokenUrl;

  try {
    let result: Awaited<ReturnType<typeof callAlibabaEndpoint>> | null = null;

    for (const candidateUrl of getAliExpressOAuthEndpointCandidates(tokenUrl, "token")) {
      const tokenPayload: Record<string, string> = {
        code: input.code,
      };

      if (usesAliExpressSecurityTokenEndpoint(candidateUrl, "token")) {
        tokenPayload.uuid = randomUUID();
      }

      result = await callAlibabaEndpoint(candidateUrl, tokenPayload, {
        includeAccessToken: false,
        credentials,
      });

      if (result.ok && isAliExpressOAuthTokenResponseSuccessful(result.responseBody)) {
        break;
      }

      if (!shouldTryAliExpressOAuthAlternateEndpoint(result.responseBody) || candidateUrl === getAliExpressOAuthEndpointCandidates(tokenUrl, "token").at(-1)) {
        throw new Error(getAliExpressOAuthResponseMessage(result.responseBody) ?? "Generation du token d'acces AliExpress impossible.");
      }
    }

    if (!result || !result.ok || !isAliExpressOAuthTokenResponseSuccessful(result.responseBody)) {
      throw new Error(result ? (getAliExpressOAuthResponseMessage(result.responseBody) ?? "Generation du token d'acces AliExpress impossible.") : "Generation du token d'acces AliExpress impossible.");
    }

    const body = getAliExpressOAuthResponseBody(result.responseBody) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: string | number;
      refresh_expires_in?: string | number;
      country?: string;
      locale?: string;
      account_id?: string;
    account?: string;
    account_platform?: string;
    havana_id?: string;
    seller_id?: string;
    user_id?: string;
    user_nick?: string;
    user_info?: { loginId?: string; seller_id?: string; user_id?: string };
    };

    const nextAccount: AlibabaSupplierAccount = {
      ...account,
      accountPlatform: mapAliExpressOAuthAccountPlatform(body.account_platform) ?? account.accountPlatform,
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      accessTokenExpiresAt: body.expires_in ? new Date(Date.now() + Number(body.expires_in) * 1000).toISOString() : account.accessTokenExpiresAt,
      refreshTokenExpiresAt: body.refresh_expires_in ? new Date(Date.now() + Number(body.refresh_expires_in) * 1000).toISOString() : account.refreshTokenExpiresAt,
      oauthCountry: body.country ?? body.locale ?? account.oauthCountry,
      accountId: body.account_id ?? body.user_id ?? body.havana_id ?? account.accountId,
      accountLogin: body.account ?? body.user_nick ?? body.user_info?.loginId ?? account.accountLogin,
      accountName: body.user_nick ?? body.user_info?.loginId ?? account.accountName,
      memberId: body.seller_id ?? body.user_id ?? body.user_info?.seller_id ?? body.user_info?.user_id ?? account.memberId,
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation du token d'acces AliExpress impossible.";

    if (account) {
      await saveAlibabaSupplierAccount({
        ...account,
        status: "needs_auth",
        lastError: message,
        updatedAt: new Date().toISOString(),
      });
    }

    throw error;
  }
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

type SupplierAutomationEntry = {
  item: SourcingOrder["items"][number];
  mapping?: AlibabaCatalogMapping;
};

type PreparedSupplierAutomationGroup = {
  supplierCompanyId: string;
  entries: SupplierAutomationEntry[];
  dispatchLocation: string;
  carrierCode?: string;
  freightOptions: AlibabaFreightOption[];
  freightResponseBody?: unknown;
};

type AlibabaFreightVerificationResult = {
  freightStatus: "verified" | "failed" | "skipped";
  freightPayload: unknown;
  preparedGroups: PreparedSupplierAutomationGroup[];
  internalFulfillment?: Awaited<ReturnType<typeof getInternalSupplierFulfillment>>;
  failureReason?: string;
};

function buildAlibabaFreightAddress(address: Awaited<ReturnType<typeof getInternalSupplierFulfillment>>["address"]) {
  return {
    zip: address.postalCode ?? "",
    country: {
      code: address.countryCode,
      name: address.countryCode,
    },
    address: [address.addressLine1, address.addressLine2].filter(Boolean).join(", "),
    province: {
      code: address.state,
      name: address.state,
    },
    city: {
      code: address.city,
      name: address.city,
    },
  };
}

function buildAlibabaShipmentAddress(address: Awaited<ReturnType<typeof getInternalSupplierFulfillment>>["address"]) {
  return {
    address: address.addressLine1,
    alternate_address: address.addressLine2 ?? "",
    city: address.city,
    province: address.state,
    country: address.countryCode,
    country_code: address.countryCode,
    zip: address.postalCode ?? "",
    contact_person: address.contactName,
    email: address.email,
    port: address.port ?? "",
    port_code: address.portCode ?? "",
    telephone: {
      country: address.countryCode,
      area: "",
      number: address.phone,
    },
  };
}

function normalizeAddressBlockLines(value: string) {
  return value
    .split(/\r?\n|;/)
    .flatMap((segment) => segment.split(/,(?!\s*\d{6}\b)/))
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function extractLabeledAddressValue(lines: string[], patterns: RegExp[]) {
  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match?.[1]?.trim()) {
        return match[1].trim();
      }
    }
  }

  return "";
}

function parseChinaForwarderAddressBlock(order: SourcingOrder, block: string) {
  const lines = normalizeAddressBlockLines(block);
  const collapsed = lines.join(" ");
  const contactName = extractLabeledAddressValue(lines, [
    /(?:contact|recipient|receiver|name|收件人|联系人)\s*[:：-]\s*(.+)$/i,
  ]) || order.customerName;
  const phone = extractLabeledAddressValue(lines, [
    /(?:phone|mobile|tel|telephone|电话|手机)\s*[:：-]\s*(.+)$/i,
  ]) || order.customerPhone;
  const postalCode = extractLabeledAddressValue(lines, [
    /(?:zip|postal|postcode|post code|邮编)\s*[:：-]\s*(\d{6})$/i,
  ]) || (collapsed.match(/\b\d{6}\b/)?.[0] ?? order.postalCode ?? "");
  const provinceMatch = collapsed.match(/([\u4e00-\u9fffA-Za-z\s]+?(?:省|自治区|特别行政区|市))/u);
  const cityMatch = collapsed.match(/([\u4e00-\u9fffA-Za-z\s]+?市)/u);

  const normalizedLines = lines.filter((line) => !/(?:contact|recipient|receiver|name|收件人|联系人|phone|mobile|tel|telephone|电话|手机|zip|postal|postcode|post code|邮编)\s*[:：-]/i.test(line));
  const addressLine1 = normalizedLines[0] || order.addressLine1;
  const addressLine2 = normalizedLines.length > 1 ? normalizedLines.slice(1).join(", ") : order.addressLine2;

  return {
    contactName,
    phone,
    postalCode,
    state: provinceMatch?.[1]?.trim() || order.state || "Guangdong",
    city: cityMatch?.[1]?.trim() || order.city || provinceMatch?.[1]?.trim() || "Shenzhen",
    addressLine1,
    addressLine2,
  };
}

function buildCustomerForwarderFulfillment(order: SourcingOrder) {
  const meta = getSourcingOrderMeta(order);
  const forwarder = meta.deliveryProfile?.forwarder;
  const useChinaHub = forwarder?.hub === "china" || order.countryCode === "CN";
  const forwarderBlock = forwarder?.addressBlock?.trim();
  const parsedChinaForwarder = useChinaHub && forwarderBlock ? parseChinaForwarderAddressBlock(order, forwarderBlock) : null;
  const address: AlibabaReceptionAddress = {
    id: `customer-forwarder-${order.id}`,
    label: useChinaHub ? "Customer Forwarder China" : "Customer Forwarder Lome",
    contactName: parsedChinaForwarder?.contactName || order.customerName,
    phone: parsedChinaForwarder?.phone || order.customerPhone,
    email: order.customerEmail,
    addressLine1: parsedChinaForwarder?.addressLine1 || forwarderBlock?.split(/\n|,/).map((segment) => segment.trim()).filter(Boolean)[0] || order.addressLine1,
    addressLine2: parsedChinaForwarder?.addressLine2 || (forwarderBlock && forwarderBlock !== order.addressLine1 ? forwarderBlock : order.addressLine2),
    city: parsedChinaForwarder?.city || order.city,
    state: parsedChinaForwarder?.state || order.state,
    postalCode: parsedChinaForwarder?.postalCode || order.postalCode,
    countryCode: useChinaHub ? "CN" : "TG",
    isDefault: false,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };

  return {
    operatorName: useChinaHub ? "Agent client Chine" : "Agent client Lome",
    shippingMark: forwarder?.parcelMarking?.trim() || `Client ${order.customerName} ${order.customerPhone}`,
    address,
  };
}

function buildCustomerDeliveryFulfillment(order: SourcingOrder) {
  const address: AlibabaReceptionAddress = {
    id: `customer-delivery-${order.id}`,
    label: "Customer Delivery Address",
    contactName: order.customerName,
    phone: order.customerPhone,
    email: order.customerEmail,
    addressLine1: order.addressLine1,
    addressLine2: order.addressLine2,
    city: order.city,
    state: order.state,
    postalCode: order.postalCode,
    countryCode: order.countryCode,
    isDefault: false,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };

  return {
    operatorName: "Livraison directe AliExpress",
    shippingMark: `Client ${order.customerName} ${order.customerPhone}`,
    address,
  };
}

async function resolveSupplierFulfillment(order: SourcingOrder) {
  const meta = getSourcingOrderMeta(order);
  if (meta.workflow?.routeType === "customer-forwarder") {
    return buildCustomerForwarderFulfillment(order);
  }

  if (!meta.deliveryProfile?.usesInternalReceptionAddress) {
    return buildCustomerDeliveryFulfillment(order);
  }

  return getInternalSupplierFulfillment(order);
}

async function prepareSupplierAutomationContext(order: SourcingOrder, mappings: AlibabaCatalogMapping[]) {
  const credentials = await resolveAlibabaCredentials();
  const { missingMappings, groups } = groupMappingsForOrder(order, mappings);
  const internalFulfillment = await resolveSupplierFulfillment(order);

  return {
    credentials,
    missingMappings,
    groups: groups.map(([supplierCompanyId, entries]) => ({
      supplierCompanyId,
      entries: entries.map((entry) => ({
        item: entry.item,
        mapping: entry.mapping,
      } satisfies SupplierAutomationEntry)),
    })),
    internalFulfillment,
  };
}

export async function verifyAlibabaSupplierFreight(order: SourcingOrder, mappings: AlibabaCatalogMapping[]): Promise<AlibabaFreightVerificationResult> {
  const context = await prepareSupplierAutomationContext(order, mappings);

  if (!context.credentials) {
    await createAlibabaIntegrationLog({
      orderId: order.id,
      action: "freight-verification",
      endpoint: "env",
      status: "skipped_missing_credentials",
      requestBody: { orderNumber: order.orderNumber },
      responseBody: { message: "Missing ALIBABA_OPEN_PLATFORM_APP_KEY or ALIBABA_OPEN_PLATFORM_APP_SECRET" },
    });

    return {
      freightStatus: "skipped",
      freightPayload: { skipped: true, reason: "missing_credentials" },
      preparedGroups: [],
      internalFulfillment: context.internalFulfillment,
      failureReason: "missing_credentials",
    };
  }

  if (context.missingMappings.length > 0) {
    const missingSlugs = context.missingMappings.map((entry) => entry.item.slug);
    await createAlibabaIntegrationLog({
      orderId: order.id,
      action: "freight-verification",
      endpoint: "catalog-mapping",
      status: "skipped_missing_mapping",
      requestBody: { missingSlugs },
      responseBody: { message: "One or more cart items are missing Alibaba mapping data" },
    });

    return {
      freightStatus: "skipped",
      freightPayload: { skipped: true, reason: "missing_mapping", missingSlugs },
      preparedGroups: [],
      internalFulfillment: context.internalFulfillment,
      failureReason: "missing_mapping",
    };
  }

  const preparedGroups: PreparedSupplierAutomationGroup[] = [];
  const freightResponses: unknown[] = [];
  let freightStatus: "verified" | "failed" = "verified";

  for (const group of context.groups) {
    const dispatchLocation = group.entries[0]?.mapping?.dispatchLocation ?? "CN";
    const freightResult = await calculateAlibabaAdvancedFreight({
      eCompanyId: group.supplierCompanyId,
      destinationCountry: context.internalFulfillment.address.countryCode,
      address: buildAlibabaFreightAddress(context.internalFulfillment.address),
      dispatchLocation,
      logisticsProductList: group.entries.map((entry) => ({
        productId: entry.mapping?.alibabaProductId ?? "",
        skuId: entry.item.supplierSkuId ?? entry.mapping?.skuId ?? "",
        quantity: entry.item.quantity,
      })),
    });

    const freightOptions = normalizeAlibabaFreightOptions(freightResult.responseBody);
    const carrierCode = freightOptions[0]?.vendorCode;
    const responseBody = {
      supplierCompanyId: group.supplierCompanyId,
      dispatchLocation,
      options: freightOptions,
      responseBody: freightResult.responseBody,
      requestOk: freightResult.ok,
    };
    freightResponses.push(responseBody);

    await createAlibabaIntegrationLog({
      orderId: order.id,
      action: "freight-verification",
      endpoint: freightResult.endpoint,
      status: freightResult.ok ? "success" : "failed",
      requestBody: {
        eCompanyId: group.supplierCompanyId,
        destinationCountry: context.internalFulfillment.address.countryCode,
        dispatchLocation,
        logisticsProductList: group.entries.map((entry) => ({
          productId: entry.mapping?.alibabaProductId,
          skuId: entry.item.supplierSkuId ?? entry.mapping?.skuId ?? "",
          quantity: entry.item.quantity,
        })),
      },
      responseBody,
    });

    preparedGroups.push({
      supplierCompanyId: group.supplierCompanyId,
      entries: group.entries,
      dispatchLocation,
      carrierCode,
      freightOptions,
      freightResponseBody: freightResult.responseBody,
    });

    if (!freightResult.ok) {
      freightStatus = "failed";
    }
  }

  return {
    freightStatus,
    freightPayload: freightResponses,
    preparedGroups,
    internalFulfillment: context.internalFulfillment,
    ...(freightStatus === "failed" ? { failureReason: "freight_request_failed" } : {}),
  };
}

export async function createAlibabaSupplierOrders(order: SourcingOrder, mappings: AlibabaCatalogMapping[], verification?: AlibabaFreightVerificationResult) {
  const freightVerification = verification ?? await verifyAlibabaSupplierFreight(order, mappings);

  if (freightVerification.freightStatus !== "verified" || !freightVerification.internalFulfillment) {
    return {
      supplierOrderStatus: freightVerification.freightStatus === "skipped" ? "skipped" as const : "failed" as const,
      alibabaTradeIds: [] as string[],
      supplierOrderPayload: freightVerification.freightStatus === "skipped"
        ? { skipped: true, reason: freightVerification.failureReason ?? "freight_not_verified" }
        : { failed: true, reason: freightVerification.failureReason ?? "freight_not_verified" },
    };
  }

  const supplierResponses: unknown[] = [];
  const tradeIds: string[] = [];
  let supplierOrderStatus: "created" | "failed" = "created";

  for (const group of freightVerification.preparedGroups) {
    if (!group.carrierCode) {
      supplierResponses.push({
        supplierCompanyId: group.supplierCompanyId,
        carrierCode: undefined,
        requestOk: false,
        responseBody: {
          code: "missing_carrier_code",
          message: "Aucun transporteur valide n'a ete retourne par la verification fret Alibaba pour ce fournisseur.",
        },
      });
      await createAlibabaIntegrationLog({
        orderId: order.id,
        action: "supplier-order-create",
        endpoint: "/buynow/order/create",
        status: "failed",
        requestBody: {
          supplierCompanyId: group.supplierCompanyId,
          reason: "missing_carrier_code",
        },
        responseBody: {
          code: "missing_carrier_code",
          message: "Aucun transporteur valide n'a ete retourne par la verification fret Alibaba pour ce fournisseur.",
        },
      });
      supplierOrderStatus = "failed";
      continue;
    }

    const supplierPayload = {
      channel_refer_id: order.orderNumber,
      logistics_detail: {
        dispatch_location: group.dispatchLocation,
        carrier_code: group.carrierCode,
        shipment_address: buildAlibabaShipmentAddress(freightVerification.internalFulfillment.address),
      },
      product_list: group.entries.map((entry) => ({
        product_id: entry.mapping?.alibabaProductId,
        sku_id: entry.item.supplierSkuId ?? entry.mapping?.skuId ?? "",
        quantity: String(entry.item.quantity),
      })),
      properties: {
        platform: "CommerceHQ",
        orderId: order.orderNumber,
        assignedOperator: freightVerification.internalFulfillment.operatorName,
        shippingMark: freightVerification.internalFulfillment.shippingMark,
      },
      remark: `Internal order ${order.orderNumber} | Operator ${freightVerification.internalFulfillment.operatorName} | ${freightVerification.internalFulfillment.shippingMark}`,
    };

    const supplierResult = await createAlibabaBuyNowOrder(supplierPayload);
    const supplierResultOk = supplierResult.ok && isAlibabaOperationSuccessful(supplierResult.responseBody);
    supplierResponses.push({
      supplierCompanyId: group.supplierCompanyId,
      carrierCode: group.carrierCode,
      responseBody: supplierResult.responseBody,
      requestOk: supplierResultOk,
    });
    await createAlibabaIntegrationLog({
      orderId: order.id,
      action: "supplier-order-create",
      endpoint: supplierResult.endpoint,
      status: supplierResultOk ? "success" : "failed",
      requestBody: supplierPayload,
      responseBody: supplierResult.responseBody,
    });

    if (!supplierResultOk) {
      supplierOrderStatus = "failed";
      continue;
    }

    const tradeId = extractAlibabaTradeId(supplierResult.responseBody);
    if (tradeId) {
      tradeIds.push(String(tradeId));
      continue;
    }

    supplierOrderStatus = "failed";
    supplierResponses.push({
      supplierCompanyId: group.supplierCompanyId,
      carrierCode: group.carrierCode,
      requestOk: false,
      responseBody: {
        code: "missing_trade_id",
        message: "Alibaba n'a retourne aucun trade_id apres la creation de la commande fournisseur.",
      },
    });
  }

  if (tradeIds.length === 0) {
    supplierOrderStatus = "failed";
  }

  return {
    supplierOrderStatus,
    alibabaTradeIds: tradeIds,
    supplierOrderPayload: supplierResponses,
  };
}

export async function runAlibabaSupplierAutomation(order: SourcingOrder, mappings: AlibabaCatalogMapping[]) {
  const verification = await verifyAlibabaSupplierFreight(order, mappings);
  const supplierOrders = await createAlibabaSupplierOrders(order, mappings, verification);

  return {
    freightStatus: verification.freightStatus,
    supplierOrderStatus: supplierOrders.supplierOrderStatus,
    alibabaTradeIds: supplierOrders.alibabaTradeIds,
    freightPayload: verification.freightPayload,
    supplierOrderPayload: supplierOrders.supplierOrderPayload,
  };
}
