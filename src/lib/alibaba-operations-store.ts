import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { Prisma } from "@prisma/client";

import type {
  AlibabaCountryProfile,
  AlibabaImportJob,
  AlibabaImportedProduct,
  AlibabaPurchaseOrder,
  AlibabaReceptionAddress,
  AlibabaReceptionRecord,
  AlibabaSupplierAccount,
} from "@/lib/alibaba-operations";
import { prisma } from "@/lib/prisma";

const DEFAULT_COUNTRY_PROFILES: AlibabaCountryProfile[] = [
  {
    countryCode: "CI",
    countryName: "Cote d'Ivoire",
    currencyCode: "XOF",
    defaultCarrierCode: "EX_ASP_JYC_FEDEX",
    importTaxRate: 18,
    customsMode: "business",
    clearanceCodeLabel: "RCCM / NIF",
    enabled: true,
  },
  {
    countryCode: "SN",
    countryName: "Senegal",
    currencyCode: "XOF",
    defaultCarrierCode: "EX_ASP_JYC_FEDEX",
    importTaxRate: 18,
    customsMode: "business",
    clearanceCodeLabel: "NINEA",
    enabled: true,
  },
];

const ROOT_DIR = path.join(process.cwd(), "data", "sourcing");
const IMPORT_JOBS_PATH = path.join(ROOT_DIR, "alibaba-import-jobs.json");
const IMPORTED_PRODUCTS_PATH = path.join(ROOT_DIR, "alibaba-imported-products.json");
const SUPPLIER_ACCOUNTS_PATH = path.join(ROOT_DIR, "alibaba-supplier-accounts.json");
const COUNTRY_PROFILES_PATH = path.join(ROOT_DIR, "alibaba-country-profiles.json");
const RECEPTION_ADDRESSES_PATH = path.join(ROOT_DIR, "alibaba-reception-addresses.json");
const PURCHASE_ORDERS_PATH = path.join(ROOT_DIR, "alibaba-purchase-orders.json");
const RECEPTIONS_PATH = path.join(ROOT_DIR, "alibaba-receptions.json");
type EncryptedField = "appSecret" | "accessToken" | "refreshToken";

type EncryptedPayload = {
  __encrypted: true;
  version: 1;
  iv: string;
  tag: string;
  value: string;
};

async function ensureDir() {
  await mkdir(ROOT_DIR, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  await ensureDir();

  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    await writeJsonFile(filePath, fallback);
    return fallback;
  }
}

async function writeJsonFile<T>(filePath: string, value: T) {
  await ensureDir();
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function getEncryptionKey() {
  const configuredKey = process.env.ALIBABA_ACCOUNT_ENCRYPTION_KEY?.trim();
  if (!configuredKey) {
    return null;
  }

  if (/^[a-f0-9]{64}$/i.test(configuredKey)) {
    return Buffer.from(configuredKey, "hex");
  }

  return createHash("sha256").update(configuredKey, "utf8").digest();
}

function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  return Boolean(
    value
    && typeof value === "object"
    && (value as EncryptedPayload).__encrypted === true
    && typeof (value as EncryptedPayload).iv === "string"
    && typeof (value as EncryptedPayload).tag === "string"
    && typeof (value as EncryptedPayload).value === "string",
  );
}

function encryptSensitiveValue(value: string) {
  const key = getEncryptionKey();
  if (!key) {
    return value;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);

  return {
    __encrypted: true,
    version: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    value: encrypted.toString("base64"),
  } satisfies EncryptedPayload;
}

function decryptSensitiveValue(value: unknown) {
  if (!isEncryptedPayload(value)) {
    return typeof value === "string" ? value : undefined;
  }

  const key = getEncryptionKey();
  if (!key) {
    return undefined;
  }

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(value.iv, "base64"));
    decipher.setAuthTag(Buffer.from(value.tag, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(value.value, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return undefined;
  }
}

async function readAlibabaSupplierAccountsFile() {
  const accounts = await readJsonFile<Array<AlibabaSupplierAccount & Partial<Record<EncryptedField, unknown>>>>(SUPPLIER_ACCOUNTS_PATH, []);
  return accounts.map((account) => ({
    ...account,
    appSecret: decryptSensitiveValue(account.appSecret),
    accessToken: decryptSensitiveValue(account.accessToken),
    refreshToken: decryptSensitiveValue(account.refreshToken),
    hasAppSecret: Boolean(decryptSensitiveValue(account.appSecret)),
    hasAccessToken: Boolean(decryptSensitiveValue(account.accessToken)),
    hasRefreshToken: Boolean(decryptSensitiveValue(account.refreshToken)),
  }));
}

function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }

  return value as Prisma.InputJsonValue;
}

function toNullablePrismaJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }

  if (value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

function toDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function fromStoredSecret(value: Prisma.JsonValue | string | null | undefined) {
  return decryptSensitiveValue(value);
}

function toStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function toUnknownArray<T>(value: Prisma.JsonValue | null | undefined): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

async function migrateRecordsFromFile<T>(readFromFile: () => Promise<T[]>, saveEach: (items: T[]) => Promise<T[]>): Promise<T[]> {
  const items = await readFromFile();
  if (items.length === 0) {
    return items;
  }

  return saveEach(items);
}

function mapSupplierAccountRecord(record: {
  id: string;
  name: string;
  email: string;
  accountPlatform: string;
  countryCode: string;
  defaultDispatchLocation: string;
  status: string;
  memberId: string | null;
  resourceOwner: string | null;
  appKey: string | null;
  appSecret: Prisma.JsonValue | null;
  authorizeUrl: string | null;
  tokenUrl: string | null;
  refreshUrl: string | null;
  apiBaseUrl: string | null;
  accessToken: Prisma.JsonValue | null;
  refreshToken: Prisma.JsonValue | null;
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  accountId: string | null;
  accountLogin: string | null;
  accountName: string | null;
  oauthCountry: string | null;
  isActive: boolean;
  hasAppSecret: boolean;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  lastAuthorizedAt: Date | null;
  lastError: string | null;
  accessTokenHint: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AlibabaSupplierAccount {
  const appSecret = fromStoredSecret(record.appSecret);
  const accessToken = fromStoredSecret(record.accessToken);
  const refreshToken = fromStoredSecret(record.refreshToken);

  return {
    id: record.id,
    name: record.name,
    email: record.email,
    accountPlatform: record.accountPlatform === "seller" ? "seller" : record.accountPlatform === "isv" ? "isv" : "buyer",
    countryCode: record.countryCode,
    defaultDispatchLocation: record.defaultDispatchLocation,
    status: record.status === "connected" ? "connected" : record.status === "disabled" ? "disabled" : "needs_auth",
    memberId: record.memberId ?? undefined,
    resourceOwner: record.resourceOwner ?? undefined,
    appKey: record.appKey ?? undefined,
    appSecret,
    authorizeUrl: record.authorizeUrl ?? undefined,
    tokenUrl: record.tokenUrl ?? undefined,
    refreshUrl: record.refreshUrl ?? undefined,
    apiBaseUrl: record.apiBaseUrl ?? undefined,
    accessToken,
    refreshToken,
    accessTokenExpiresAt: record.accessTokenExpiresAt?.toISOString(),
    refreshTokenExpiresAt: record.refreshTokenExpiresAt?.toISOString(),
    accountId: record.accountId ?? undefined,
    accountLogin: record.accountLogin ?? undefined,
    accountName: record.accountName ?? undefined,
    oauthCountry: record.oauthCountry ?? undefined,
    isActive: record.isActive,
    hasAppSecret: record.hasAppSecret || Boolean(appSecret),
    hasAccessToken: record.hasAccessToken || Boolean(accessToken),
    hasRefreshToken: record.hasRefreshToken || Boolean(refreshToken),
    lastAuthorizedAt: record.lastAuthorizedAt?.toISOString(),
    lastError: record.lastError ?? undefined,
    accessTokenHint: record.accessTokenHint ?? undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

async function readAlibabaSupplierAccountsDb(): Promise<AlibabaSupplierAccount[]> {
  const records = await prisma.alibabaSupplierAccountRecord.findMany({
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
  });

  if (records.length === 0) {
    return migrateRecordsFromFile(readAlibabaSupplierAccountsFile, writeAlibabaSupplierAccountsDbBulk);
  }

  return records.map(mapSupplierAccountRecord);
}

async function writeAlibabaSupplierAccountsDbBulk(accounts: AlibabaSupplierAccount[]): Promise<AlibabaSupplierAccount[]> {
  for (const account of accounts) {
    await writeAlibabaSupplierAccountDb(account);
  }

  return readAlibabaSupplierAccountsDb();
}

async function writeAlibabaSupplierAccountDb(account: AlibabaSupplierAccount): Promise<AlibabaSupplierAccount> {
  const encryptedAppSecret = account.appSecret ? encryptSensitiveValue(account.appSecret) : undefined;
  const encryptedAccessToken = account.accessToken ? encryptSensitiveValue(account.accessToken) : undefined;
  const encryptedRefreshToken = account.refreshToken ? encryptSensitiveValue(account.refreshToken) : undefined;

  await prisma.alibabaSupplierAccountRecord.upsert({
    where: { id: account.id },
    create: {
      id: account.id,
      name: account.name,
      email: account.email,
      accountPlatform: account.accountPlatform,
      countryCode: account.countryCode,
      defaultDispatchLocation: account.defaultDispatchLocation,
      status: account.status,
      memberId: account.memberId,
      resourceOwner: account.resourceOwner,
      appKey: account.appKey,
      appSecret: toNullablePrismaJson(encryptedAppSecret),
      authorizeUrl: account.authorizeUrl,
      tokenUrl: account.tokenUrl,
      refreshUrl: account.refreshUrl,
      apiBaseUrl: account.apiBaseUrl,
      accessToken: toNullablePrismaJson(encryptedAccessToken),
      refreshToken: toNullablePrismaJson(encryptedRefreshToken),
      accessTokenExpiresAt: toDate(account.accessTokenExpiresAt),
      refreshTokenExpiresAt: toDate(account.refreshTokenExpiresAt),
      accountId: account.accountId,
      accountLogin: account.accountLogin,
      accountName: account.accountName,
      oauthCountry: account.oauthCountry,
      isActive: Boolean(account.isActive),
      hasAppSecret: Boolean(account.appSecret),
      hasAccessToken: Boolean(account.accessToken),
      hasRefreshToken: Boolean(account.refreshToken),
      lastAuthorizedAt: toDate(account.lastAuthorizedAt),
      lastError: account.lastError,
      accessTokenHint: account.accessTokenHint,
      createdAt: toDate(account.createdAt) ?? new Date(),
      updatedAt: toDate(account.updatedAt) ?? new Date(),
    },
    update: {
      name: account.name,
      email: account.email,
      accountPlatform: account.accountPlatform,
      countryCode: account.countryCode,
      defaultDispatchLocation: account.defaultDispatchLocation,
      status: account.status,
      memberId: account.memberId,
      resourceOwner: account.resourceOwner,
      appKey: account.appKey,
      appSecret: typeof encryptedAppSecret === "undefined" ? undefined : toNullablePrismaJson(encryptedAppSecret),
      authorizeUrl: account.authorizeUrl,
      tokenUrl: account.tokenUrl,
      refreshUrl: account.refreshUrl,
      apiBaseUrl: account.apiBaseUrl,
      accessToken: typeof encryptedAccessToken === "undefined" ? undefined : toNullablePrismaJson(encryptedAccessToken),
      refreshToken: typeof encryptedRefreshToken === "undefined" ? undefined : toNullablePrismaJson(encryptedRefreshToken),
      accessTokenExpiresAt: toDate(account.accessTokenExpiresAt),
      refreshTokenExpiresAt: toDate(account.refreshTokenExpiresAt),
      accountId: account.accountId,
      accountLogin: account.accountLogin,
      accountName: account.accountName,
      oauthCountry: account.oauthCountry,
      isActive: Boolean(account.isActive),
      hasAppSecret: Boolean(account.appSecret),
      hasAccessToken: Boolean(account.accessToken),
      hasRefreshToken: Boolean(account.refreshToken),
      lastAuthorizedAt: toDate(account.lastAuthorizedAt),
      lastError: account.lastError,
      accessTokenHint: account.accessTokenHint,
      updatedAt: toDate(account.updatedAt) ?? new Date(),
    },
  });

  const record = await prisma.alibabaSupplierAccountRecord.findUnique({ where: { id: account.id } });
  if (!record) {
    throw new Error("Impossible de relire le compte Alibaba en base.");
  }

  return mapSupplierAccountRecord(record);
}

async function writeAlibabaSupplierAccountsFile(accounts: AlibabaSupplierAccount[]) {
  const next = accounts.map((account) => ({
    ...account,
    appSecret: account.appSecret ? encryptSensitiveValue(account.appSecret) : undefined,
    accessToken: account.accessToken ? encryptSensitiveValue(account.accessToken) : undefined,
    refreshToken: account.refreshToken ? encryptSensitiveValue(account.refreshToken) : undefined,
  }));
  await writeJsonFile(SUPPLIER_ACCOUNTS_PATH, next);
}

function mapImportJobRecord(record: {
  id: string;
  query: string;
  limit: number;
  fulfillmentChannel: string;
  autoPublish: boolean;
  status: string;
  importedCount: number;
  errorMessage: string | null;
  productIds: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}): AlibabaImportJob {
  return {
    id: record.id,
    query: record.query,
    limit: record.limit,
    fulfillmentChannel: record.fulfillmentChannel as AlibabaImportJob["fulfillmentChannel"],
    autoPublish: record.autoPublish,
    status: record.status as AlibabaImportJob["status"],
    importedCount: record.importedCount,
    errorMessage: record.errorMessage ?? undefined,
    productIds: toStringArray(record.productIds),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

async function readAlibabaImportJobsDb(): Promise<AlibabaImportJob[]> {
  const records = await prisma.alibabaImportJobRecord.findMany({
    orderBy: { updatedAt: "desc" },
  });

  if (records.length === 0) {
    return migrateRecordsFromFile(() => readJsonFile<AlibabaImportJob[]>(IMPORT_JOBS_PATH, []), writeAlibabaImportJobsDbBulk);
  }

  return records.map(mapImportJobRecord);
}

async function writeAlibabaImportJobDb(job: AlibabaImportJob): Promise<AlibabaImportJob> {
  await prisma.alibabaImportJobRecord.upsert({
    where: { id: job.id },
    create: {
      id: job.id,
      query: job.query,
      limit: job.limit,
      fulfillmentChannel: job.fulfillmentChannel,
      autoPublish: job.autoPublish,
      status: job.status,
      importedCount: job.importedCount,
      errorMessage: job.errorMessage,
      productIds: toPrismaJson(job.productIds) ?? [],
      createdAt: toDate(job.createdAt) ?? new Date(),
      updatedAt: toDate(job.updatedAt) ?? new Date(),
    },
    update: {
      query: job.query,
      limit: job.limit,
      fulfillmentChannel: job.fulfillmentChannel,
      autoPublish: job.autoPublish,
      status: job.status,
      importedCount: job.importedCount,
      errorMessage: job.errorMessage,
      productIds: toPrismaJson(job.productIds) ?? [],
      updatedAt: toDate(job.updatedAt) ?? new Date(),
    },
  });

  const record = await prisma.alibabaImportJobRecord.findUnique({ where: { id: job.id } });
  if (!record) {
    throw new Error("Impossible de relire le job d'import Alibaba en base.");
  }

  return mapImportJobRecord(record);
}

async function writeAlibabaImportJobsDbBulk(jobs: AlibabaImportJob[]): Promise<AlibabaImportJob[]> {
  for (const job of jobs) {
    await writeAlibabaImportJobDb(job);
  }

  return readAlibabaImportJobsDb();
}

function mapImportedProductRecord(record: {
  id: string;
  sourceProductId: string;
  categorySlug: string | null;
  categoryTitle: string | null;
  categoryPath: Prisma.JsonValue | null;
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  query: string;
  keywords: Prisma.JsonValue;
  image: string;
  gallery: Prisma.JsonValue;
  videoUrl: string | null;
  videoPoster: string | null;
  packaging: string;
  itemWeightGrams: number;
  lotCbm: string;
  minUsd: number;
  maxUsd: number | null;
  moq: number;
  unit: string;
  badge: string | null;
  supplierName: string;
  supplierLocation: string;
  supplierCompanyId: string | null;
  responseTime: string;
  yearsInBusiness: number;
  transactionsLabel: string;
  soldLabel: string;
  customizationLabel: string;
  shippingLabel: string;
  overview: Prisma.JsonValue;
  variantGroups: Prisma.JsonValue;
  tiers: Prisma.JsonValue;
  specs: Prisma.JsonValue;
  inventory: number;
  status: string;
  publishedToSite: boolean;
  publishedAt: Date | null;
  rawPayload: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}): AlibabaImportedProduct {
  return {
    id: record.id,
    sourceProductId: record.sourceProductId,
    categorySlug: record.categorySlug ?? undefined,
    categoryTitle: record.categoryTitle ?? undefined,
    categoryPath: toStringArray(record.categoryPath ?? undefined),
    slug: record.slug,
    title: record.title,
    shortTitle: record.shortTitle,
    description: record.description,
    query: record.query,
    keywords: toStringArray(record.keywords),
    image: record.image,
    gallery: toStringArray(record.gallery),
    videoUrl: record.videoUrl ?? undefined,
    videoPoster: record.videoPoster ?? undefined,
    packaging: record.packaging,
    itemWeightGrams: record.itemWeightGrams,
    lotCbm: record.lotCbm,
    minUsd: record.minUsd,
    maxUsd: record.maxUsd ?? undefined,
    moq: record.moq,
    unit: record.unit,
    badge: record.badge ?? undefined,
    supplierName: record.supplierName,
    supplierLocation: record.supplierLocation,
    supplierCompanyId: record.supplierCompanyId ?? undefined,
    responseTime: record.responseTime,
    yearsInBusiness: record.yearsInBusiness,
    transactionsLabel: record.transactionsLabel,
    soldLabel: record.soldLabel,
    customizationLabel: record.customizationLabel,
    shippingLabel: record.shippingLabel,
    overview: toStringArray(record.overview),
    variantGroups: toUnknownArray<{ label: string; values: string[] }>(record.variantGroups),
    tiers: toUnknownArray<{ quantityLabel: string; priceUsd: number; note?: string }>(record.tiers),
    specs: toUnknownArray<{ label: string; value: string }>(record.specs),
    inventory: record.inventory,
    status: record.status as AlibabaImportedProduct["status"],
    publishedToSite: record.publishedToSite,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    publishedAt: record.publishedAt?.toISOString(),
    rawPayload: record.rawPayload ?? undefined,
  };
}

async function readAlibabaImportedProductsDb(): Promise<AlibabaImportedProduct[]> {
  const records = await prisma.alibabaImportedProductRecord.findMany({
    orderBy: { updatedAt: "desc" },
  });

  if (records.length === 0) {
    return migrateRecordsFromFile(() => readJsonFile<AlibabaImportedProduct[]>(IMPORTED_PRODUCTS_PATH, []), writeAlibabaImportedProductsDbBulk);
  }

  return records.map(mapImportedProductRecord);
}

async function writeAlibabaImportedProductDb(product: AlibabaImportedProduct): Promise<AlibabaImportedProduct> {
  await prisma.alibabaImportedProductRecord.upsert({
    where: { id: product.id },
    create: {
      id: product.id,
      sourceProductId: product.sourceProductId,
      categorySlug: product.categorySlug,
      categoryTitle: product.categoryTitle,
      categoryPath: product.categoryPath ? toNullablePrismaJson(product.categoryPath) : undefined,
      slug: product.slug,
      title: product.title,
      shortTitle: product.shortTitle,
      description: product.description,
      query: product.query,
      keywords: toPrismaJson(product.keywords) ?? [],
      image: product.image,
      gallery: toPrismaJson(product.gallery) ?? [],
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
      supplierCompanyId: product.supplierCompanyId,
      responseTime: product.responseTime,
      yearsInBusiness: product.yearsInBusiness,
      transactionsLabel: product.transactionsLabel,
      soldLabel: product.soldLabel,
      customizationLabel: product.customizationLabel,
      shippingLabel: product.shippingLabel,
      overview: toPrismaJson(product.overview) ?? [],
      variantGroups: toPrismaJson(product.variantGroups) ?? [],
      tiers: toPrismaJson(product.tiers) ?? [],
      specs: toPrismaJson(product.specs) ?? [],
      inventory: product.inventory,
      status: product.status,
      publishedToSite: product.publishedToSite,
      publishedAt: toDate(product.publishedAt),
      rawPayload: toNullablePrismaJson(product.rawPayload),
      createdAt: toDate(product.createdAt) ?? new Date(),
      updatedAt: toDate(product.updatedAt) ?? new Date(),
    },
    update: {
      sourceProductId: product.sourceProductId,
      categorySlug: product.categorySlug,
      categoryTitle: product.categoryTitle,
      categoryPath: product.categoryPath ? toNullablePrismaJson(product.categoryPath) : undefined,
      slug: product.slug,
      title: product.title,
      shortTitle: product.shortTitle,
      description: product.description,
      query: product.query,
      keywords: toPrismaJson(product.keywords) ?? [],
      image: product.image,
      gallery: toPrismaJson(product.gallery) ?? [],
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
      supplierCompanyId: product.supplierCompanyId,
      responseTime: product.responseTime,
      yearsInBusiness: product.yearsInBusiness,
      transactionsLabel: product.transactionsLabel,
      soldLabel: product.soldLabel,
      customizationLabel: product.customizationLabel,
      shippingLabel: product.shippingLabel,
      overview: toPrismaJson(product.overview) ?? [],
      variantGroups: toPrismaJson(product.variantGroups) ?? [],
      tiers: toPrismaJson(product.tiers) ?? [],
      specs: toPrismaJson(product.specs) ?? [],
      inventory: product.inventory,
      status: product.status,
      publishedToSite: product.publishedToSite,
      publishedAt: toDate(product.publishedAt),
      rawPayload: toNullablePrismaJson(product.rawPayload),
      updatedAt: toDate(product.updatedAt) ?? new Date(),
    },
  });

  const record = await prisma.alibabaImportedProductRecord.findUnique({ where: { id: product.id } });
  if (!record) {
    throw new Error("Impossible de relire le produit importe Alibaba en base.");
  }

  return mapImportedProductRecord(record);
}

async function writeAlibabaImportedProductsDbBulk(products: AlibabaImportedProduct[]): Promise<AlibabaImportedProduct[]> {
  for (const product of products) {
    await writeAlibabaImportedProductDb(product);
  }

  return readAlibabaImportedProductsDb();
}

function mapCountryProfileRecord(record: {
  countryCode: string;
  countryName: string;
  currencyCode: string;
  defaultCarrierCode: string;
  importTaxRate: number;
  customsMode: string;
  clearanceCodeLabel: string;
  enabled: boolean;
}): AlibabaCountryProfile {
  return {
    countryCode: record.countryCode,
    countryName: record.countryName,
    currencyCode: record.currencyCode,
    defaultCarrierCode: record.defaultCarrierCode,
    importTaxRate: record.importTaxRate,
    customsMode: record.customsMode === "personal" ? "personal" : "business",
    clearanceCodeLabel: record.clearanceCodeLabel,
    enabled: record.enabled,
  };
}

async function readAlibabaCountryProfilesDb(): Promise<AlibabaCountryProfile[]> {
  const records = await prisma.alibabaCountryProfileRecord.findMany({ orderBy: { countryCode: "asc" } });

  if (records.length === 0) {
    return migrateRecordsFromFile(() => readJsonFile<AlibabaCountryProfile[]>(COUNTRY_PROFILES_PATH, DEFAULT_COUNTRY_PROFILES), writeAlibabaCountryProfilesDb);
  }

  return records.map(mapCountryProfileRecord);
}

async function writeAlibabaCountryProfilesDb(profiles: AlibabaCountryProfile[]): Promise<AlibabaCountryProfile[]> {
  await prisma.$transaction(async (transaction) => {
    await transaction.alibabaCountryProfileRecord.deleteMany();

    if (profiles.length > 0) {
      await transaction.alibabaCountryProfileRecord.createMany({
        data: profiles.map((profile) => ({
          countryCode: profile.countryCode,
          countryName: profile.countryName,
          currencyCode: profile.currencyCode,
          defaultCarrierCode: profile.defaultCarrierCode,
          importTaxRate: profile.importTaxRate,
          customsMode: profile.customsMode,
          clearanceCodeLabel: profile.clearanceCodeLabel,
          enabled: profile.enabled,
        })),
      });
    }
  });

  return readAlibabaCountryProfilesDb();
}

function mapReceptionAddressRecord(record: {
  id: string;
  label: string;
  contactName: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string | null;
  countryCode: string;
  port: string | null;
  portCode: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}): AlibabaReceptionAddress {
  return {
    id: record.id,
    label: record.label,
    contactName: record.contactName,
    phone: record.phone,
    email: record.email,
    addressLine1: record.addressLine1,
    addressLine2: record.addressLine2 ?? undefined,
    city: record.city,
    state: record.state,
    postalCode: record.postalCode ?? undefined,
    countryCode: record.countryCode,
    port: record.port ?? undefined,
    portCode: record.portCode ?? undefined,
    isDefault: record.isDefault,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

async function readAlibabaReceptionAddressesDb(): Promise<AlibabaReceptionAddress[]> {
  const records = await prisma.alibabaReceptionAddressRecord.findMany({
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });

  if (records.length === 0) {
    return migrateRecordsFromFile(() => readJsonFile<AlibabaReceptionAddress[]>(RECEPTION_ADDRESSES_PATH, []), writeAlibabaReceptionAddressesDbBulk);
  }

  return records.map(mapReceptionAddressRecord);
}

async function writeAlibabaReceptionAddressDb(address: AlibabaReceptionAddress): Promise<AlibabaReceptionAddress> {
  await prisma.$transaction(async (transaction) => {
    if (address.isDefault) {
      await transaction.alibabaReceptionAddressRecord.updateMany({
        where: { NOT: { id: address.id } },
        data: { isDefault: false },
      });
    }

    await transaction.alibabaReceptionAddressRecord.upsert({
      where: { id: address.id },
      create: {
        id: address.id,
        label: address.label,
        contactName: address.contactName,
        phone: address.phone,
        email: address.email,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        countryCode: address.countryCode,
        port: address.port,
        portCode: address.portCode,
        isDefault: address.isDefault,
        createdAt: toDate(address.createdAt) ?? new Date(),
        updatedAt: toDate(address.updatedAt) ?? new Date(),
      },
      update: {
        label: address.label,
        contactName: address.contactName,
        phone: address.phone,
        email: address.email,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        countryCode: address.countryCode,
        port: address.port,
        portCode: address.portCode,
        isDefault: address.isDefault,
        updatedAt: toDate(address.updatedAt) ?? new Date(),
      },
    });
  });

  const record = await prisma.alibabaReceptionAddressRecord.findUnique({ where: { id: address.id } });
  if (!record) {
    throw new Error("Impossible de relire l'adresse de reception Alibaba en base.");
  }

  return mapReceptionAddressRecord(record);
}

async function writeAlibabaReceptionAddressesDbBulk(addresses: AlibabaReceptionAddress[]): Promise<AlibabaReceptionAddress[]> {
  for (const address of addresses) {
    await writeAlibabaReceptionAddressDb(address);
  }

  return readAlibabaReceptionAddressesDb();
}

function mapPurchaseOrderRecord(record: {
  id: string;
  sourceImportedProductId: string;
  sourceProductId: string;
  productTitle: string;
  supplierName: string;
  supplierCompanyId: string | null;
  quantity: number;
  shippingAddressId: string;
  logisticsPayload: Prisma.JsonValue;
  buyNowPayload: Prisma.JsonValue;
  freightStatus: string;
  orderStatus: string;
  paymentStatus: string;
  tradeId: string | null;
  payUrl: string | null;
  payFailureReason: string | null;
  amountUsd: number;
  rawFreightResponse: Prisma.JsonValue | null;
  rawOrderResponse: Prisma.JsonValue | null;
  rawPaymentResponse: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}): AlibabaPurchaseOrder {
  return {
    id: record.id,
    sourceImportedProductId: record.sourceImportedProductId,
    sourceProductId: record.sourceProductId,
    productTitle: record.productTitle,
    supplierName: record.supplierName,
    supplierCompanyId: record.supplierCompanyId ?? undefined,
    quantity: record.quantity,
    shippingAddressId: record.shippingAddressId,
    logisticsPayload: (record.logisticsPayload as Record<string, unknown>) ?? {},
    buyNowPayload: (record.buyNowPayload as Record<string, unknown>) ?? {},
    freightStatus: record.freightStatus as AlibabaPurchaseOrder["freightStatus"],
    orderStatus: record.orderStatus as AlibabaPurchaseOrder["orderStatus"],
    paymentStatus: record.paymentStatus as AlibabaPurchaseOrder["paymentStatus"],
    tradeId: record.tradeId ?? undefined,
    payUrl: record.payUrl ?? undefined,
    payFailureReason: record.payFailureReason ?? undefined,
    amountUsd: record.amountUsd,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    rawFreightResponse: record.rawFreightResponse ?? undefined,
    rawOrderResponse: record.rawOrderResponse ?? undefined,
    rawPaymentResponse: record.rawPaymentResponse ?? undefined,
  };
}

async function readAlibabaPurchaseOrdersDb(): Promise<AlibabaPurchaseOrder[]> {
  const records = await prisma.alibabaPurchaseOrderRecord.findMany({
    orderBy: { updatedAt: "desc" },
  });

  if (records.length === 0) {
    return migrateRecordsFromFile(() => readJsonFile<AlibabaPurchaseOrder[]>(PURCHASE_ORDERS_PATH, []), writeAlibabaPurchaseOrdersDbBulk);
  }

  return records.map(mapPurchaseOrderRecord);
}

async function writeAlibabaPurchaseOrderDb(order: AlibabaPurchaseOrder): Promise<AlibabaPurchaseOrder> {
  await prisma.alibabaPurchaseOrderRecord.upsert({
    where: { id: order.id },
    create: {
      id: order.id,
      sourceImportedProductId: order.sourceImportedProductId,
      sourceProductId: order.sourceProductId,
      productTitle: order.productTitle,
      supplierName: order.supplierName,
      supplierCompanyId: order.supplierCompanyId,
      quantity: order.quantity,
      shippingAddressId: order.shippingAddressId,
      logisticsPayload: toPrismaJson(order.logisticsPayload) ?? {},
      buyNowPayload: toPrismaJson(order.buyNowPayload) ?? {},
      freightStatus: order.freightStatus,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      tradeId: order.tradeId,
      payUrl: order.payUrl,
      payFailureReason: order.payFailureReason,
      amountUsd: order.amountUsd,
      rawFreightResponse: toNullablePrismaJson(order.rawFreightResponse),
      rawOrderResponse: toNullablePrismaJson(order.rawOrderResponse),
      rawPaymentResponse: toNullablePrismaJson(order.rawPaymentResponse),
      createdAt: toDate(order.createdAt) ?? new Date(),
      updatedAt: toDate(order.updatedAt) ?? new Date(),
    },
    update: {
      sourceImportedProductId: order.sourceImportedProductId,
      sourceProductId: order.sourceProductId,
      productTitle: order.productTitle,
      supplierName: order.supplierName,
      supplierCompanyId: order.supplierCompanyId,
      quantity: order.quantity,
      shippingAddressId: order.shippingAddressId,
      logisticsPayload: toPrismaJson(order.logisticsPayload) ?? {},
      buyNowPayload: toPrismaJson(order.buyNowPayload) ?? {},
      freightStatus: order.freightStatus,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      tradeId: order.tradeId,
      payUrl: order.payUrl,
      payFailureReason: order.payFailureReason,
      amountUsd: order.amountUsd,
      rawFreightResponse: toNullablePrismaJson(order.rawFreightResponse),
      rawOrderResponse: toNullablePrismaJson(order.rawOrderResponse),
      rawPaymentResponse: toNullablePrismaJson(order.rawPaymentResponse),
      updatedAt: toDate(order.updatedAt) ?? new Date(),
    },
  });

  const record = await prisma.alibabaPurchaseOrderRecord.findUnique({ where: { id: order.id } });
  if (!record) {
    throw new Error("Impossible de relire le lot d'achat Alibaba en base.");
  }

  return mapPurchaseOrderRecord(record);
}

async function writeAlibabaPurchaseOrdersDbBulk(orders: AlibabaPurchaseOrder[]): Promise<AlibabaPurchaseOrder[]> {
  for (const order of orders) {
    await writeAlibabaPurchaseOrderDb(order);
  }

  return readAlibabaPurchaseOrdersDb();
}

function mapReceptionRecordItem(record: {
  id: string;
  purchaseOrderId: string;
  productTitle: string;
  quantityExpected: number;
  quantityReceived: number;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AlibabaReceptionRecord {
  return {
    id: record.id,
    purchaseOrderId: record.purchaseOrderId,
    productTitle: record.productTitle,
    quantityExpected: record.quantityExpected,
    quantityReceived: record.quantityReceived,
    status: record.status as AlibabaReceptionRecord["status"],
    notes: record.notes ?? undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

async function readAlibabaReceptionRecordsDb(): Promise<AlibabaReceptionRecord[]> {
  const records = await prisma.alibabaReceptionRecordItem.findMany({
    orderBy: { updatedAt: "desc" },
  });

  if (records.length === 0) {
    return migrateRecordsFromFile(() => readJsonFile<AlibabaReceptionRecord[]>(RECEPTIONS_PATH, []), writeAlibabaReceptionRecordsDbBulk);
  }

  return records.map(mapReceptionRecordItem);
}

async function writeAlibabaReceptionRecordDb(record: AlibabaReceptionRecord): Promise<AlibabaReceptionRecord> {
  await prisma.alibabaReceptionRecordItem.upsert({
    where: { id: record.id },
    create: {
      id: record.id,
      purchaseOrderId: record.purchaseOrderId,
      productTitle: record.productTitle,
      quantityExpected: record.quantityExpected,
      quantityReceived: record.quantityReceived,
      status: record.status,
      notes: record.notes,
      createdAt: toDate(record.createdAt) ?? new Date(),
      updatedAt: toDate(record.updatedAt) ?? new Date(),
    },
    update: {
      purchaseOrderId: record.purchaseOrderId,
      productTitle: record.productTitle,
      quantityExpected: record.quantityExpected,
      quantityReceived: record.quantityReceived,
      status: record.status,
      notes: record.notes,
      updatedAt: toDate(record.updatedAt) ?? new Date(),
    },
  });

  const nextRecord = await prisma.alibabaReceptionRecordItem.findUnique({ where: { id: record.id } });
  if (!nextRecord) {
    throw new Error("Impossible de relire la reception Alibaba en base.");
  }

  return mapReceptionRecordItem(nextRecord);
}

async function writeAlibabaReceptionRecordsDbBulk(records: AlibabaReceptionRecord[]): Promise<AlibabaReceptionRecord[]> {
  for (const record of records) {
    await writeAlibabaReceptionRecordDb(record);
  }

  return readAlibabaReceptionRecordsDb();
}

export async function getAlibabaImportJobs(): Promise<AlibabaImportJob[]> {
  if (hasDatabase()) {
    return readAlibabaImportJobsDb();
  }

  return readJsonFile<AlibabaImportJob[]>(IMPORT_JOBS_PATH, []);
}

export async function saveAlibabaImportJob(job: AlibabaImportJob): Promise<AlibabaImportJob> {
  if (hasDatabase()) {
    return writeAlibabaImportJobDb(job);
  }

  const jobs = await getAlibabaImportJobs();
  const next = jobs.some((entry: AlibabaImportJob) => entry.id === job.id)
    ? jobs.map((entry: AlibabaImportJob) => entry.id === job.id ? job : entry)
    : [job, ...jobs];
  await writeJsonFile(IMPORT_JOBS_PATH, next);
  return job;
}

export async function getAlibabaImportedProducts(): Promise<AlibabaImportedProduct[]> {
  if (hasDatabase()) {
    return readAlibabaImportedProductsDb();
  }

  return readJsonFile<AlibabaImportedProduct[]>(IMPORTED_PRODUCTS_PATH, []);
}

export async function saveAlibabaImportedProducts(products: AlibabaImportedProduct[]): Promise<AlibabaImportedProduct[]> {
  if (hasDatabase()) {
    return writeAlibabaImportedProductsDbBulk(products);
  }

  const existing = await getAlibabaImportedProducts();
  const nextMap = new Map(existing.map((item: AlibabaImportedProduct) => [item.id, item]));

  for (const product of products) {
    nextMap.set(product.id, product);
  }

  const next = [...nextMap.values()].sort((left: AlibabaImportedProduct, right: AlibabaImportedProduct) => right.updatedAt.localeCompare(left.updatedAt));
  await writeJsonFile(IMPORTED_PRODUCTS_PATH, next);
  return next;
}

export async function getAlibabaSupplierAccounts(): Promise<AlibabaSupplierAccount[]> {
  if (hasDatabase()) {
    return readAlibabaSupplierAccountsDb();
  }

  return readAlibabaSupplierAccountsFile();
}

export async function saveAlibabaSupplierAccount(account: AlibabaSupplierAccount): Promise<AlibabaSupplierAccount> {
  if (hasDatabase()) {
    return writeAlibabaSupplierAccountDb(account);
  }

  const accounts = await getAlibabaSupplierAccounts();
  const next = accounts.some((entry: AlibabaSupplierAccount) => entry.id === account.id)
    ? accounts.map((entry: AlibabaSupplierAccount) => entry.id === account.id ? account : entry)
    : [account, ...accounts];
  await writeAlibabaSupplierAccountsFile(next);
  return account;
}

export async function getAlibabaCountryProfiles(): Promise<AlibabaCountryProfile[]> {
  if (hasDatabase()) {
    return readAlibabaCountryProfilesDb();
  }

  return readJsonFile<AlibabaCountryProfile[]>(COUNTRY_PROFILES_PATH, DEFAULT_COUNTRY_PROFILES);
}

export async function saveAlibabaCountryProfiles(profiles: AlibabaCountryProfile[]): Promise<AlibabaCountryProfile[]> {
  if (hasDatabase()) {
    return writeAlibabaCountryProfilesDb(profiles);
  }

  await writeJsonFile(COUNTRY_PROFILES_PATH, profiles);
  return profiles;
}

export async function getAlibabaReceptionAddresses(): Promise<AlibabaReceptionAddress[]> {
  if (hasDatabase()) {
    return readAlibabaReceptionAddressesDb();
  }

  return readJsonFile<AlibabaReceptionAddress[]>(RECEPTION_ADDRESSES_PATH, []);
}

export async function saveAlibabaReceptionAddress(address: AlibabaReceptionAddress): Promise<AlibabaReceptionAddress> {
  if (hasDatabase()) {
    return writeAlibabaReceptionAddressDb(address);
  }

  const addresses = await getAlibabaReceptionAddresses();
  const normalizedAddresses = address.isDefault
    ? addresses.map((entry: AlibabaReceptionAddress) => ({ ...entry, isDefault: false }))
    : addresses;
  const next = normalizedAddresses.some((entry: AlibabaReceptionAddress) => entry.id === address.id)
    ? normalizedAddresses.map((entry: AlibabaReceptionAddress) => entry.id === address.id ? address : entry)
    : [address, ...normalizedAddresses];
  await writeJsonFile(RECEPTION_ADDRESSES_PATH, next);
  return address;
}

export async function getAlibabaPurchaseOrders(): Promise<AlibabaPurchaseOrder[]> {
  if (hasDatabase()) {
    return readAlibabaPurchaseOrdersDb();
  }

  return readJsonFile<AlibabaPurchaseOrder[]>(PURCHASE_ORDERS_PATH, []);
}

export async function saveAlibabaPurchaseOrder(order: AlibabaPurchaseOrder): Promise<AlibabaPurchaseOrder> {
  if (hasDatabase()) {
    return writeAlibabaPurchaseOrderDb(order);
  }

  const orders = await getAlibabaPurchaseOrders();
  const next = orders.some((entry: AlibabaPurchaseOrder) => entry.id === order.id)
    ? orders.map((entry: AlibabaPurchaseOrder) => entry.id === order.id ? order : entry)
    : [order, ...orders];
  await writeJsonFile(PURCHASE_ORDERS_PATH, next);
  return order;
}

export async function getAlibabaReceptionRecords(): Promise<AlibabaReceptionRecord[]> {
  if (hasDatabase()) {
    return readAlibabaReceptionRecordsDb();
  }

  return readJsonFile<AlibabaReceptionRecord[]>(RECEPTIONS_PATH, []);
}

export async function saveAlibabaReceptionRecord(record: AlibabaReceptionRecord): Promise<AlibabaReceptionRecord> {
  if (hasDatabase()) {
    return writeAlibabaReceptionRecordDb(record);
  }

  const records = await getAlibabaReceptionRecords();
  const next = records.some((entry: AlibabaReceptionRecord) => entry.id === record.id)
    ? records.map((entry: AlibabaReceptionRecord) => entry.id === record.id ? record : entry)
    : [record, ...records];
  await writeJsonFile(RECEPTIONS_PATH, next);
  return record;
}
