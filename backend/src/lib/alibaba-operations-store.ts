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
import { getOrSetCatalogRuntimeCache, invalidateCatalogRuntimeCache } from "@/lib/catalog-runtime-cache";
import { resolveProductPriceSummaryUsd } from "@/lib/product-variant-pricing";
import { resolveCoherentItemWeightGrams, sanitizeItemWeightGrams } from "@/lib/product-weight";

const DEFAULT_COUNTRY_PROFILES: AlibabaCountryProfile[] = [
  {
    countryCode: "CI",
    countryName: "Cote d'Ivoire",
    currencyCode: "XOF",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 18,
    customsMode: "business",
    clearanceCodeLabel: "RCCM / NIF",
    enabled: true,
  },
  {
    countryCode: "SN",
    countryName: "Senegal",
    currencyCode: "XOF",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 18,
    customsMode: "business",
    clearanceCodeLabel: "NINEA",
    enabled: true,
  },
  {
    countryCode: "US",
    countryName: "United States",
    currencyCode: "USD",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 0,
    customsMode: "personal",
    clearanceCodeLabel: "State / ZIP",
    enabled: true,
  },
  {
    countryCode: "CA",
    countryName: "Canada",
    currencyCode: "CAD",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 5,
    customsMode: "personal",
    clearanceCodeLabel: "Province / Postal code",
    enabled: true,
  },
  {
    countryCode: "GB",
    countryName: "United Kingdom",
    currencyCode: "GBP",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 20,
    customsMode: "personal",
    clearanceCodeLabel: "Postcode / EORI si pro",
    enabled: true,
  },
  {
    countryCode: "FR",
    countryName: "France",
    currencyCode: "EUR",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 20,
    customsMode: "personal",
    clearanceCodeLabel: "Code postal / TVA si pro",
    enabled: true,
  },
  {
    countryCode: "DE",
    countryName: "Germany",
    currencyCode: "EUR",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 19,
    customsMode: "personal",
    clearanceCodeLabel: "Postleitzahl / VAT si pro",
    enabled: true,
  },
  {
    countryCode: "BE",
    countryName: "Belgium",
    currencyCode: "EUR",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 21,
    customsMode: "personal",
    clearanceCodeLabel: "Code postal / TVA si pro",
    enabled: true,
  },
  {
    countryCode: "CH",
    countryName: "Switzerland",
    currencyCode: "USD",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 8.1,
    customsMode: "personal",
    clearanceCodeLabel: "Code postal",
    enabled: true,
  },
  {
    countryCode: "AE",
    countryName: "United Arab Emirates",
    currencyCode: "USD",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 5,
    customsMode: "personal",
    clearanceCodeLabel: "Emirate / Postal code",
    enabled: true,
  },
  {
    countryCode: "AU",
    countryName: "Australia",
    currencyCode: "USD",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 10,
    customsMode: "personal",
    clearanceCodeLabel: "State / Postcode",
    enabled: true,
  },
  {
    countryCode: "AT",
    countryName: "Austria",
    currencyCode: "EUR",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 20,
    customsMode: "personal",
    clearanceCodeLabel: "Postleitzahl",
    enabled: true,
  },
  {
    countryCode: "BR",
    countryName: "Brazil",
    currencyCode: "USD",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 17,
    customsMode: "personal",
    clearanceCodeLabel: "CPF / CEP",
    enabled: true,
  },
  {
    countryCode: "DK",
    countryName: "Denmark",
    currencyCode: "USD",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 25,
    customsMode: "personal",
    clearanceCodeLabel: "Postnummer",
    enabled: true,
  },
  {
    countryCode: "EE",
    countryName: "Estonia",
    currencyCode: "EUR",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 22,
    customsMode: "personal",
    clearanceCodeLabel: "Postal code",
    enabled: true,
  },
  {
    countryCode: "ES",
    countryName: "Spain",
    currencyCode: "EUR",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 21,
    customsMode: "personal",
    clearanceCodeLabel: "Postal code / NIF si pro",
    enabled: true,
  },
  {
    countryCode: "HU",
    countryName: "Hungary",
    currencyCode: "EUR",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 27,
    customsMode: "personal",
    clearanceCodeLabel: "Postal code",
    enabled: true,
  },
  {
    countryCode: "IE",
    countryName: "Ireland",
    currencyCode: "EUR",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 23,
    customsMode: "personal",
    clearanceCodeLabel: "Eircode",
    enabled: true,
  },
  {
    countryCode: "IL",
    countryName: "Israel",
    currencyCode: "USD",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 17,
    customsMode: "personal",
    clearanceCodeLabel: "ZIP / Teudat zehut",
    enabled: true,
  },
  {
    countryCode: "IS",
    countryName: "Iceland",
    currencyCode: "USD",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 24,
    customsMode: "personal",
    clearanceCodeLabel: "Postal code",
    enabled: true,
  },
  {
    countryCode: "IT",
    countryName: "Italy",
    currencyCode: "EUR",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 22,
    customsMode: "personal",
    clearanceCodeLabel: "CAP / VAT si pro",
    enabled: true,
  },
  {
    countryCode: "JP",
    countryName: "Japan",
    currencyCode: "USD",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 10,
    customsMode: "personal",
    clearanceCodeLabel: "Prefecture / ZIP",
    enabled: true,
  },
  {
    countryCode: "LT",
    countryName: "Lithuania",
    currencyCode: "EUR",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 21,
    customsMode: "personal",
    clearanceCodeLabel: "Postal code",
    enabled: true,
  },
  {
    countryCode: "LU",
    countryName: "Luxembourg",
    currencyCode: "EUR",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 17,
    customsMode: "personal",
    clearanceCodeLabel: "Postal code",
    enabled: true,
  },
  {
    countryCode: "LV",
    countryName: "Latvia",
    currencyCode: "EUR",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 21,
    customsMode: "personal",
    clearanceCodeLabel: "Postal code",
    enabled: true,
  },
  {
    countryCode: "MX",
    countryName: "Mexico",
    currencyCode: "USD",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 16,
    customsMode: "personal",
    clearanceCodeLabel: "State / CP / RFC ou passeport",
    enabled: true,
  },
  {
    countryCode: "NL",
    countryName: "Netherlands",
    currencyCode: "EUR",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 21,
    customsMode: "personal",
    clearanceCodeLabel: "Postcode",
    enabled: true,
  },
  {
    countryCode: "NO",
    countryName: "Norway",
    currencyCode: "USD",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 25,
    customsMode: "personal",
    clearanceCodeLabel: "Postal code",
    enabled: true,
  },
  {
    countryCode: "NZ",
    countryName: "New Zealand",
    currencyCode: "USD",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 15,
    customsMode: "personal",
    clearanceCodeLabel: "Postcode",
    enabled: true,
  },
  {
    countryCode: "PT",
    countryName: "Portugal",
    currencyCode: "EUR",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 23,
    customsMode: "personal",
    clearanceCodeLabel: "Codigo postal",
    enabled: true,
  },
  {
    countryCode: "SE",
    countryName: "Sweden",
    currencyCode: "USD",
    defaultCarrierCode: "CAINIAO_STANDARD",
    importTaxRate: 25,
    customsMode: "personal",
    clearanceCodeLabel: "Postal code",
    enabled: true,
  },
];

