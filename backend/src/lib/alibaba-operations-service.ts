import type { ProductCatalogItem } from "@/lib/products-data";
import { createAlibabaIntegrationLog, createSourcingIds, getAlibabaCatalogMappings } from "@/lib/sourcing-store";
import {
  deleteAlibabaImportedProduct,
  getAlibabaCountryProfiles,
  getAlibabaImportJobs,
  getAlibabaImportedProducts,
  getAlibabaPurchaseOrders,
  getAlibabaReceptionAddresses,
  getAlibabaReceptionRecords,
  getAlibabaSupplierAccounts,
  saveAlibabaCountryProfiles,
  saveAlibabaImportJob,
  saveAlibabaImportedProducts,
  saveAlibabaPurchaseOrder,
  saveAlibabaReceptionAddress,
  saveAlibabaReceptionRecord,
  saveAlibabaSupplierAccount,
} from "@/lib/alibaba-operations-store";
import {
  ALIBABA_DEFAULT_API_BASE_URL,
  ALIBABA_DEFAULT_AUTHORIZE_URL,
  ALIBABA_DEFAULT_REFRESH_URL,
  ALIBABA_DEFAULT_TOKEN_URL,
  extractAlibabaCategoryInfo,
  normalizePanelSlug,
  slugifyImportedTitle,
  type AlibabaCountryProfile,
  type AlibabaFulfillmentChannel,
  type AlibabaImportJob,
  type AlibabaImportedProduct,
  type AlibabaPurchaseOrder,
  type AlibabaReceptionAddress,
  type AlibabaSupplierAccount,
} from "@/lib/alibaba-operations";
import {
  calculateAlibabaBasicFreight,
  createAlibabaBuyNowOrder,
  createAlibabaDropshippingPayment,
  extractAlibabaOperationCode,
  extractAlibabaOperationMessage,
  extractAlibabaTradeId,
  fetchAlibabaProductSnapshot,
  normalizeAliExpressDsAddressOptions,
  normalizeAlibabaFreightOptions,
  queryAlibabaPaymentResult,
  queryAliExpressDsAddress,
  resolveAlibabaIcbuCategoryInfo,
  searchAlibabaProducts,
} from "@/lib/alibaba-open-platform-client";

function nowIso() {
  return new Date().toISOString();
}

function formatAliExpressDsOrderCreateFailure(errorCode?: string, errorMessage?: string) {
  const code = String(errorCode ?? "").trim();
  const message = String(errorMessage ?? "").trim();
  const normalizedMessage = message.toLowerCase();

  if (code === "ITEM_ID_NOT_FOUND") {
    return "L'article AliExpress n'existe plus ou l'identifiant produit est invalide.";
  }

  if (code === "Item is not allowed to this country") {
    return "Ce produit AliExpress n'est pas autorise a la vente pour le pays de destination choisi.";
  }

  if (code === "SKU_NOT_EXIST") {
    return "Le SKU AliExpress de ce produit n'existe plus ou n'a pas ete transmis. Reimporte l'article pour resynchroniser ses variantes avant de relancer le lot DS.";
  }

  if (code === "B_DROPSHIPPER_DELIVERY_ADDRESS_VALIDATE_FAIL") {
    if (normalizedMessage.includes("city")) {
      return "Adresse AliExpress invalide: la ville est obligatoire ou non reconnue.";
    }

    if (normalizedMessage.includes("state") || normalizedMessage.includes("province") || normalizedMessage.includes("county")) {
      return "Adresse AliExpress invalide: l'etat ou la province est obligatoire.";
    }

    if (normalizedMessage.includes("phone") || normalizedMessage.includes("country code")) {
      return "Adresse AliExpress invalide: verifie le numero de telephone et l'indicatif pays.";
    }

    if (normalizedMessage.includes("2 and 32") || normalizedMessage.includes("2 to 32") || normalizedMessage.includes("2-32")) {
      return "Adresse AliExpress invalide: le nom du contact doit contenir entre 2 et 32 caracteres.";
    }

    return message ? `Adresse AliExpress invalide: ${message}` : "Adresse AliExpress invalide. Verifie les champs ville, province, telephone et contact.";
  }

  if (code === "DELIVERY_METHOD_NOT_EXIST") {
    return "Aucune methode de livraison AliExpress valide n'est disponible pour cette adresse.";
  }

  if (code === "PRICE_PAY_CURRENCY_ERROR") {
    return "La devise de paiement AliExpress ne correspond pas a la devise du produit.";
  }

  if (code === "INVENTORY_HOLD_ERROR") {
    return "AliExpress a refuse la commande: stock insuffisant ou erreur de reservation d'inventaire.";
  }

  if (code === "REPEATED_ORDER_ERROR") {
    return "AliExpress signale une commande dupliquee pour ce lot.";
  }

  if (code === "USER_ACCOUNT_DISABLED") {
    return "Le compte AliExpress utilise pour le dropshipping est desactive.";
  }

  if (code === "BLACKLIST_BUYER_IN_LIST") {
    return "Le compte acheteur AliExpress est temporairement bloque pour cette commande.";
  }

  return [code, message].filter(Boolean).join(" - ") || "Lancement DS impossible";
}

function isAliExpressDsAutoPayFailure(errorMessage?: string) {
  const normalized = String(errorMessage ?? "").trim().toLowerCase();
  return normalized.includes("autopay fail")
    || normalized.includes("api pay fail")
    || normalized.includes("apipayfail")
    || normalized.includes("ordercreated, autopay fail");
}

function formatAliExpressDsAutoPayFailure(errorMessage?: string) {
  const details = String(errorMessage ?? "").trim();
  const guidance = "Commande DS creee, mais l'auto-paiement a echoue. Verifie la whitelist auto-pay (appKey), le compte acheteur AliExpress, le compte PayPal lie au buyer account, puis active Auto Pay dans AliExpress DS.";
  return details ? `${guidance} Detail: ${details}` : guidance;
}

function getStringRecordValue(value: unknown, ...keys: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }

    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return String(candidate);
    }
  }

  return undefined;
}

function getBooleanRecordValue(value: unknown, ...keys: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "boolean") {
      return candidate;
    }
  }

  return undefined;
}

function getRecordValue(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return (value as Record<string, unknown>)[key];
}

function extractSkuIdFromAlibabaRawPayload(rawPayload: unknown) {
  const queue: unknown[] = [rawPayload];
  const visited = new Set<object>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") {
      continue;
    }

    if (visited.has(current as object)) {
      continue;
    }

    visited.add(current as object);

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    const directSkuId = getStringRecordValue(current, "sku_id", "skuId");
    if (directSkuId) {
      return directSkuId;
    }

    const record = current as Record<string, unknown>;
    const skuCollections = [record.sku_info, record.skus, record.skuInfo, record.trade_info];
    queue.push(...skuCollections.filter((entry) => typeof entry !== "undefined"));
    queue.push(...Object.values(record));
  }

  return undefined;
}

function resolveAlibabaImportedProductSkuId(product: AlibabaImportedProduct) {
  const preferredVariantSku = product.variantSkus?.find((entry) => typeof entry.skuId === "string" && entry.skuId.trim() && (typeof entry.inventory !== "number" || entry.inventory > 0));
  if (preferredVariantSku?.skuId) {
    return preferredVariantSku.skuId;
  }

  const fallbackVariantSku = product.variantSkus?.find((entry) => typeof entry.skuId === "string" && entry.skuId.trim());
  if (fallbackVariantSku?.skuId) {
    return fallbackVariantSku.skuId;
  }

  return extractSkuIdFromAlibabaRawPayload(product.rawPayload);
}

