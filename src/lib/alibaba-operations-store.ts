import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  AlibabaCountryProfile,
  AlibabaImportJob,
  AlibabaImportedProduct,
  AlibabaPurchaseOrder,
  AlibabaReceptionAddress,
  AlibabaReceptionRecord,
  AlibabaSupplierAccount,
} from "@/lib/alibaba-operations";

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

async function writeAlibabaSupplierAccountsFile(accounts: AlibabaSupplierAccount[]) {
  const next = accounts.map((account) => ({
    ...account,
    appSecret: account.appSecret ? encryptSensitiveValue(account.appSecret) : undefined,
    accessToken: account.accessToken ? encryptSensitiveValue(account.accessToken) : undefined,
    refreshToken: account.refreshToken ? encryptSensitiveValue(account.refreshToken) : undefined,
  }));
  await writeJsonFile(SUPPLIER_ACCOUNTS_PATH, next);
}

export async function getAlibabaImportJobs() {
  return readJsonFile<AlibabaImportJob[]>(IMPORT_JOBS_PATH, []);
}

export async function saveAlibabaImportJob(job: AlibabaImportJob) {
  const jobs = await getAlibabaImportJobs();
  const next = jobs.some((entry) => entry.id === job.id)
    ? jobs.map((entry) => entry.id === job.id ? job : entry)
    : [job, ...jobs];
  await writeJsonFile(IMPORT_JOBS_PATH, next);
  return job;
}

export async function getAlibabaImportedProducts() {
  return readJsonFile<AlibabaImportedProduct[]>(IMPORTED_PRODUCTS_PATH, []);
}

export async function saveAlibabaImportedProducts(products: AlibabaImportedProduct[]) {
  const existing = await getAlibabaImportedProducts();
  const nextMap = new Map(existing.map((item) => [item.id, item]));

  for (const product of products) {
    nextMap.set(product.id, product);
  }

  const next = [...nextMap.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  await writeJsonFile(IMPORTED_PRODUCTS_PATH, next);
  return next;
}

export async function getAlibabaSupplierAccounts() {
  return readAlibabaSupplierAccountsFile();
}

export async function saveAlibabaSupplierAccount(account: AlibabaSupplierAccount) {
  const accounts = await getAlibabaSupplierAccounts();
  const next = accounts.some((entry) => entry.id === account.id)
    ? accounts.map((entry) => entry.id === account.id ? account : entry)
    : [account, ...accounts];
  await writeAlibabaSupplierAccountsFile(next);
  return account;
}

export async function getAlibabaCountryProfiles() {
  return readJsonFile<AlibabaCountryProfile[]>(COUNTRY_PROFILES_PATH, [
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
  ]);
}

export async function saveAlibabaCountryProfiles(profiles: AlibabaCountryProfile[]) {
  await writeJsonFile(COUNTRY_PROFILES_PATH, profiles);
  return profiles;
}

export async function getAlibabaReceptionAddresses() {
  return readJsonFile<AlibabaReceptionAddress[]>(RECEPTION_ADDRESSES_PATH, []);
}

export async function saveAlibabaReceptionAddress(address: AlibabaReceptionAddress) {
  const addresses = await getAlibabaReceptionAddresses();
  const normalizedAddresses = address.isDefault
    ? addresses.map((entry) => ({ ...entry, isDefault: false }))
    : addresses;
  const next = normalizedAddresses.some((entry) => entry.id === address.id)
    ? normalizedAddresses.map((entry) => entry.id === address.id ? address : entry)
    : [address, ...normalizedAddresses];
  await writeJsonFile(RECEPTION_ADDRESSES_PATH, next);
  return address;
}

export async function getAlibabaPurchaseOrders() {
  return readJsonFile<AlibabaPurchaseOrder[]>(PURCHASE_ORDERS_PATH, []);
}

export async function saveAlibabaPurchaseOrder(order: AlibabaPurchaseOrder) {
  const orders = await getAlibabaPurchaseOrders();
  const next = orders.some((entry) => entry.id === order.id)
    ? orders.map((entry) => entry.id === order.id ? order : entry)
    : [order, ...orders];
  await writeJsonFile(PURCHASE_ORDERS_PATH, next);
  return order;
}

export async function getAlibabaReceptionRecords() {
  return readJsonFile<AlibabaReceptionRecord[]>(RECEPTIONS_PATH, []);
}

export async function saveAlibabaReceptionRecord(record: AlibabaReceptionRecord) {
  const records = await getAlibabaReceptionRecords();
  const next = records.some((entry) => entry.id === record.id)
    ? records.map((entry) => entry.id === record.id ? record : entry)
    : [record, ...records];
  await writeJsonFile(RECEPTIONS_PATH, next);
  return record;
}