const ROOT_DIR = process.env.VERCEL
  ? path.join("/tmp", "alibuy", "data", "sourcing")
  : path.join(process.cwd(), "data", "sourcing");
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

async function syncImportedProductsJsonSnapshot(products: AlibabaImportedProduct[]) {
  try {
    const existing = await readJsonFile<AlibabaImportedProduct[]>(IMPORTED_PRODUCTS_PATH, []);
    const existingLatestUpdatedAt = existing[0]?.updatedAt ?? "";
    const nextLatestUpdatedAt = products[0]?.updatedAt ?? "";

    if (existing.length === products.length && existingLatestUpdatedAt === nextLatestUpdatedAt) {
      return;
    }

    await writeJsonFile(IMPORTED_PRODUCTS_PATH, products);
  } catch (error) {
    console.warn("[alibaba-operations-store] unable to sync imported products JSON snapshot", error);
  }
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

let databaseFallbackForced = false;

function canUseDatabase() {
  return hasDatabase() && !databaseFallbackForced;
}

function isPrismaDatabaseUnavailable(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown; name?: unknown };
  const message = typeof candidate.message === "string" ? candidate.message : "";
  return candidate.code === "P1001"
    || candidate.code === "P2022"
    || message.includes("Can't reach database server")
    || message.includes("db.prisma.io:5432")
    || message.includes("does not exist in the current database");
}