function extractSkuAttrFromAlibabaRawPayload(rawPayload: unknown, skuId: string) {
  const queue: unknown[] = [rawPayload];
  const visited = new Set<object>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") {
      continue;
    }

    if (visited.has(current as object)) {
      continue;
    }

    visited.add(current as object);

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    const record = current as Record<string, unknown>;
    const skuGroups = [record.ae_item_sku_info_dtos, record.sku_info, record.skus, record.items];

    for (const skuGroup of skuGroups) {
      if (!Array.isArray(skuGroup)) {
        continue;
      }

      for (const skuEntry of skuGroup) {
        const candidateSkuId = getStringRecordValue(skuEntry, "sku_id", "skuId", "id");
        if (candidateSkuId !== skuId) {
          continue;
        }

        return getStringRecordValue(skuEntry, "sku_attr", "id") ?? "";
      }
    }

    queue.push(...Object.values(record));
  }

  return undefined;
}

function resolveAlibabaImportedProductSkuAttr(product: AlibabaImportedProduct, skuId: string) {
  const skuAttr = extractSkuAttrFromAlibabaRawPayload(product.rawPayload, skuId);
  if (typeof skuAttr === "string") {
    return skuAttr;
  }

  const variantSkuCount = Array.isArray(product.variantSkus) ? product.variantSkus.length : 0;
  return variantSkuCount <= 1 ? "" : undefined;
}

function resolveAlibabaOrderCarrierCode(freightResponseBody: unknown) {
  const options = normalizeAlibabaFreightOptions(freightResponseBody);
  return options.find((entry) => typeof entry.vendorCode === "string" && entry.vendorCode.trim())?.vendorCode;
}

type AliExpressDsAddressNode = {
  name: string;
  code?: string;
  id?: string;
  children: AliExpressDsAddressNode[];
};

function normalizeComparableText(value: string | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function parseAliExpressDsAddressNodes(value: unknown): AliExpressDsAddressNode[] {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      return parseAliExpressDsAddressNodes(JSON.parse(trimmed));
    } catch {
      return [];
    }
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => parseAliExpressDsAddressNodes(entry));
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  const name = getStringRecordValue(record, "name", "label", "areaName", "provinceName", "cityName", "displayName");
  const code = getStringRecordValue(record, "code", "areaCode", "provinceCode", "cityCode", "countryCode");
  const id = getStringRecordValue(record, "id", "areaId", "provinceId", "cityId");
  const children = parseAliExpressDsAddressNodes(
    record.children
      ?? record.childList
      ?? record.childs
      ?? record.cityList
      ?? record.provinceList
      ?? record.areas,
  );

  if (!name && !code && !id) {
    return [];
  }

  return [{
    name: name ?? code ?? id ?? "",
    code: code ?? undefined,
    id: id ?? undefined,
    children,
  } satisfies AliExpressDsAddressNode];
}

function findAliExpressDsAddressNode(nodes: AliExpressDsAddressNode[], value: string | undefined): AliExpressDsAddressNode | undefined {
  const normalizedTarget = normalizeComparableText(value);
  if (!normalizedTarget) {
    return undefined;
  }

  const queue = [...nodes];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const matches = [current.name, current.code, current.id].some((entry) => normalizeComparableText(entry) === normalizedTarget);
    if (matches) {
      return current;
    }

    queue.push(...current.children);
  }

  return undefined;
}

async function resolveValidatedAliExpressAddress(address: AlibabaReceptionAddress) {
  const addressQuery = await queryAliExpressDsAddress({
    countryCode: address.countryCode,
    language: process.env.ALIEXPRESS_DEFAULT_LANGUAGE ?? "en_US",
    isMultiLanguage: true,
  }).catch(() => null);

  const options = addressQuery ? normalizeAliExpressDsAddressOptions(addressQuery.responseBody) : [];
  const typedNodes = options.map((entry) => ({
    type: normalizeComparableText(entry.type),
    nodes: parseAliExpressDsAddressNodes(entry.childrenJson),
  }));
  const allRoots = typedNodes.flatMap((entry) => entry.nodes);

  if (allRoots.length === 0) {
    return {
      state: address.state,
      stateCode: address.state,
      city: address.city,
      cityCode: address.city,
    };
  }

  const provinceRoots = typedNodes
    .filter((entry) => /(state|province|county|region)/.test(entry.type))
    .flatMap((entry) => entry.nodes);
  const provinceSearchRoots = provinceRoots.length > 0 ? provinceRoots : allRoots;
  const provinceMatch = findAliExpressDsAddressNode(provinceSearchRoots, address.state);

  if (address.state.trim() && provinceSearchRoots.length > 0 && !provinceMatch) {
    throw new Error(`Adresse AliExpress invalide: la province ou l'etat "${address.state}" n'est pas reconnu pour ${address.countryCode}.`);
  }

  const explicitCityRoots = typedNodes
    .filter((entry) => /(city|town)/.test(entry.type))
    .flatMap((entry) => entry.nodes);
  const citySearchRoots = provinceMatch?.children?.length
    ? provinceMatch.children
    : explicitCityRoots.length > 0
      ? explicitCityRoots
      : allRoots;
  const cityMatch = findAliExpressDsAddressNode(citySearchRoots, address.city);

  if (address.city.trim() && citySearchRoots.length > 0 && !cityMatch) {
    throw new Error(`Adresse AliExpress invalide: la ville "${address.city}" n'est pas reconnue pour ${address.countryCode}.`);
  }

  return {
    state: provinceMatch?.name ?? address.state,
    stateCode: provinceMatch?.code ?? provinceMatch?.id ?? provinceMatch?.name ?? address.state,
    city: cityMatch?.name ?? address.city,
    cityCode: cityMatch?.code ?? cityMatch?.id ?? cityMatch?.name ?? address.city,
  };
}

function extractAliExpressTradeOrderStatus(responseBody: unknown) {
  if (!responseBody || typeof responseBody !== "object" || Array.isArray(responseBody)) {
    return undefined;
  }

  const body = responseBody as Record<string, unknown>;
  const wrapped = body.aliexpress_trade_ds_order_get_response;
  const wrappedResult = wrapped && typeof wrapped === "object" && !Array.isArray(wrapped)
    ? (wrapped as Record<string, unknown>).result
    : undefined;
  const result = body.result;
  const value = body.value;

  return getStringRecordValue(wrappedResult, "order_status", "status")
    ?? getStringRecordValue(result, "order_status", "status")
    ?? getStringRecordValue(value, "order_status", "status")
    ?? getStringRecordValue(body, "order_status", "status");
}

function extractAliExpressTradePayUrl(responseBody: unknown) {
  if (!responseBody || typeof responseBody !== "object" || Array.isArray(responseBody)) {
    return undefined;
  }

  const body = responseBody as Record<string, unknown>;
  const wrapped = body.aliexpress_trade_ds_order_get_response;
  const wrappedResult = wrapped && typeof wrapped === "object" && !Array.isArray(wrapped)
    ? (wrapped as Record<string, unknown>).result
    : undefined;
  const result = body.result;
  const value = body.value;

  return getStringRecordValue(wrappedResult, "pay_url", "payUrl", "cashier_url", "cashierUrl")
    ?? getStringRecordValue(result, "pay_url", "payUrl", "cashier_url", "cashierUrl")
    ?? getStringRecordValue(value, "pay_url", "payUrl", "cashier_url", "cashierUrl")
    ?? getStringRecordValue(wrappedResult, "payment_url", "paymentUrl", "pay_url_https", "pay_url_http")
    ?? getStringRecordValue(result, "payment_url", "paymentUrl", "pay_url_https", "pay_url_http")
    ?? getStringRecordValue(value, "payment_url", "paymentUrl", "pay_url_https", "pay_url_http")
    ?? getStringRecordValue(body, "pay_url", "payUrl", "cashier_url", "cashierUrl");
}

