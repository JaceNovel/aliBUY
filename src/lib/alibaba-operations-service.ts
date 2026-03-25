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
  createAlibabaBuyNowOrder,
  createAlibabaDropshippingPayment,
  fetchAlibabaProductSnapshot,
  queryAlibabaPaymentResult,
  resolveAlibabaIcbuCategoryInfo,
  searchAlibabaProducts,
} from "@/lib/alibaba-open-platform-client";

function nowIso() {
  return new Date().toISOString();
}

function getExpiryDate(secondsLike: unknown) {
  const seconds = Number(secondsLike ?? 0);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return undefined;
  }

  return new Date(Date.now() + seconds * 1000).toISOString();
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
  return account?.apiBaseUrl?.trim() || process.env.ALIBABA_OPEN_PLATFORM_API_BASE_URL || ALIBABA_DEFAULT_API_BASE_URL;
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
    throw new Error("Compte fournisseur Alibaba introuvable.");
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
    `Import Alibaba pour ${product.shortTitle}.`,
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
    overview: buildOverview(product),
    variantGroups: product.variantGroups,
    tiers: product.tiers,
    specs: product.specs,
    inventory: Math.max(product.moq * 5, 50),
    status: publishedToSite ? "published" : "imported",
    publishedToSite,
    createdAt: timestamp,
    updatedAt: timestamp,
    publishedAt: publishedToSite ? timestamp : undefined,
    rawPayload: { source: "fallback-catalog" },
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
    getAlibabaImportedProducts(),
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
    const existingImportedProducts = await getAlibabaImportedProducts();
    const existingSourceProductIds = new Set(existingImportedProducts.map((product) => product.sourceProductId));
    const explorationLimit = Math.min(Math.max(job.limit * 4, 40), 100);
    const searchResult = await searchAlibabaProducts({
      query: job.query,
      limit: explorationLimit,
      fulfillmentChannel: job.fulfillmentChannel,
    });

    if (!searchResult.ok) {
      throw new Error(searchResult.errorMessage ?? "Recherche Alibaba impossible.");
    }

    if (searchResult.products.length === 0) {
      throw new Error("Aucun produit live renvoye par Alibaba pour cette recherche.");
    }

    const uniqueSearchProducts = searchResult.products.filter((product, index, products) => products.findIndex((entry) => entry.sourceProductId === product.sourceProductId) === index);
    const productsWithRequiredData = uniqueSearchProducts.filter((product) => product.priceVerified && product.moqVerified && product.weightVerified && product.itemWeightGrams > 0);
    const freshProducts = productsWithRequiredData.filter((product) => !existingSourceProductIds.has(product.sourceProductId)).slice(0, job.limit);
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
    }, { price: 0, moq: 0, weight: 0 });

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

    const skippedMissingRequiredDataCount = uniqueSearchProducts.length - productsWithRequiredData.length;
    const skippedExistingCount = Math.max(0, productsWithRequiredData.length - freshProducts.length);

    if (importedProducts.length > 0) {
      await saveAlibabaImportedProducts(importedProducts);
    }

    const warningMessage = importedProducts.length < job.limit
      ? `Import partiel: ${importedProducts.length}/${job.limit} importes.${skippedMissingRequiredDataCount > 0 ? ` Rejets donnees fournisseur: ${skippedMissingRequiredDataCount}.` : ""}${rejectedReasonCounts.price > 0 ? ` Prix incoherent: ${rejectedReasonCounts.price}.` : ""}${rejectedReasonCounts.moq > 0 ? ` MOQ non verifie: ${rejectedReasonCounts.moq}.` : ""}${rejectedReasonCounts.weight > 0 ? ` Poids non exploitable: ${rejectedReasonCounts.weight}.` : ""}${skippedExistingCount > 0 ? ` Deja importes ignores: ${skippedExistingCount}.` : ""}`
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
        skippedExistingCount,
        skippedMissingRequiredDataCount,
        rejectedReasonCounts,
        fallback: false,
        warningMessage,
      },
    });

    return {
      job: completedJob,
      products: importedProducts,
      usedFallback: false,
      targetImportCount: job.limit,
      exploredCount: uniqueSearchProducts.length,
      skippedExistingCount,
      skippedMissingRequiredDataCount,
      rejectedReasonCounts,
      warningMessage,
    };
  } catch (error) {
    const failedJob: AlibabaImportJob = {
      ...job,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Import Alibaba impossible.",
      updatedAt: nowIso(),
    };
    await saveAlibabaImportJob(failedJob);
    throw error;
  }
}

export async function publishImportedProducts(productIds: string[]) {
  const products = await getAlibabaImportedProducts();
  const timestamp = nowIso();
  const next = products.map((product) => productIds.includes(product.id)
    ? { ...product, publishedToSite: true, status: "published" as const, publishedAt: timestamp, updatedAt: timestamp }
    : product);
  await saveAlibabaImportedProducts(next);
  return next.filter((product) => productIds.includes(product.id));
}

export async function deleteImportedProduct(importedProductId: string) {
  const products = await getAlibabaImportedProducts();
  const product = products.find((entry) => entry.id === importedProductId);

  if (!product) {
    throw new Error("Produit importe introuvable.");
  }

  await deleteAlibabaImportedProduct(importedProductId);
  await createAlibabaIntegrationLog({
    action: "catalog-import-delete",
    endpoint: "internal/imported-products/delete",
    status: "success",
    requestBody: { importedProductId },
    responseBody: {
      importedProductId,
      sourceProductId: product.sourceProductId,
      title: product.title,
    },
  });

  return { deletedId: importedProductId, sourceProductId: product.sourceProductId };
}