function enableDatabaseFallback(error: unknown) {
  if (databaseFallbackForced) {
    return;
  }

  databaseFallbackForced = true;

  const prismaCode = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
  const errorMessage = error instanceof Error ? error.message : undefined;
  const fallbackCandidate = error as { code?: unknown; message?: unknown } | null;
  const code = prismaCode ?? (typeof fallbackCandidate?.code === "string" ? fallbackCandidate.code : "unknown");
  const messageSource = errorMessage ?? (typeof fallbackCandidate?.message === "string" ? fallbackCandidate.message : "");
  const message = messageSource.split("\n").find((line) => line.trim().length > 0) ?? "Database access failed.";

  console.warn(`[alibaba-operations-store] falling back to JSON storage (${code}: ${message})`);
}

function invalidateImportedProductsSnapshot() {
  // Historical no-op: callers still invoke this after writes so admin edits remain explicit.
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

function normalizeAlibabaMediaUrl(value?: string) {
  if (!value) {
    return undefined;
  }

  const normalized = value.startsWith("//") ? `https:${value}` : value;
  return normalized.replace(/(\.(?:jpg|jpeg|png|webp))_\d+x\d+\1$/i, "$1");
}

function extractPriceValues(candidate: unknown): number[] {
  if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
    return [candidate];
  }

  if (typeof candidate !== "string") {
    return [];
  }

  const matches = candidate.match(/\d+(?:[.,]\d+)?/g) ?? [];
  return matches
    .map((value) => Number(value.replace(',', '.')))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function extractRawPriceBounds(rawPayload: Prisma.JsonValue | null) {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
    return {} as { minUsd?: number; maxUsd?: number };
  }

  const record = rawPayload as Record<string, unknown>;
  const candidates = [
    record.price,
    record.min_price,
    record.minPrice,
    record.max_price,
    record.maxPrice,
    (record.priceRange as { min?: unknown; max?: unknown } | undefined)?.min,
    (record.priceRange as { min?: unknown; max?: unknown } | undefined)?.max,
    (record.price_range as { min?: unknown; max?: unknown } | undefined)?.min,
    (record.price_range as { min?: unknown; max?: unknown } | undefined)?.max,
  ];
  const values = candidates.flatMap((candidate) => extractPriceValues(candidate));

  if (values.length === 0) {
    return {} as { minUsd?: number; maxUsd?: number };
  }

  return {
    minUsd: Math.min(...values),
    maxUsd: values.length > 1 ? Math.max(...values) : undefined,
  };
}

function collectRawMediaUrls(value: unknown, depth = 0): string[] {
  if (depth > 5 || value == null) {
    return [];
  }

  if (typeof value === "string") {
    return value.startsWith("http") || value.startsWith("//") || value.startsWith("/") ? [value] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectRawMediaUrls(entry, depth + 1));
  }

  if (typeof value !== "object") {
    return [];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, nestedValue]) => {
    if (/(image|img|photo|picture|gallery|poster|main_image|multi_image)/i.test(key)) {
      return collectRawMediaUrls(nestedValue, depth + 1);
    }

    return depth < 2 ? collectRawMediaUrls(nestedValue, depth + 1) : [];
  });
}

function extractRawMediaGallery(rawPayload: Prisma.JsonValue | null) {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
    return [] as string[];
  }

  return [...new Set(
    collectRawMediaUrls(rawPayload)
      .map((entry) => normalizeAlibabaMediaUrl(entry) ?? entry)
      .filter((entry): entry is string => Boolean(entry)),
  )];
}