function extractAliExpressTradeError(responseBody: unknown) {
  if (!responseBody || typeof responseBody !== "object" || Array.isArray(responseBody)) {
    return null;
  }

  const body = responseBody as Record<string, unknown>;
  const errorResponse = getRecordValue(body, "error_response");

  if (!errorResponse || typeof errorResponse !== "object" || Array.isArray(errorResponse)) {
    return null;
  }

  return {
    code: getStringRecordValue(errorResponse, "code"),
    subCode: getStringRecordValue(errorResponse, "sub_code"),
    message: getStringRecordValue(errorResponse, "msg", "message"),
    subMessage: getStringRecordValue(errorResponse, "sub_msg"),
  };
}

function isAliExpressPermissionError(code?: string, subCode?: string, message?: string) {
  const haystack = [code, subCode, message]
    .map((entry) => String(entry ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join("|");

  return haystack.includes("isv.insuffisance-permission")
    || haystack.includes("isv.insufficient-permission")
    || haystack.includes("permission insuffisante")
    || haystack.includes("insufficient permission");
}

async function waitMilliseconds(durationMs: number) {
  await new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

async function syncAlibabaPurchaseOrderStateWithRetry(order: AlibabaPurchaseOrder, attempts = 3, waitMs = 2000) {
  let latest = order;

  for (let attempt = 0; attempt < Math.max(1, attempts); attempt += 1) {
    latest = await syncAlibabaPurchaseOrderState(latest);
    if (latest.paymentStatus === "paid" || latest.paymentStatus === "failed" || latest.payUrl) {
      return latest;
    }

    if (attempt < attempts - 1) {
      await waitMilliseconds(waitMs);
    }
  }

  return latest;
}

async function syncAlibabaPurchaseOrderState(order: AlibabaPurchaseOrder) {
  if (!order.tradeId) {
    return order;
  }

  const paymentResult = await queryAlibabaPaymentResult({ tradeId: order.tradeId });
  const remoteError = extractAliExpressTradeError(paymentResult.responseBody);
  const remoteStatus = String(extractAliExpressTradeOrderStatus(paymentResult.responseBody) ?? "").trim().toUpperCase();
  const payUrl = extractAliExpressTradePayUrl(paymentResult.responseBody)
    ?? order.payUrl;
  const payFailureReason = remoteError?.subMessage
    ?? remoteError?.message
    ?? extractAlibabaOperationMessage(paymentResult.responseBody);
  const permissionDenied = isAliExpressPermissionError(remoteError?.code, remoteError?.subCode, payFailureReason);
  const isPaid = remoteStatus === "FINISH" || remoteStatus === "PAID";
  const isFailed = remoteStatus.includes("CANCEL") || remoteStatus.includes("CLOSE") || remoteStatus.includes("FAIL");

  const nextOrder: AlibabaPurchaseOrder = {
    ...order,
    payUrl,
    paymentStatus: isPaid ? "paid" : isFailed ? "failed" : payUrl ? "pay_url_generated" : "pending",
    payFailureReason: isFailed
      ? payFailureReason ?? "Paiement non complete"
      : permissionDenied
        ? payFailureReason ?? "Permission API insuffisante pour lire le statut detaille du paiement DS."
        : undefined,
    rawPaymentResponse: paymentResult.responseBody,
    updatedAt: nowIso(),
    orderStatus: isPaid ? "paid" : isFailed ? "failed" : "payment_pending",
  };
  await saveAlibabaPurchaseOrder(nextOrder);
  return nextOrder;
}

function getAliExpressMarginRate() {
  const configuredMargin = Number(process.env.ALIEXPRESS_MARGIN_RATE ?? "0.1");
  if (!Number.isFinite(configuredMargin) || configuredMargin < 0) {
    return 0.1;
  }

  return configuredMargin;
}

function getExpiryDate(secondsLike: unknown) {
  const seconds = Number(secondsLike ?? 0);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return undefined;
  }

  return new Date(Date.now() + seconds * 1000).toISOString();
}

function normalizeAliExpressOAuthUrl(value: string | undefined, type: "authorize" | "token" | "refresh") {
  const fallback = type === "authorize"
    ? ALIBABA_DEFAULT_AUTHORIZE_URL
    : type === "token"
      ? ALIBABA_DEFAULT_TOKEN_URL
      : ALIBABA_DEFAULT_REFRESH_URL;
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }

  try {
    const url = new URL(trimmed);
    if (!url.hostname.includes("aliexpress.com")) {
      return trimmed;
    }

    if (type === "authorize") {
      url.pathname = "/oauth/authorize";
      return url.toString();
    }

    if (type === "token") {
      if (url.pathname === "/auth/token/security/create" || url.pathname === "/rest/auth/token/security/create") {
        url.pathname = "/rest/auth/token/security/create";
      } else if (url.pathname === "/auth/token/create" || url.pathname === "/rest/auth/token/create") {
        url.pathname = "/rest/auth/token/create";
      }
    }

    if (type === "refresh") {
      if (url.pathname === "/auth/token/security/refresh" || url.pathname === "/rest/auth/token/security/refresh") {
        url.pathname = "/rest/auth/token/security/refresh";
      } else if (url.pathname === "/auth/token/refresh" || url.pathname === "/rest/auth/token/refresh") {
        url.pathname = "/rest/auth/token/refresh";
      }
    }

    return url.toString();
  } catch {
    return trimmed;
  }
}

export async function getPreferredAlibabaSupplierAccount() {
  const accounts = await getAlibabaSupplierAccounts();
  const eligible = accounts.filter((account) => account.status !== "disabled" && account.appKey && account.appSecret);

  return eligible.find((account) => account.isActive && account.status === "connected")
    ?? eligible.find((account) => account.status === "connected")
    ?? eligible.find((account) => account.isActive)
    ?? eligible[0]
    ?? null;
}

export function getAlibabaAccountApiBaseUrl(account?: AlibabaSupplierAccount | null) {
  return account?.apiBaseUrl?.trim()
    || process.env.ALIEXPRESS_OPEN_PLATFORM_API_BASE_URL
    || process.env.ALIBABA_OPEN_PLATFORM_API_BASE_URL
    || ALIBABA_DEFAULT_API_BASE_URL;
}

export async function upsertAlibabaSupplierAccountTokens(input: {
  accountId: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: unknown;
  refreshExpiresIn?: unknown;
  oauthCountry?: string;
  accountIdFromProvider?: string;
  accountLogin?: string;
  accountName?: string;
  accessTokenHint?: string;
  status?: AlibabaSupplierAccount["status"];
  lastError?: string;
}) {
  const accounts = await getAlibabaSupplierAccounts();
  const existing = accounts.find((account) => account.id === input.accountId);
  if (!existing) {
    throw new Error("Compte fournisseur AliExpress introuvable. En production, configure une persistance (DATABASE_URL ou BLOB_READ_WRITE_TOKEN) puis relance OAuth.");
  }

  const nextAccount: AlibabaSupplierAccount = {
    ...existing,
    accessToken: input.accessToken ?? existing.accessToken,
    refreshToken: input.refreshToken ?? existing.refreshToken,
    accessTokenExpiresAt: input.accessToken ? getExpiryDate(input.expiresIn) : existing.accessTokenExpiresAt,
    refreshTokenExpiresAt: input.refreshToken ? getExpiryDate(input.refreshExpiresIn) : existing.refreshTokenExpiresAt,
    oauthCountry: input.oauthCountry ?? existing.oauthCountry,
    accountId: input.accountIdFromProvider ?? existing.accountId,
    accountLogin: input.accountLogin ?? existing.accountLogin,
    accountName: input.accountName ?? existing.accountName,
    accessTokenHint: input.accessTokenHint ?? existing.accessTokenHint,
    status: input.status ?? existing.status,
    lastAuthorizedAt: input.accessToken ? nowIso() : existing.lastAuthorizedAt,
    lastError: input.lastError,
    updatedAt: nowIso(),
  };

  return saveAlibabaSupplierAccount(nextAccount);
}

function buildOverview(product: ProductCatalogItem) {
  return product.overview.length > 0 ? product.overview : [
    `Import AliExpress pour ${product.shortTitle}.`,
    "Médias, variations et détails logistiques synchronisés.",
    "Prêt à être publié dans le catalogue AfriPay.",
  ];
}

function toImportedProduct(product: ProductCatalogItem, query: string, publishedToSite: boolean): AlibabaImportedProduct {
  const timestamp = nowIso();
  const categoryInfo = extractAlibabaCategoryInfo({
    query,
    title: product.title,
    keywords: product.keywords,
  });

  return {
    id: createSourcingIds(),
    sourceProductId: product.slug,
    categorySlug: categoryInfo.slug,
    categoryTitle: categoryInfo.title,
    categoryPath: categoryInfo.path,
    slug: `${slugifyImportedTitle(product.shortTitle)}-${createSourcingIds().slice(0, 6)}`,
    title: product.title,
    shortTitle: product.shortTitle,
    description: product.overview.join(" "),
    query,
    keywords: product.keywords ?? [],
    image: product.image,
    gallery: product.gallery,
    videoUrl: product.videoUrl,
    videoPoster: product.videoPoster,
    packaging: product.packaging,
    itemWeightGrams: product.itemWeightGrams,
    lotCbm: product.lotCbm,
    minUsd: product.minUsd,
    maxUsd: product.maxUsd,
    moq: product.moq,
    unit: product.unit,
    badge: product.badge,
    supplierName: product.supplierName,
    supplierLocation: product.supplierLocation,
    responseTime: product.responseTime,
    yearsInBusiness: product.yearsInBusiness,
    transactionsLabel: product.transactionsLabel,
    soldLabel: product.soldLabel,
    customizationLabel: product.customizationLabel,
    shippingLabel: product.shippingLabel,
    chinaLocalFreightFcfa: product.chinaLocalFreightFcfa,
    chinaLocalFreightLabel: product.chinaLocalFreightLabel,
    overview: buildOverview(product),
    variantGroups: product.variantGroups,
    variantPricing: product.variantPricing,
    variantSkus: product.variantSkus,
    tiers: product.tiers,
    specs: product.specs,
    moqVerified: product.moqVerified,
    supplierCompanyId: getStringRecordValue(product, "supplierCompanyId"),
    weightVerified: getBooleanRecordValue(product, "weightVerified"),
    priceVerified: getBooleanRecordValue(product, "priceVerified"),
    inventory: Math.max(product.moq * 5, 50),
    status: publishedToSite ? "published" : "imported",
    publishedToSite,
    createdAt: timestamp,
    updatedAt: timestamp,
    publishedAt: publishedToSite ? timestamp : undefined,
    rawPayload: getRecordValue(product, "rawPayload") ?? { source: "fallback-catalog" },
  };
}

export async function getAlibabaOperationsDashboardData(panel?: string) {
  const [
    settingsMappings,
    importJobs,
    importedProducts,
    purchaseOrders,
    supplierAccounts,
    countries,
    addresses,
    receptions,
  ] = await Promise.all([
    getAlibabaCatalogMappings(),
    getAlibabaImportJobs(),
    getAlibabaImportedProducts({ fresh: true }),
    getAlibabaPurchaseOrders(),
    getAlibabaSupplierAccounts(),
    getAlibabaCountryProfiles(),
    getAlibabaReceptionAddresses(),
    getAlibabaReceptionRecords(),
  ]);

  return {
    panel: normalizePanelSlug(panel),
    mappings: settingsMappings,
    importJobs,
    importedProducts,
    purchaseOrders,
    supplierAccounts: supplierAccounts.map((account) => ({
      ...account,
      hasAppSecret: Boolean(account.appSecret),
      hasAccessToken: Boolean(account.accessToken),
      hasRefreshToken: Boolean(account.refreshToken),
      appSecret: undefined,
      accessToken: undefined,
      refreshToken: undefined,
    })),
    countries,
    addresses,
    receptions,
    stats: {
      importedCount: importedProducts.length,
      publishedCount: importedProducts.filter((item) => item.publishedToSite).length,
      pendingPayments: purchaseOrders.filter((order) => order.paymentStatus === "pending" || order.paymentStatus === "pay_url_generated").length,
      paidOrders: purchaseOrders.filter((order) => order.paymentStatus === "paid").length,
    },
  };
}

export async function runAlibabaCatalogImport(input: {
  query: string;
  limit: number;
  fulfillmentChannel: AlibabaFulfillmentChannel;
  autoPublish: boolean;
  resetImportedProducts?: boolean;
}) {
  const timestamp = nowIso();
  const job: AlibabaImportJob = {
    id: createSourcingIds(),
    query: input.query.trim(),
    limit: Math.min(Math.max(input.limit, 1), 100),
    fulfillmentChannel: input.fulfillmentChannel,
    autoPublish: input.autoPublish,
    status: "running",
    importedCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    productIds: [],
  };
  await saveAlibabaImportJob(job);

  try {
    let purgedCount = 0;
    if (input.resetImportedProducts) {
      const purgeResult = await deleteAllImportedProducts();
      purgedCount = purgeResult.deletedCount;
    }

    const existingImportedProducts = await getAlibabaImportedProducts();
    const existingSourceProductIds = new Set(existingImportedProducts.map((product) => product.sourceProductId));
    const explorationLimit = Math.min(Math.max(job.limit * 4, 40), 100);
    const searchResult = await searchAlibabaProducts({
      query: job.query,
      limit: explorationLimit,
      fulfillmentChannel: job.fulfillmentChannel,
    });

    if (!searchResult.ok) {
      throw new Error(searchResult.errorMessage ?? "Recherche AliExpress impossible.");
    }

    if (searchResult.products.length === 0) {
      throw new Error("Aucun produit live AliExpress n'a ete renvoye pour cette recherche.");
    }

    const uniqueSearchProducts = searchResult.products.filter((product, index, products) => products.findIndex((entry) => entry.sourceProductId === product.sourceProductId) === index);
    const productsWithRequiredData = uniqueSearchProducts.filter((product) => product.priceVerified && product.moqVerified && product.weightVerified && product.itemWeightGrams > 0);
    const fallbackEligibleProducts = uniqueSearchProducts.filter((product) => {
      if (productsWithRequiredData.some((entry) => entry.sourceProductId === product.sourceProductId)) {
        return false;
      }

      return product.priceVerified && product.minUsd > 0 && typeof product.image === "string" && product.image.length > 0;
    });
    const importCandidates = productsWithRequiredData.length > 0 ? productsWithRequiredData : fallbackEligibleProducts;
    const freshProducts = importCandidates.filter((product) => !existingSourceProductIds.has(product.sourceProductId)).slice(0, job.limit);
    const rejectedReasonCounts = uniqueSearchProducts.reduce((counts, product) => {
      if (!product.priceVerified) {
        counts.price += 1;
      }

      if (!product.moqVerified) {
        counts.moq += 1;
      }

      if (!product.weightVerified || product.itemWeightGrams <= 0) {
        counts.weight += 1;
      }

      return counts;
    }, { price: 0, moq: 0, weight: 0, fallback: 0 });

    fallbackEligibleProducts.forEach(() => {
      rejectedReasonCounts.fallback += 1;
    });

    const importedProducts = await Promise.all(freshProducts.map(async (product) => {
      const liveCategoryInfo = await resolveAlibabaIcbuCategoryInfo({
        rawPayload: product.rawPayload,
      });
      const enrichedRawPayload = product.rawPayload && typeof product.rawPayload === "object" && !Array.isArray(product.rawPayload)
        ? {
            ...(product.rawPayload as Record<string, unknown>),
            ...(liveCategoryInfo ? { alibaba_category_tree: liveCategoryInfo } : {}),
          }
        : product.rawPayload;
      const categoryInfo = extractAlibabaCategoryInfo({
        rawPayload: enrichedRawPayload,
        query: job.query,
        title: product.title,
        keywords: product.keywords,
        categoryTitle: liveCategoryInfo?.title,
        categoryPath: liveCategoryInfo?.path,
      });

      return {
        ...toImportedProduct(product, job.query, input.autoPublish),
        categorySlug: categoryInfo.slug,
        categoryTitle: categoryInfo.title,
        categoryPath: categoryInfo.path,
        sourceProductId: product.sourceProductId,
        supplierCompanyId: product.supplierCompanyId,
        rawPayload: enrichedRawPayload,
      };
    }));

    const skippedMissingRequiredDataCount = Math.max(0, uniqueSearchProducts.length - importCandidates.length);
    const skippedExistingCount = Math.max(0, importCandidates.length - freshProducts.length);

    if (importedProducts.length > 0) {
      await saveAlibabaImportedProducts(importedProducts);
    }

    const warningMessage = importedProducts.length < job.limit
      ? `Import partiel: ${importedProducts.length}/${job.limit} importes.${productsWithRequiredData.length === 0 && fallbackEligibleProducts.length > 0 ? ` Mode secours AliExpress utilise: ${Math.min(fallbackEligibleProducts.length, job.limit)} fiche(s).` : ""}${skippedMissingRequiredDataCount > 0 ? ` Rejets donnees fournisseur: ${skippedMissingRequiredDataCount}.` : ""}${rejectedReasonCounts.price > 0 ? ` Prix incoherent: ${rejectedReasonCounts.price}.` : ""}${rejectedReasonCounts.moq > 0 ? ` MOQ non verifie: ${rejectedReasonCounts.moq}.` : ""}${rejectedReasonCounts.weight > 0 ? ` Poids non exploitable: ${rejectedReasonCounts.weight}.` : ""}${skippedExistingCount > 0 ? ` Deja importes ignores: ${skippedExistingCount}.` : ""}`
      : undefined;

    const completedJob: AlibabaImportJob = {
      ...job,
      status: "completed",
      importedCount: importedProducts.length,
      updatedAt: nowIso(),
      productIds: importedProducts.map((product) => product.id),
    };
    await saveAlibabaImportJob(completedJob);
    await createAlibabaIntegrationLog({
      action: "catalog-import",
      endpoint: searchResult.endpoint,
      status: "success",
      requestBody: input,
      responseBody: {
        importedCount: importedProducts.length,
        targetImportCount: job.limit,
        exploredCount: uniqueSearchProducts.length,
        purgedCount,
        skippedExistingCount,
        skippedMissingRequiredDataCount,
        rejectedReasonCounts,
        fallback: productsWithRequiredData.length === 0 && fallbackEligibleProducts.length > 0,
        warningMessage,
      },
    });

    return {
      job: completedJob,
      products: importedProducts,
      usedFallback: productsWithRequiredData.length === 0 && fallbackEligibleProducts.length > 0,
      targetImportCount: job.limit,
      exploredCount: uniqueSearchProducts.length,
      purgedCount,
      skippedExistingCount,
      skippedMissingRequiredDataCount,
      rejectedReasonCounts,
      warningMessage,
    };
  } catch (error) {
    const failedJob: AlibabaImportJob = {
      ...job,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Import AliExpress impossible.",
      updatedAt: nowIso(),
    };
    await saveAlibabaImportJob(failedJob);
    await createAlibabaIntegrationLog({
      action: "catalog-import",
      endpoint: "aliexpress.ds.text.search",
      status: "failed",
      requestBody: input,
      responseBody: {
        errorMessage: error instanceof Error ? error.message : "Import AliExpress impossible.",
        jobId: failedJob.id,
        query: failedJob.query,
        fulfillmentChannel: failedJob.fulfillmentChannel,
      },
    });
    throw error;
  }
}

export async function publishImportedProducts(productIds: string[]) {
  const products = await getAlibabaImportedProducts({ fresh: true });
  const timestamp = nowIso();
  const next = products.map((product) => productIds.includes(product.id)
    ? { ...product, publishedToSite: true, status: "published" as const, publishedAt: timestamp, updatedAt: timestamp }
    : product);
  await saveAlibabaImportedProducts(next);
  return next.filter((product) => productIds.includes(product.id));
}

function resolveImportedProduct(products: AlibabaImportedProduct[], ...identifiers: Array<string | undefined>) {
  for (const identifier of identifiers) {
    const normalizedIdentifier = identifier?.trim();
    if (!normalizedIdentifier) {
      continue;
    }

    const product = products.find((entry) => entry.id === normalizedIdentifier)
      ?? products.find((entry) => entry.sourceProductId === normalizedIdentifier)
      ?? products.find((entry) => entry.slug === normalizedIdentifier);

    if (product) {
      return product;
    }
  }

  return undefined;
}

export async function deleteImportedProduct(importedProductId: string, sourceProductId?: string) {
  const products = await getAlibabaImportedProducts({ fresh: true });
  const product = resolveImportedProduct(products, importedProductId, sourceProductId);

  if (!product) {
    throw new Error("Produit importe introuvable.");
  }

  await deleteAlibabaImportedProduct(product.id);
  await createAlibabaIntegrationLog({
    action: "catalog-import-delete",
    endpoint: "internal/imported-products/delete",
    status: "success",
    requestBody: { importedProductId, resolvedImportedProductId: product.id },
    responseBody: {
      importedProductId: product.id,
      sourceProductId: product.sourceProductId,
      title: product.title,
    },
  });

  return { deletedId: product.id, sourceProductId: product.sourceProductId };
}

export async function deleteAllImportedProducts() {
  const products = await getAlibabaImportedProducts({ fresh: true });

  for (const product of products) {
    await deleteAlibabaImportedProduct(product.id);
  }

  await createAlibabaIntegrationLog({
    action: "catalog-import-delete-all",
    endpoint: "internal/imported-products/delete-all",
    status: "success",
    requestBody: {
      importedProductCount: products.length,
    },
    responseBody: {
      deletedCount: products.length,
      sourceProductIds: products.slice(0, 100).map((product) => product.sourceProductId),
    },
  });

  return { deletedCount: products.length };
}

export async function reenrichImportedProduct(importedProductId: string) {
  const products = await getAlibabaImportedProducts({ fresh: true });
  const product = resolveImportedProduct(products, importedProductId);

  if (!product) {
    throw new Error("Produit importe introuvable.");
  }

  const snapshot = await fetchAlibabaProductSnapshot({
    sourceProductId: product.sourceProductId,
    query: product.query,
  });
  const effectiveSnapshot = snapshot ?? {
    ...product,
    sourceProductId: product.sourceProductId,
    supplierCompanyId: product.supplierCompanyId,
    rawPayload: product.rawPayload,
  };

  const liveCategoryInfo = await resolveAlibabaIcbuCategoryInfo({
    rawPayload: effectiveSnapshot.rawPayload,
  });
  const enrichedRawPayload = effectiveSnapshot.rawPayload && typeof effectiveSnapshot.rawPayload === "object" && !Array.isArray(effectiveSnapshot.rawPayload)
    ? {
        ...(effectiveSnapshot.rawPayload as Record<string, unknown>),
        ...(liveCategoryInfo ? { alibaba_category_tree: liveCategoryInfo } : {}),
      }
    : effectiveSnapshot.rawPayload;

  const categoryInfo = extractAlibabaCategoryInfo({
    rawPayload: enrichedRawPayload,
    query: product.query,
    title: effectiveSnapshot.title,
    keywords: effectiveSnapshot.keywords,
    categoryTitle: liveCategoryInfo?.title,
    categoryPath: liveCategoryInfo?.path,
  });
  const timestamp = nowIso();
  const nextGallery = effectiveSnapshot.gallery.length > 0
    ? effectiveSnapshot.gallery
    : product.gallery;
  const nextImage = effectiveSnapshot.image || nextGallery[0] || product.image;
  const nextVideoUrl = effectiveSnapshot.videoUrl ?? product.videoUrl;
  const nextVideoPoster = effectiveSnapshot.videoPoster ?? nextImage ?? product.videoPoster;
  const nextOverview = effectiveSnapshot.overview.length > 0 ? effectiveSnapshot.overview : product.overview;
  const nextVariantGroups = effectiveSnapshot.variantGroups.length > 0 ? effectiveSnapshot.variantGroups : product.variantGroups;
  const nextSpecs = effectiveSnapshot.specs.length > 0 ? effectiveSnapshot.specs : product.specs;
  const nextTiers = effectiveSnapshot.tiers.length > 0
    ? effectiveSnapshot.tiers
    : product.tiers.length > 0
      ? product.tiers
      : [{
          quantityLabel: `${effectiveSnapshot.moq}+`,
          priceUsd: effectiveSnapshot.minUsd,
          note: typeof effectiveSnapshot.maxUsd === "number" ? `Jusqu'à ${effectiveSnapshot.maxUsd.toFixed(2)} USD` : undefined,
        }];
  const nextProduct: AlibabaImportedProduct = {
    ...product,
    categorySlug: categoryInfo.slug,
    categoryTitle: categoryInfo.title,
    categoryPath: categoryInfo.path,
    title: effectiveSnapshot.title,
    shortTitle: effectiveSnapshot.shortTitle,
    description: nextOverview.join(" "),
    keywords: effectiveSnapshot.keywords ?? product.keywords,
    image: nextImage,
    gallery: nextGallery,
    videoUrl: nextVideoUrl,
    videoPoster: nextVideoPoster,
    packaging: effectiveSnapshot.packaging,
    itemWeightGrams: effectiveSnapshot.itemWeightGrams > 0 ? effectiveSnapshot.itemWeightGrams : product.itemWeightGrams,
    lotCbm: effectiveSnapshot.lotCbm,
    minUsd: effectiveSnapshot.minUsd,
    maxUsd: effectiveSnapshot.maxUsd,
    moq: effectiveSnapshot.moq,
    unit: effectiveSnapshot.unit,
    badge: effectiveSnapshot.badge,
    supplierName: effectiveSnapshot.supplierName,
    supplierLocation: effectiveSnapshot.supplierLocation,
    supplierCompanyId: effectiveSnapshot.supplierCompanyId ?? product.supplierCompanyId,
    responseTime: effectiveSnapshot.responseTime,
    yearsInBusiness: effectiveSnapshot.yearsInBusiness,
    transactionsLabel: effectiveSnapshot.transactionsLabel,
    soldLabel: effectiveSnapshot.soldLabel,
    customizationLabel: effectiveSnapshot.customizationLabel,
    shippingLabel: effectiveSnapshot.shippingLabel,
    chinaLocalFreightFcfa: "chinaLocalFreightFcfa" in effectiveSnapshot ? effectiveSnapshot.chinaLocalFreightFcfa : product.chinaLocalFreightFcfa,
    chinaLocalFreightLabel: "chinaLocalFreightLabel" in effectiveSnapshot ? effectiveSnapshot.chinaLocalFreightLabel : product.chinaLocalFreightLabel,
    overview: nextOverview,
    variantGroups: nextVariantGroups,
    variantPricing: effectiveSnapshot.variantPricing ?? product.variantPricing,
    variantSkus: effectiveSnapshot.variantSkus ?? product.variantSkus,
    tiers: nextTiers,
    specs: nextSpecs,
    moqVerified: getBooleanRecordValue(effectiveSnapshot, "moqVerified") ?? product.moqVerified,
    weightVerified: getBooleanRecordValue(effectiveSnapshot, "weightVerified") ?? product.weightVerified,
    priceVerified: getBooleanRecordValue(effectiveSnapshot, "priceVerified") ?? product.priceVerified,
    inventory: Math.max(effectiveSnapshot.moq * 5, 50),
    updatedAt: timestamp,
    rawPayload: enrichedRawPayload,
  };

  await saveAlibabaImportedProducts([nextProduct]);
  await createAlibabaIntegrationLog({
    action: "catalog-import-reenrich",
    endpoint: "/alibaba/icbu/product/get/v2",
    status: "success",
    requestBody: {
      importedProductId,
      sourceProductId: product.sourceProductId,
    },
    responseBody: {
      importedProductId,
      sourceProductId: product.sourceProductId,
      source: snapshot ? "live-detail" : "stored-raw-payload",
      minUsd: nextProduct.minUsd,
      maxUsd: nextProduct.maxUsd,
      moq: nextProduct.moq,
      itemWeightGrams: nextProduct.itemWeightGrams,
    },
  });

  return nextProduct;
}

export async function reenrichAllImportedProducts() {
  const products = await getAlibabaImportedProducts();

  let updatedCount = 0;
  let failedCount = 0;
  const failedProducts: Array<{ id: string; sourceProductId: string; title: string; message: string }> = [];

  for (const product of products) {
    try {
      await reenrichImportedProduct(product.id);
      updatedCount += 1;
    } catch (error) {
      failedCount += 1;
      failedProducts.push({
        id: product.id,
        sourceProductId: product.sourceProductId,
        title: product.title,
        message: error instanceof Error ? error.message : "Reenrichissement impossible.",
      });
    }
  }

  await createAlibabaIntegrationLog({
    action: "catalog-import-reenrich-all",
    endpoint: "internal/imported-products/reenrich-all",
    status: failedCount > 0 ? "partial" : "success",
    requestBody: {
      productCount: products.length,
    },
    responseBody: {
      productCount: products.length,
      updatedCount,
      failedCount,
      failedProducts: failedProducts.slice(0, 20),
    },
  });

  return {
    productCount: products.length,
    updatedCount,
    failedCount,
    failedProducts,
  };
}

export async function saveAlibabaSupplierAccountInput(input: Omit<AlibabaSupplierAccount, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
  const timestamp = nowIso();
  const existing = input.id ? (await getAlibabaSupplierAccounts()).find((account) => account.id === input.id) : undefined;
  const accountId = input.id?.trim() || createSourcingIds();
  const normalizedAppKey = input.appKey?.trim();
  const normalizedAppSecret = input.appSecret?.trim();
  const normalizedAccessToken = input.accessToken?.trim();
  const normalizedRefreshToken = input.refreshToken?.trim();
  const account: AlibabaSupplierAccount = {
    ...input,
    id: accountId,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    authorizeUrl: normalizeAliExpressOAuthUrl(input.authorizeUrl ?? existing?.authorizeUrl, "authorize"),
    tokenUrl: normalizeAliExpressOAuthUrl(input.tokenUrl ?? existing?.tokenUrl, "token"),
    refreshUrl: normalizeAliExpressOAuthUrl(input.refreshUrl ?? existing?.refreshUrl, "refresh"),
    apiBaseUrl: input.apiBaseUrl?.trim() || ALIBABA_DEFAULT_API_BASE_URL,
    isActive: input.isActive ?? existing?.isActive ?? false,
    appKey: normalizedAppKey || existing?.appKey,
    appSecret: normalizedAppSecret || existing?.appSecret,
    accessToken: normalizedAccessToken || existing?.accessToken,
    refreshToken: normalizedRefreshToken || existing?.refreshToken,
    hasAppSecret: normalizedAppSecret ? true : existing?.hasAppSecret,
    hasAccessToken: normalizedAccessToken ? true : existing?.hasAccessToken,
    hasRefreshToken: normalizedRefreshToken ? true : existing?.hasRefreshToken,
  };

  account.appKey = normalizedAppKey || existing?.appKey;
  account.appSecret = normalizedAppSecret || existing?.appSecret;
  account.accessToken = normalizedAccessToken || existing?.accessToken;
  account.refreshToken = normalizedRefreshToken || existing?.refreshToken;
  account.hasAppSecret = Boolean(account.appSecret);
  account.hasAccessToken = Boolean(account.accessToken);
  account.hasRefreshToken = Boolean(account.refreshToken);

  if (account.isActive) {
    const accounts = await getAlibabaSupplierAccounts();
    await Promise.all(accounts.filter((entry) => entry.id !== account.id && entry.isActive).map((entry) => saveAlibabaSupplierAccount({
      ...entry,
      isActive: false,
      updatedAt: timestamp,
    })));
  }

  return saveAlibabaSupplierAccount(account);
}

export async function saveAlibabaReceptionAddressInput(input: Omit<AlibabaReceptionAddress, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
  const timestamp = nowIso();
  const addressId = input.id?.trim() || createSourcingIds();
  const address: AlibabaReceptionAddress = {
    ...input,
    id: addressId,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return saveAlibabaReceptionAddress(address);
}

export async function saveAlibabaCountryProfilesInput(profiles: AlibabaCountryProfile[]) {
  return saveAlibabaCountryProfiles(profiles);
}

export async function createAlibabaPurchaseOrder(input: {
  importedProductId: string;
  sourceProductId?: string;
  quantity: number;
  shippingAddressId?: string;
}) {
  const [products, addresses] = await Promise.all([
    getAlibabaImportedProducts({ fresh: true }),
    getAlibabaReceptionAddresses(),
  ]);
  const product = resolveImportedProduct(products, input.importedProductId, input.sourceProductId);
  if (!product) {
    throw new Error("Produit importe introuvable.");
  }

  const preferredAddress = input.shippingAddressId
    ? addresses.find((entry) => entry.id === input.shippingAddressId)
    : undefined;
  const address = preferredAddress
    ?? addresses.find((entry) => entry.isDefault)
    ?? addresses[0];

  if (!address) {
    throw new Error("Ajoutez d'abord une adresse de reception.");
  }

  const quantity = Math.max(1, input.quantity);
  const validatedAddress = await resolveValidatedAliExpressAddress(address);
  const liveProduct = await fetchAlibabaProductSnapshot({
    sourceProductId: product.sourceProductId,
    query: product.query,
    shipToCountry: address.countryCode,
    targetCurrency: process.env.ALIEXPRESS_DS_PAYMENT_CURRENCY ?? "USD",
    targetLanguage: process.env.ALIEXPRESS_DEFAULT_LANGUAGE ?? "en_US",
    provinceCode: validatedAddress.stateCode,
    cityCode: validatedAddress.cityCode,
  }).catch(() => null);
  const productForOrder = liveProduct
    ? {
        ...product,
        variantSkus: liveProduct.variantSkus,
        rawPayload: liveProduct.rawPayload,
      }
    : product;
  const supplierSkuId = resolveAlibabaImportedProductSkuId(productForOrder);
  if (!supplierSkuId) {
    throw new Error("SKU AliExpress introuvable pour cet article. Reimporte le produit puis relance le lot DS.");
  }
  const supplierSkuAttr = resolveAlibabaImportedProductSkuAttr(productForOrder, supplierSkuId);
  if (typeof supplierSkuAttr === "undefined") {
    throw new Error("Attribut SKU AliExpress introuvable pour cet article. Reimporte le produit puis relance le lot DS.");
  }

  const freightResult = await calculateAlibabaBasicFreight({
    destinationCountry: address.countryCode,
    productId: product.sourceProductId,
    quantity,
    selectedSkuId: supplierSkuId,
    provinceCode: validatedAddress.stateCode,
    cityCode: validatedAddress.cityCode,
    language: process.env.ALIEXPRESS_DEFAULT_LANGUAGE ?? "en_US",
    locale: process.env.ALIEXPRESS_DEFAULT_LOCALE ?? process.env.ALIEXPRESS_DEFAULT_LANGUAGE ?? "en_US",
    currency: process.env.ALIEXPRESS_DS_PAYMENT_CURRENCY ?? "USD",
  });
  const carrierCode = resolveAlibabaOrderCarrierCode(freightResult.responseBody);
  if (!carrierCode) {
    const freightMessage = extractAlibabaOperationMessage(freightResult.responseBody);
    throw new Error(freightMessage === "DELIVERY_NOT_AVAILABLE_TO_YOUR_ADDRESS"
      ? "Aucune livraison AliExpress n'est disponible pour cette adresse avec ce SKU."
      : freightMessage === "DELIVERY_INFO_EMPTY"
        ? "AliExpress n'a retourne aucune information de livraison pour ce produit. Verifie l'identifiant produit et le SKU utilises."
      : freightMessage
        ? `Verification livraison DS impossible: ${freightMessage}`
        : "Aucune option de livraison AliExpress n'a ete retournee pour ce lot.");
  }
  const supplierUnitPrice = Math.max(0, Number(product.minUsd) / (1 + getAliExpressMarginRate()));
  const logisticsPayload = {
    shipment_address: {
      zip: address.postalCode ?? "",
      country: address.countryCode,
      address: address.addressLine1,
      city: validatedAddress.city,
      contact_person: address.contactName,
      province: validatedAddress.state,
      province_code: validatedAddress.stateCode,
      country_code: address.countryCode,
      alternate_address: address.addressLine2 ?? "",
      port: address.port ?? "",
      port_code: address.portCode ?? "",
      telephone: {
        country: address.countryCode,
        area: "",
        number: address.phone,
      },
    },
    dispatch_location: "CN",
    carrier_code: carrierCode,
  };
  const buyNowPayload = {
    out_order_id: `AFRIPAY-${Date.now()}`,
    logistics_address: {
      address: address.addressLine1,
      address2: address.addressLine2 ?? "",
      city: validatedAddress.city,
      contact_person: address.contactName,
      country: address.countryCode,
      full_name: address.contactName,
      locale: "fr_FR",
      mobile_no: address.phone,
      phone_country: "+",
      province: validatedAddress.state,
      zip: address.postalCode ?? "",
    },
    product_items: [
      {
        product_id: product.sourceProductId,
        product_count: quantity,
        ...(supplierSkuId ? { sku_id: supplierSkuId } : {}),
        sku_attr: supplierSkuAttr,
        logistics_service_name: carrierCode,
        order_memo: `Batch AfriPay ${product.shortTitle}`,
      },
    ],
  };

  const purchaseOrder: AlibabaPurchaseOrder = {
    id: createSourcingIds(),
    sourceImportedProductId: product.id,
    sourceProductId: product.sourceProductId,
    productTitle: product.shortTitle,
    supplierName: product.supplierName,
    supplierCompanyId: product.supplierCompanyId,
    quantity,
    shippingAddressId: address.id,
    logisticsPayload,
    buyNowPayload,
    freightStatus: "verified",
    orderStatus: "draft",
    paymentStatus: "not_started",
    amountUsd: quantity * product.minUsd,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    rawOrderResponse: {
      provider: "aliexpress-ds",
      status: "batch_saved",
      marginRate: getAliExpressMarginRate(),
      supplierUnitPriceUsd: supplierUnitPrice,
    },
    rawFreightResponse: { simulated: true, provider: "aliexpress-ds" },
  };

  await saveAlibabaPurchaseOrder(purchaseOrder);
  await saveAlibabaReceptionRecord({
    id: createSourcingIds(),
    purchaseOrderId: purchaseOrder.id,
    productTitle: purchaseOrder.productTitle,
    quantityExpected: quantity,
    quantityReceived: 0,
    status: "pending",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  return purchaseOrder;
}

export async function payAlibabaPurchaseOrder(orderId: string) {
  const orders = await getAlibabaPurchaseOrders();
  const order = orders.find((entry) => entry.id === orderId);
  if (!order) {
    throw new Error("Ordre d'achat introuvable.");
  }

  if (!order.tradeId) {
    const orderResult = await createAlibabaBuyNowOrder(order.buyNowPayload);
    const responseObject = orderResult.responseBody as {
      result?: {
        is_success?: boolean;
        error_msg?: string;
        error_code?: string;
        order_list?: { number?: Array<string | number> };
      };
      aliexpress_ds_order_create_response?: {
        result?: {
          is_success?: boolean;
          error_msg?: string;
          error_code?: string;
          order_list?: { number?: Array<string | number> };
        };
      };
    };
    const dsResult = responseObject?.result ?? responseObject?.aliexpress_ds_order_create_response?.result;
    const tradeId = dsResult?.order_list?.number?.[0] ?? extractAlibabaTradeId(orderResult.responseBody);
    const dsErrorCode = dsResult?.error_code ?? extractAlibabaOperationCode(orderResult.responseBody);
    const dsErrorMessage = dsResult?.error_msg ?? extractAlibabaOperationMessage(orderResult.responseBody);
    const dsOrderCreated = orderResult.ok && dsResult?.is_success !== false;
    const dsAutoPayFailed = dsOrderCreated && isAliExpressDsAutoPayFailure(dsErrorMessage);
    const nextOrder: AlibabaPurchaseOrder = {
      ...order,
      tradeId: typeof tradeId !== "undefined" ? String(tradeId) : undefined,
      orderStatus: dsOrderCreated ? "order_created" : "failed",
      paymentStatus: dsOrderCreated ? (dsAutoPayFailed ? "failed" : "pending") : "failed",
      payFailureReason: dsOrderCreated
        ? (dsAutoPayFailed ? formatAliExpressDsAutoPayFailure(dsErrorMessage) : undefined)
        : formatAliExpressDsOrderCreateFailure(dsErrorCode, dsErrorMessage),
      rawOrderResponse: orderResult.responseBody,
      updatedAt: nowIso(),
    };
    await saveAlibabaPurchaseOrder(nextOrder);

    if (!nextOrder.tradeId || nextOrder.orderStatus === "failed") {
      return nextOrder;
    }

    return syncAlibabaPurchaseOrderStateWithRetry(nextOrder, 3, 2000).catch(() => nextOrder);
  }

  const paymentResult = await createAlibabaDropshippingPayment({ tradeId: order.tradeId });
  const paymentError = extractAliExpressTradeError(paymentResult.responseBody);
  const paymentObject = paymentResult.responseBody as { value?: { reason_message?: string }; reason_message?: string };
  const paymentMessage = paymentError?.subMessage
    ?? paymentError?.message
    ?? paymentObject?.value?.reason_message
    ?? paymentObject?.reason_message
    ?? extractAlibabaOperationMessage(paymentResult.responseBody);
  const payUrl = extractAliExpressTradePayUrl(paymentResult.responseBody)
    ?? order.payUrl;
  const permissionDenied = isAliExpressPermissionError(paymentError?.code, paymentError?.subCode, paymentMessage);
  const hasBusinessError = Boolean(paymentError?.subCode || paymentError?.code);
  const paymentSucceeded = paymentResult.ok && !hasBusinessError;

  const nextOrder: AlibabaPurchaseOrder = {
    ...order,
    paymentStatus: paymentSucceeded
      ? (payUrl ? "pay_url_generated" : "pending")
      : permissionDenied
        ? (payUrl ? "pay_url_generated" : "pending")
        : "failed",
    payUrl,
    payFailureReason: paymentSucceeded
      ? undefined
      : permissionDenied
        ? paymentMessage ?? "Permission API insuffisante pour lire le statut detaille du paiement DS."
        : paymentMessage ?? "Paiement AliExpress echoue",
    rawPaymentResponse: paymentResult.responseBody,
    updatedAt: nowIso(),
  };
  await saveAlibabaPurchaseOrder(nextOrder);
  if (nextOrder.paymentStatus === "pending" && !nextOrder.payUrl) {
    return syncAlibabaPurchaseOrderStateWithRetry(nextOrder, 3, 2000).catch(() => nextOrder);
  }

  return nextOrder;
}

export async function repayAlibabaPurchaseOrder(orderId: string) {
  const orders = await getAlibabaPurchaseOrders();
  const order = orders.find((entry) => entry.id === orderId);
  if (!order) {
    throw new Error("Ordre d'achat introuvable.");
  }

  if (!order.tradeId) {
    return payAlibabaPurchaseOrder(orderId);
  }

  const paymentResult = await createAlibabaDropshippingPayment({ tradeId: order.tradeId });
  const paymentError = extractAliExpressTradeError(paymentResult.responseBody);
  const paymentObject = paymentResult.responseBody as { value?: { reason_message?: string }; reason_message?: string };
  const paymentMessage = paymentError?.subMessage
    ?? paymentError?.message
    ?? paymentObject?.value?.reason_message
    ?? paymentObject?.reason_message
    ?? extractAlibabaOperationMessage(paymentResult.responseBody);
  const payUrl = extractAliExpressTradePayUrl(paymentResult.responseBody)
    ?? order.payUrl;
  const permissionDenied = isAliExpressPermissionError(paymentError?.code, paymentError?.subCode, paymentMessage);
  const hasBusinessError = Boolean(paymentError?.subCode || paymentError?.code);
  const paymentSucceeded = paymentResult.ok && !hasBusinessError;
  const nextOrder: AlibabaPurchaseOrder = {
    ...order,
    paymentStatus: paymentSucceeded
      ? (payUrl ? "pay_url_generated" : "pending")
      : permissionDenied
        ? (payUrl ? "pay_url_generated" : "pending")
        : "failed",
    payUrl,
    payFailureReason: paymentSucceeded
      ? undefined
      : permissionDenied
        ? paymentMessage ?? "Permission API insuffisante pour lire le statut detaille du paiement DS."
        : paymentMessage ?? "Repaiement AliExpress echoue",
    rawPaymentResponse: paymentResult.responseBody,
    updatedAt: nowIso(),
    orderStatus: paymentSucceeded || permissionDenied ? "payment_pending" : "failed",
  };
  await saveAlibabaPurchaseOrder(nextOrder);

  if (!paymentResult.ok || payUrl) {
    return nextOrder;
  }

  return syncAlibabaPurchaseOrderStateWithRetry(nextOrder, 3, 2000).catch(() => nextOrder);
}

export async function syncAlibabaPurchaseOrderByTradeId(tradeId: string) {
  const normalizedTradeId = String(tradeId).trim();
  if (!normalizedTradeId) {
    throw new Error("tradeId AliExpress introuvable.");
  }

  const orders = await getAlibabaPurchaseOrders();
  const order = orders.find((entry) => String(entry.tradeId ?? "").trim() === normalizedTradeId);
  if (!order) {
    throw new Error(`Aucun lot AliExpress local ne correspond au trade ${normalizedTradeId}.`);
  }

  return syncAlibabaPurchaseOrderState(order);
}

export async function refreshAlibabaPaymentStatus(orderId: string) {
  const orders = await getAlibabaPurchaseOrders();
  const order = orders.find((entry) => entry.id === orderId);
  if (!order) {
    throw new Error("Ordre AliExpress introuvable.");
  }

  if (!order.tradeId) {
    return order;
  }

  return syncAlibabaPurchaseOrderState(order);
}