export async function reenrichImportedProduct(importedProductId: string) {
  const products = await getAlibabaImportedProducts();
  const product = products.find((entry) => entry.id === importedProductId);

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
    overview: nextOverview,
    variantGroups: nextVariantGroups,
    tiers: nextTiers,
    specs: nextSpecs,
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
    authorizeUrl: input.authorizeUrl?.trim() || ALIBABA_DEFAULT_AUTHORIZE_URL,
    tokenUrl: input.tokenUrl?.trim() || ALIBABA_DEFAULT_TOKEN_URL,
    refreshUrl: input.refreshUrl?.trim() || ALIBABA_DEFAULT_REFRESH_URL,
    apiBaseUrl: input.apiBaseUrl?.trim() || getAlibabaAccountApiBaseUrl(existing),
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
  quantity: number;
  shippingAddressId?: string;
  autoPay: boolean;
}) {
  const [products, addresses] = await Promise.all([
    getAlibabaImportedProducts(),
    getAlibabaReceptionAddresses(),
  ]);
  const product = products.find((entry) => entry.id === input.importedProductId);
  if (!product) {
    throw new Error("Produit importe introuvable.");
  }

  const address = input.shippingAddressId
    ? addresses.find((entry) => entry.id === input.shippingAddressId)
    : addresses.find((entry) => entry.isDefault);

  if (!address) {
    throw new Error("Ajoutez d'abord une adresse de reception par defaut.");
  }

  const quantity = Math.max(1, input.quantity);
  const logisticsPayload = {
    shipment_address: {
      zip: address.postalCode ?? "",
      country: address.countryCode,
      address: address.addressLine1,
      city: address.city,
      contact_person: address.contactName,
      province: address.state,
      province_code: address.state,
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
    carrier_code: "EX_ASP_JYC_FEDEX",
  };
  const buyNowPayload = {
    channel_refer_id: `AFRIPAY-${Date.now()}`,
    logistics_detail: logisticsPayload,
    product_list: [
      {
        quantity: String(quantity),
        product_id: product.sourceProductId,
        sku_id: product.sourceProductId,
      },
    ],
    properties: {
      platform: "CommerceHQ",
      orderId: `AFRIPAY-${Date.now()}`,
    },
    remark: `Auto achat ${product.shortTitle}`,
  };

  const orderResult = await createAlibabaBuyNowOrder(buyNowPayload);
  const responseObject = orderResult.responseBody as { value?: { trade_id?: string; pay_url?: string }; trade_id?: string; pay_url?: string; message?: string };
  const tradeId = responseObject?.value?.trade_id ?? responseObject?.trade_id;
  const payUrl = responseObject?.value?.pay_url ?? responseObject?.pay_url;

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
    freightStatus: orderResult.ok ? "verified" : "skipped",
    orderStatus: orderResult.ok ? "order_created" : "failed",
    paymentStatus: orderResult.ok ? (payUrl ? "pay_url_generated" : "pending") : "failed",
    tradeId: tradeId ? String(tradeId) : undefined,
    payUrl: payUrl ? String(payUrl) : undefined,
    payFailureReason: orderResult.ok ? undefined : responseObject?.message ?? "Create BuyNow order failed",
    amountUsd: quantity * product.minUsd,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    rawOrderResponse: orderResult.responseBody,
    rawFreightResponse: { simulated: true },
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

  if (input.autoPay && purchaseOrder.tradeId) {
    return payAlibabaPurchaseOrder(purchaseOrder.id);
  }

  return purchaseOrder;
}

export async function payAlibabaPurchaseOrder(orderId: string) {
  const orders = await getAlibabaPurchaseOrders();
  const order = orders.find((entry) => entry.id === orderId);
  if (!order) {
    throw new Error("Ordre d'achat introuvable.");
  }
  if (!order.tradeId) {
    return order;
  }

  const paymentResult = await createAlibabaDropshippingPayment({ tradeId: order.tradeId });
  const paymentObject = paymentResult.responseBody as { pay_url?: string; value?: { pay_url?: string; status?: string; reason_message?: string }; status?: string; reason_message?: string };
  const payUrl = paymentObject?.value?.pay_url ?? paymentObject?.pay_url ?? order.payUrl;

  const nextOrder: AlibabaPurchaseOrder = {
    ...order,
    paymentStatus: paymentResult.ok ? (payUrl ? "pay_url_generated" : "pending") : "failed",
    payUrl,
    payFailureReason: paymentResult.ok ? undefined : paymentObject?.value?.reason_message ?? paymentObject?.reason_message ?? "Paiement Alibaba echoue",
    rawPaymentResponse: paymentResult.responseBody,
    updatedAt: nowIso(),
  };
  await saveAlibabaPurchaseOrder(nextOrder);
  return nextOrder;
}

export async function refreshAlibabaPaymentStatus(orderId: string) {
  const orders = await getAlibabaPurchaseOrders();
  const order = orders.find((entry) => entry.id === orderId);
  if (!order?.tradeId) {
    throw new Error("Ordre Alibaba sans trade_id.");
  }

  const paymentResult = await queryAlibabaPaymentResult({ tradeId: order.tradeId });
  const body = paymentResult.responseBody as { status?: string; value?: { status?: string; reason_message?: string } };
  const status = body?.value?.status ?? body?.status ?? "pending";
  const nextOrder: AlibabaPurchaseOrder = {
    ...order,
    paymentStatus: status === "paid" ? "paid" : status === "failed" ? "failed" : "pending",
    payFailureReason: status === "failed" ? body?.value?.reason_message ?? "Paiement non complete" : undefined,
    rawPaymentResponse: paymentResult.responseBody,
    updatedAt: nowIso(),
    orderStatus: status === "paid" ? "paid" : order.orderStatus,
  };
  await saveAlibabaPurchaseOrder(nextOrder);
  return nextOrder;
}