function parseWeightCandidate(value: unknown, keyHint?: string): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    if (/gram|grams|weight_grams|weightgrams/i.test(keyHint ?? "")) {
      return sanitizeItemWeightGrams(Math.round(value));
    }

    if (/kg|kilogram|weight/i.test(keyHint ?? "")) {
      return sanitizeItemWeightGrams(Math.round(value < 10 ? value * 1000 : value));
    }
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
    return sanitizeItemWeightGrams(Math.round(Number(kilogramMatch[1].replace(',', '.')) * 1000));
  }

  const gramMatch = /weight|gross_weight|net_weight|package_weight|shipping_weight|item_weight|product_weight|poids/i.test(keyHint ?? "")
    ? normalized.match(/(\d+(?:[.,]\d+)?)\s*(g|gram)s?\b/i)
    : normalized.match(/(?:weight|poids|gross|net|shipping|package|item|product)[^\d]{0,12}(\d+(?:[.,]\d+)?)\s*(g|gram)s?\b/i);
  if (gramMatch && !/2\.4g|5g|4g/i.test(normalized)) {
    return sanitizeItemWeightGrams(Math.round(Number(gramMatch[1].replace(',', '.'))));
  }

  if (/weight|gross_weight|net_weight|package_weight|shipping_weight|item_weight/i.test(keyHint ?? "")) {
    const numeric = Number(normalized.replace(/[^0-9.,-]/g, '').replace(',', '.'));
    if (Number.isFinite(numeric) && numeric > 0) {
      return sanitizeItemWeightGrams(Math.round(numeric < 10 ? numeric * 1000 : numeric));
    }
  }

  return undefined;
}

function extractRawWeightGrams(value: unknown, depth = 0, keyHint?: string): number | undefined {
  if (depth > 5 || value == null) {
    return undefined;
  }

  const direct = parseWeightCandidate(value, keyHint);
  if (typeof direct === "number" && direct > 0) {
    return direct;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = extractRawWeightGrams(entry, depth + 1, keyHint);
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
    const nested = extractRawWeightGrams(nestedValue, depth + 1, nestedKey);
    if (typeof nested === "number" && nested > 0) {
      return nested;
    }
  }

  return undefined;
}

function toSafeInt(value: number, fallback = 0) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  const normalized = Math.round(value);
  return Math.min(2147483647, Math.max(-2147483648, normalized));
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
  const rawMediaGallery = extractRawMediaGallery(record.rawPayload ?? null);
  const normalizedImage = normalizeAlibabaMediaUrl(record.image) ?? record.image ?? rawMediaGallery[0];
  const normalizedGallery = toStringArray(record.gallery).map((image) => normalizeAlibabaMediaUrl(image) ?? image);
  const effectiveGallery = normalizedGallery.length > 0 ? normalizedGallery : rawMediaGallery;
  const rawPriceBounds = extractRawPriceBounds(record.rawPayload ?? null);
  const rawWeightGrams = extractRawWeightGrams(record.rawPayload);
  const storedWeightGrams = sanitizeItemWeightGrams(record.itemWeightGrams > 0 ? record.itemWeightGrams : undefined);
  const storedTiers = toUnknownArray<{ quantityLabel: string; priceUsd: number; note?: string }>(record.tiers);
  const normalizedWeightGrams = resolveCoherentItemWeightGrams(storedWeightGrams ?? rawWeightGrams, {
    title: record.title,
    shortTitle: record.shortTitle,
    query: record.query,
    keywords: toStringArray(record.keywords),
    categorySlug: record.categorySlug ?? undefined,
    categoryTitle: record.categoryTitle ?? undefined,
    categoryPath: toStringArray(record.categoryPath ?? undefined),
    lotCbm: record.lotCbm,
    moq: record.moq,
  });
  const normalizedPriceSummary = resolveProductPriceSummaryUsd({
    tiers: storedTiers,
    minUsd: rawPriceBounds.minUsd ?? record.minUsd,
    maxUsd: rawPriceBounds.maxUsd ?? record.maxUsd ?? undefined,
    moq: record.moq,
  }, {
    quantity: Math.max(1, record.moq),
  });

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
    image: normalizedImage,
    gallery: effectiveGallery.length > 0 ? effectiveGallery : (normalizedImage ? [normalizedImage] : []),
    videoUrl: normalizeAlibabaMediaUrl(record.videoUrl ?? undefined) ?? undefined,
    videoPoster: normalizeAlibabaMediaUrl(record.videoPoster ?? undefined) ?? undefined,
    packaging: record.packaging,
    itemWeightGrams: normalizedWeightGrams ?? 0,
    lotCbm: record.lotCbm,
    minUsd: normalizedPriceSummary.minUsd,
    maxUsd: normalizedPriceSummary.maxUsd,
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
    tiers: storedTiers,
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

  const seenSourceIds = new Set<string>();
  const dedupedRecords: typeof records = [];
  const duplicateIds: string[] = [];

  for (const record of records) {
    const dedupeKey = record.sourceProductId || record.slug || record.id;
    if (seenSourceIds.has(dedupeKey)) {
      duplicateIds.push(record.id);
      continue;
    }

    seenSourceIds.add(dedupeKey);
    dedupedRecords.push(record);
  }

  if (duplicateIds.length > 0) {
    await prisma.alibabaImportedProductRecord.deleteMany({ where: { id: { in: duplicateIds } } });
  }

  const mappedProducts = dedupedRecords.map(mapImportedProductRecord);
  await syncImportedProductsJsonSnapshot(mappedProducts);
  return mappedProducts;
}

