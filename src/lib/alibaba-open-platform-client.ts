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

type AlibabaSearchProduct = ProductCatalogItem & {
  sourceProductId: string;
  supplierCompanyId?: string;
  rawPayload: unknown;
};

type AlibabaCallResult = {
  ok: boolean;
  endpoint: string;
  requestBody: Record<string, unknown>;
  responseBody: unknown;
  status: number;
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
      const normalized = Number(candidate.replace(/[^0-9.\-]/g, ""));
      if (Number.isFinite(normalized) && normalized > 0) {
        return normalized;
      }
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

  const images = uniqueStrings([
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
  ]).filter((entry) => entry.startsWith("http") || entry.startsWith("/"));

  if (!sourceProductId || !title || images.length === 0) {
    return null;
  }

  const minUsd = getNumberValue(
    raw.min_price,
    raw.minPrice,
    raw.price,
    raw.sale_price,
    (raw.priceRange as { min?: unknown } | undefined)?.min,
    (raw.price_range as { min?: unknown } | undefined)?.min,
  ) ?? 1;
  const maxUsd = getNumberValue(
    raw.max_price,
    raw.maxPrice,
    (raw.priceRange as { max?: unknown } | undefined)?.max,
    (raw.price_range as { max?: unknown } | undefined)?.max,
  );
  const moq = Math.max(1, Math.round(getNumberValue(raw.moq, raw.min_order_quantity, raw.minOrderQuantity) ?? 1));
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
    itemWeightGrams: Math.round((getNumberValue(raw.weight, raw.weight_grams, raw.weightGrams) ?? 0) * (Number(raw.weight) && Number(raw.weight) < 10 ? 1000 : 1)),
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
    rawPayload: raw,
  };
}

async function callAlibabaEndpoint(pathOrUrl: string, payload: Record<string, unknown>, options?: {
  accessToken?: string;
  includeAccessToken?: boolean;
  credentials?: AlibabaCredentials | null;
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
  params.set("app_key", credentials.appKey);
  params.set("timestamp", String(Date.now()));
  params.set("sign_method", "sha256");
  params.set("simplify", "true");
  if (options?.includeAccessToken !== false && (options?.accessToken ?? credentials.accessToken)) {
    params.set("access_token", options?.accessToken ?? credentials.accessToken ?? "");
  }

  for (const [key, value] of Object.entries(payload)) {
    params.set(key, serializeValue(value));
  }

  params.set("sign", signAlibabaRequest(endpoint.apiPath, params, credentials.appSecret));

  const response = await fetch(endpoint.requestUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: params.toString(),
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
}) {
  const payload = {
    search_word: input.query,
    page_size: Math.min(Math.max(input.limit, 1), 100),
    page_no: 1,
    product_pool_id: resolveDropshippingPoolId(input.fulfillmentChannel),
  };

  const result = await callAlibabaEndpoint("/eco/buyer/product/search", payload, {
    credentials: await resolveAlibabaCredentialsForLiveCall(),
  });
  const response = result.responseBody as Record<string, unknown> | null;
  const candidates = collectCandidateRecords(response);
  const products = candidates
    .map((candidate) => mapAlibabaSearchResultToProduct(candidate, input.query))
    .filter((candidate): candidate is AlibabaSearchProduct => candidate !== null)
    .slice(0, Math.min(Math.max(input.limit, 1), 100));
  const responseMessage = getStringValue(response?.message)
    ?? getStringValue(response?.error_message)
    ?? getStringValue(response?.msg)
    ?? getStringValue(response?.sub_msg);
  const responseCode = getStringValue(response?.code)
    ?? getStringValue(response?.error_code)
    ?? getStringValue(response?.sub_code);

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

  if (products.length === 0) {
    console.error("[alibaba/search] no usable products", {
      query: input.query,
      fulfillmentChannel: input.fulfillmentChannel,
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
        : responseCode
          ? `Alibaba a repondu sans produit exploitable. Code: ${responseCode}.`
          : "Alibaba n'a renvoye aucun produit exploitable pour cette recherche.",
    };
  }

  return {
    ok: true,
    endpoint: "/eco/buyer/product/search",
    responseBody: result.responseBody,
    products,
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