async function writeAlibabaImportedProductDb(product: AlibabaImportedProduct): Promise<AlibabaImportedProduct> {
  const existing = await prisma.alibabaImportedProductRecord.findFirst({
    where: {
      OR: [
        { id: product.id },
        { sourceProductId: product.sourceProductId },
        { slug: product.slug },
      ],
    },
    orderBy: { updatedAt: "desc" },
  });
  const recordId = existing?.id ?? product.id;
  const itemWeightGrams = toSafeInt(product.itemWeightGrams);
  const moq = Math.max(1, toSafeInt(product.moq, 1));
  const yearsInBusiness = Math.max(0, toSafeInt(product.yearsInBusiness, 0));
  const inventory = Math.max(0, toSafeInt(product.inventory, 0));

  await prisma.alibabaImportedProductRecord.upsert({
    where: { id: recordId },
    create: {
      id: recordId,
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
      itemWeightGrams,
      lotCbm: product.lotCbm,
      minUsd: product.minUsd,
      maxUsd: product.maxUsd,
      moq,
      unit: product.unit,
      badge: product.badge,
      supplierName: product.supplierName,
      supplierLocation: product.supplierLocation,
      supplierCompanyId: product.supplierCompanyId,
      responseTime: product.responseTime,
      yearsInBusiness,
      transactionsLabel: product.transactionsLabel,
      soldLabel: product.soldLabel,
      customizationLabel: product.customizationLabel,
      shippingLabel: product.shippingLabel,
      overview: toPrismaJson(product.overview) ?? [],
      variantGroups: toPrismaJson(product.variantGroups) ?? [],
      tiers: toPrismaJson(product.tiers) ?? [],
      specs: toPrismaJson(product.specs) ?? [],
      inventory,
      status: product.status,
      publishedToSite: product.publishedToSite,
      publishedAt: toDate(product.publishedAt),
      rawPayload: toNullablePrismaJson(product.rawPayload),
      createdAt: toDate(existing?.createdAt?.toISOString()) ?? toDate(product.createdAt) ?? new Date(),
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
      itemWeightGrams,
      lotCbm: product.lotCbm,
      minUsd: product.minUsd,
      maxUsd: product.maxUsd,
      moq,
      unit: product.unit,
      badge: product.badge,
      supplierName: product.supplierName,
      supplierLocation: product.supplierLocation,
      supplierCompanyId: product.supplierCompanyId,
      responseTime: product.responseTime,
      yearsInBusiness,
      transactionsLabel: product.transactionsLabel,
      soldLabel: product.soldLabel,
      customizationLabel: product.customizationLabel,
      shippingLabel: product.shippingLabel,
      overview: toPrismaJson(product.overview) ?? [],
      variantGroups: toPrismaJson(product.variantGroups) ?? [],
      tiers: toPrismaJson(product.tiers) ?? [],
      specs: toPrismaJson(product.specs) ?? [],
      inventory,
      status: product.status,
      publishedToSite: product.publishedToSite,
      publishedAt: toDate(product.publishedAt),
      rawPayload: toNullablePrismaJson(product.rawPayload),
      updatedAt: toDate(product.updatedAt) ?? new Date(),
    },
  });

  if (product.sourceProductId) {
    await prisma.alibabaImportedProductRecord.deleteMany({
      where: {
        sourceProductId: product.sourceProductId,
        id: { not: recordId },
      },
    });
  }

  const record = await prisma.alibabaImportedProductRecord.findUnique({ where: { id: recordId } });
  if (!record) {
    throw new Error("Impossible de relire le produit importe Alibaba en base.");
  }

  return mapImportedProductRecord(record);
}

async function writeAlibabaImportedProductsDbBulk(products: AlibabaImportedProduct[]): Promise<AlibabaImportedProduct[]> {
  const dedupedProducts = new Map<string, AlibabaImportedProduct>();
  for (const product of products) {
    dedupedProducts.set(product.sourceProductId || product.slug || product.id, product);
  }

  for (const product of dedupedProducts.values()) {
    await writeAlibabaImportedProductDb(product);
  }

  const nextProducts = await readAlibabaImportedProductsDb();
  await syncImportedProductsJsonSnapshot(nextProducts);
  return nextProducts;
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
  if (canUseDatabase()) {
    try {
      return await readAlibabaImportJobsDb();
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  return readJsonFile<AlibabaImportJob[]>(IMPORT_JOBS_PATH, []);
}

export async function saveAlibabaImportJob(job: AlibabaImportJob): Promise<AlibabaImportJob> {
  if (canUseDatabase()) {
    try {
      return await writeAlibabaImportJobDb(job);
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  const jobs = await getAlibabaImportJobs();
  const next = jobs.some((entry: AlibabaImportJob) => entry.id === job.id)
    ? jobs.map((entry: AlibabaImportJob) => entry.id === job.id ? job : entry)
    : [job, ...jobs];
  await writeJsonFile(IMPORT_JOBS_PATH, next);
  return job;
}

async function readAlibabaImportedProductsSource(): Promise<AlibabaImportedProduct[]> {
  if (canUseDatabase()) {
    try {
      return await readAlibabaImportedProductsDb();
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  return readJsonFile<AlibabaImportedProduct[]>(IMPORTED_PRODUCTS_PATH, []);
}

export async function getAlibabaImportedProducts(): Promise<AlibabaImportedProduct[]> {
  return getOrSetCatalogRuntimeCache("alibaba-imported-products", 30_000, readAlibabaImportedProductsSource);
}

export async function saveAlibabaImportedProducts(products: AlibabaImportedProduct[]): Promise<AlibabaImportedProduct[]> {
  if (canUseDatabase()) {
    try {
      const next = await writeAlibabaImportedProductsDbBulk(products);
      invalidateCatalogRuntimeCache();
      invalidateImportedProductsSnapshot();
      return next;
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  const existing = await readAlibabaImportedProductsSource();
  const nextMap = new Map(existing.map((item: AlibabaImportedProduct) => [item.sourceProductId || item.id, item]));

  for (const product of products) {
    nextMap.set(product.sourceProductId || product.id, product);
  }

  const next = [...nextMap.values()].sort((left: AlibabaImportedProduct, right: AlibabaImportedProduct) => right.updatedAt.localeCompare(left.updatedAt));
  await writeJsonFile(IMPORTED_PRODUCTS_PATH, next);
  invalidateCatalogRuntimeCache();
  invalidateImportedProductsSnapshot();
  return next;
}

export async function deleteAlibabaImportedProduct(importedProductId: string): Promise<void> {
  if (canUseDatabase()) {
    try {
      await prisma.alibabaImportedProductRecord.deleteMany({ where: { id: importedProductId } });
      invalidateCatalogRuntimeCache();
      invalidateImportedProductsSnapshot();
      return;
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  const products = await readAlibabaImportedProductsSource();
  const next = products.filter((product: AlibabaImportedProduct) => product.id !== importedProductId);
  await writeJsonFile(IMPORTED_PRODUCTS_PATH, next);
  invalidateCatalogRuntimeCache();
  invalidateImportedProductsSnapshot();
}

export async function getAlibabaSupplierAccounts(): Promise<AlibabaSupplierAccount[]> {
  if (canUseDatabase()) {
    try {
      return await readAlibabaSupplierAccountsDb();
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  return readAlibabaSupplierAccountsFile();
}

export async function saveAlibabaSupplierAccount(account: AlibabaSupplierAccount): Promise<AlibabaSupplierAccount> {
  if (canUseDatabase()) {
    try {
      return await writeAlibabaSupplierAccountDb(account);
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  const accounts = await getAlibabaSupplierAccounts();
  const next = accounts.some((entry: AlibabaSupplierAccount) => entry.id === account.id)
    ? accounts.map((entry: AlibabaSupplierAccount) => entry.id === account.id ? account : entry)
    : [account, ...accounts];
  await writeAlibabaSupplierAccountsFile(next);
  return account;
}

export async function getAlibabaCountryProfiles(): Promise<AlibabaCountryProfile[]> {
  if (canUseDatabase()) {
    try {
      return await readAlibabaCountryProfilesDb();
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  return readJsonFile<AlibabaCountryProfile[]>(COUNTRY_PROFILES_PATH, DEFAULT_COUNTRY_PROFILES);
}

export async function saveAlibabaCountryProfiles(profiles: AlibabaCountryProfile[]): Promise<AlibabaCountryProfile[]> {
  if (canUseDatabase()) {
    try {
      return await writeAlibabaCountryProfilesDb(profiles);
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  await writeJsonFile(COUNTRY_PROFILES_PATH, profiles);
  return profiles;
}

export async function getAlibabaReceptionAddresses(): Promise<AlibabaReceptionAddress[]> {
  return getOrSetCatalogRuntimeCache("alibaba-reception-addresses", 30_000, async () => {
    if (canUseDatabase()) {
      try {
        return await readAlibabaReceptionAddressesDb();
      } catch (error) {
        if (!isPrismaDatabaseUnavailable(error)) {
          throw error;
        }

        enableDatabaseFallback(error);
      }
    }

    return readJsonFile<AlibabaReceptionAddress[]>(RECEPTION_ADDRESSES_PATH, []);
  });
}

export async function saveAlibabaReceptionAddress(address: AlibabaReceptionAddress): Promise<AlibabaReceptionAddress> {
  if (canUseDatabase()) {
    try {
      const saved = await writeAlibabaReceptionAddressDb(address);
      invalidateCatalogRuntimeCache();
      return saved;
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  const addresses = await getAlibabaReceptionAddresses();
  const normalizedAddresses = address.isDefault
    ? addresses.map((entry: AlibabaReceptionAddress) => ({ ...entry, isDefault: false }))
    : addresses;
  const next = normalizedAddresses.some((entry: AlibabaReceptionAddress) => entry.id === address.id)
    ? normalizedAddresses.map((entry: AlibabaReceptionAddress) => entry.id === address.id ? address : entry)
    : [address, ...normalizedAddresses];
  await writeJsonFile(RECEPTION_ADDRESSES_PATH, next);
  invalidateCatalogRuntimeCache();
  return address;
}

export async function getAlibabaPurchaseOrders(): Promise<AlibabaPurchaseOrder[]> {
  if (canUseDatabase()) {
    try {
      return await readAlibabaPurchaseOrdersDb();
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  return readJsonFile<AlibabaPurchaseOrder[]>(PURCHASE_ORDERS_PATH, []);
}

export async function saveAlibabaPurchaseOrder(order: AlibabaPurchaseOrder): Promise<AlibabaPurchaseOrder> {
  if (canUseDatabase()) {
    try {
      return await writeAlibabaPurchaseOrderDb(order);
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  const orders = await getAlibabaPurchaseOrders();
  const next = orders.some((entry: AlibabaPurchaseOrder) => entry.id === order.id)
    ? orders.map((entry: AlibabaPurchaseOrder) => entry.id === order.id ? order : entry)
    : [order, ...orders];
  await writeJsonFile(PURCHASE_ORDERS_PATH, next);
  return order;
}

export async function getAlibabaReceptionRecords(): Promise<AlibabaReceptionRecord[]> {
  if (canUseDatabase()) {
    try {
      return await readAlibabaReceptionRecordsDb();
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  return readJsonFile<AlibabaReceptionRecord[]>(RECEPTIONS_PATH, []);
}

export async function saveAlibabaReceptionRecord(record: AlibabaReceptionRecord): Promise<AlibabaReceptionRecord> {
  if (canUseDatabase()) {
    try {
      return await writeAlibabaReceptionRecordDb(record);
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  const records = await getAlibabaReceptionRecords();
  const next = records.some((entry: AlibabaReceptionRecord) => entry.id === record.id)
    ? records.map((entry: AlibabaReceptionRecord) => entry.id === record.id ? record : entry)
    : [record, ...records];
  await writeJsonFile(RECEPTIONS_PATH, next);
  return record;
}
