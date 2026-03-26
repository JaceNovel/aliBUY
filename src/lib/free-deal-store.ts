import "server-only";

import { randomBytes, createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { Prisma } from "@prisma/client";

import type { SourcingOrder } from "@/lib/alibaba-sourcing";
import { getSourcingOrderMeta } from "@/lib/alibaba-sourcing";
import { getCatalogProductsBySlugs } from "@/lib/catalog-service";
import { convertEurToFcfa } from "@/lib/free-deal";
import { FREE_DEAL_ROUTE, FREE_DEAL_SHARE_ROUTE_PREFIX } from "@/lib/free-deal-constants";
import type { ProductCatalogItem } from "@/lib/products-data";
import { prisma } from "@/lib/prisma";

export type FreeDealConfig = {
  id: string;
  enabled: boolean;
  pageTitle: string;
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  bannerText: string;
  ctaLabel: string;
  shareTitle: string;
  shareDescription: string;
  itemLimit: number;
  fixedPriceEur: number;
  referralGoal: number;
  dealTagText: string;
  productBadgeText: string;
  compareAtMultiplier: number;
  compareAtExtraEur: number;
  productSlugs: string[];
  updatedAt: string;
  createdAt: string;
};

export type FreeDealClaimStatus = "paid_locked" | "referral_unlocked";

export type FreeDealClaim = {
  id: string;
  status: FreeDealClaimStatus;
  userId?: string;
  customerEmail?: string;
  customerName?: string;
  orderId?: string;
  referralCode: string;
  deviceIdHash: string;
  ipHash?: string;
  userAgentHash?: string;
  referralGoal: number;
  referralVisitCount: number;
  itemLimit: number;
  fixedPriceEur: number;
  fixedPriceFcfa: number;
  selectedProductSlugs: string[];
  paidAt?: string;
  unlockedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type FreeDealReferralVisit = {
  id: string;
  claimId: string;
  referralCode: string;
  visitorKeyHash: string;
  visitorDeviceHash: string;
  visitorIpHash?: string;
  visitorUserAgentHash?: string;
  counted: boolean;
  createdAt: string;
};

export type FreeDealVisitorIdentity = {
  deviceId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  userId?: string | null;
  customerEmail?: string | null;
};

export type ResolvedFreeDealIdentity = {
  deviceIdHash: string;
  ipHash?: string;
  userAgentHash?: string;
  userId?: string;
  customerEmail?: string;
};

export type FreeDealAccessState = {
  status: "eligible" | "blocked" | "unlocked" | "disabled";
  claim: FreeDealClaim | null;
  referralVisitCount: number;
  referralGoal: number;
  sharePath: string | null;
};

function resolveSiteDir() {
  const isServerlessRuntime = Boolean(
    process.env.VERCEL
    || process.env.VERCEL_ENV
    || process.env.VERCEL_URL
    || process.env.AWS_EXECUTION_ENV
    || process.env.AWS_LAMBDA_FUNCTION_NAME,
  );

  if (process.env.NODE_ENV === "production" || isServerlessRuntime) {
    return path.join(os.tmpdir(), "afripay", "data", "site");
  }

  return path.join(process.cwd(), "data", "site");
}

const SITE_DIR = resolveSiteDir();
const CONFIG_PATH = path.join(SITE_DIR, "free-deal-config.json");
const CLAIMS_PATH = path.join(SITE_DIR, "free-deal-claims.json");
const VISITS_PATH = path.join(SITE_DIR, "free-deal-referral-visits.json");
const DEFAULT_CONFIG_ID = "free-deal-default";

const DEFAULT_FREE_DEAL_CONFIG: FreeDealConfig = {
  id: DEFAULT_CONFIG_ID,
  enabled: true,
  pageTitle: "Produits gratuits",
  heroBadge: "OFFRE ACQUISITION",
  heroTitle: "Choisissez 7 articles et payez seulement 10 EUR",
  heroSubtitle: "Selectionnez librement vos 7 articles parmi la campagne, profitez d'un prix affiche a 0 sur chaque carte puis reglez un forfait unique de 10 EUR pour valider le lot.",
  bannerText: "Article gratuit des 10 euro",
  ctaLabel: "Payer mes 7 articles",
  shareTitle: "Acces bloque sur cet appareil apres achat",
  shareDescription: "Partagez votre lien a 20 personnes. Chaque visite unique qui ouvre vraiment la page produits gratuits compte pour debloquer un nouvel acces sur cet appareil.",
  itemLimit: 7,
  fixedPriceEur: 10,
  referralGoal: 20,
  dealTagText: "-60%",
  productBadgeText: "Free",
  compareAtMultiplier: 1.55,
  compareAtExtraEur: 1.25,
  productSlugs: [],
  updatedAt: new Date("2026-03-25T00:00:00.000Z").toISOString(),
  createdAt: new Date("2026-03-25T00:00:00.000Z").toISOString(),
};

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

  const candidate = error as { code?: unknown; message?: unknown };
  const message = typeof candidate.message === "string" ? candidate.message : "";
  return candidate.code === "P1001"
    || message.includes("Can't reach database server")
    || message.includes("db.prisma.io:5432");
}

function enableDatabaseFallback(error: unknown) {
  if (!databaseFallbackForced) {
    databaseFallbackForced = true;
    console.warn("[free-deal-store] database unavailable, falling back to JSON storage", error);
  }
}

async function ensureSiteDir() {
  await mkdir(SITE_DIR, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    await ensureSiteDir();
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    try {
      await writeJsonFile(filePath, fallback);
    } catch {
      return fallback;
    }

    return fallback;
  }
}

async function writeJsonFile<T>(filePath: string, value: T) {
  await ensureSiteDir();
  try {
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  } catch {
    // On serverless platforms this storage can be ephemeral or unavailable.
  }
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toNonEmptyString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function toIsoString(value: unknown, fallback?: string) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? (fallback ?? new Date().toISOString()) : date.toISOString();
  }

  return fallback ?? new Date().toISOString();
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

function normalizeEmail(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : undefined;
}

function normalizeConfigRecord(record: Record<string, unknown>): FreeDealConfig {
  return {
    id: toNonEmptyString(record.id, DEFAULT_FREE_DEAL_CONFIG.id),
    enabled: toBoolean(record.enabled, DEFAULT_FREE_DEAL_CONFIG.enabled),
    pageTitle: toNonEmptyString(record.pageTitle, DEFAULT_FREE_DEAL_CONFIG.pageTitle),
    heroBadge: toNonEmptyString(record.heroBadge, DEFAULT_FREE_DEAL_CONFIG.heroBadge),
    heroTitle: toNonEmptyString(record.heroTitle, DEFAULT_FREE_DEAL_CONFIG.heroTitle),
    heroSubtitle: toNonEmptyString(record.heroSubtitle, DEFAULT_FREE_DEAL_CONFIG.heroSubtitle),
    bannerText: toNonEmptyString(record.bannerText, DEFAULT_FREE_DEAL_CONFIG.bannerText),
    ctaLabel: toNonEmptyString(record.ctaLabel, DEFAULT_FREE_DEAL_CONFIG.ctaLabel),
    shareTitle: toNonEmptyString(record.shareTitle, DEFAULT_FREE_DEAL_CONFIG.shareTitle),
    shareDescription: toNonEmptyString(record.shareDescription, DEFAULT_FREE_DEAL_CONFIG.shareDescription),
    itemLimit: Math.max(1, Math.min(25, Math.round(toNumber(record.itemLimit, DEFAULT_FREE_DEAL_CONFIG.itemLimit)))),
    fixedPriceEur: Number(Math.max(0.5, toNumber(record.fixedPriceEur, DEFAULT_FREE_DEAL_CONFIG.fixedPriceEur)).toFixed(2)),
    referralGoal: Math.max(1, Math.min(500, Math.round(toNumber(record.referralGoal, DEFAULT_FREE_DEAL_CONFIG.referralGoal)))),
    dealTagText: toNonEmptyString(record.dealTagText, DEFAULT_FREE_DEAL_CONFIG.dealTagText),
    productBadgeText: toNonEmptyString(record.productBadgeText, DEFAULT_FREE_DEAL_CONFIG.productBadgeText),
    compareAtMultiplier: Number(Math.max(1, toNumber(record.compareAtMultiplier, DEFAULT_FREE_DEAL_CONFIG.compareAtMultiplier)).toFixed(2)),
    compareAtExtraEur: Number(Math.max(0, toNumber(record.compareAtExtraEur, DEFAULT_FREE_DEAL_CONFIG.compareAtExtraEur)).toFixed(2)),
    productSlugs: toStringArray(record.productSlugs),
    updatedAt: toIsoString(record.updatedAt, DEFAULT_FREE_DEAL_CONFIG.updatedAt),
    createdAt: toIsoString(record.createdAt, DEFAULT_FREE_DEAL_CONFIG.createdAt),
  };
}

function normalizeClaimRecord(record: Record<string, unknown>): FreeDealClaim {
  return {
    id: toNonEmptyString(record.id),
    status: record.status === "referral_unlocked" ? "referral_unlocked" : "paid_locked",
    userId: toNonEmptyString(record.userId) || undefined,
    customerEmail: normalizeEmail(typeof record.customerEmail === "string" ? record.customerEmail : undefined),
    customerName: toNonEmptyString(record.customerName) || undefined,
    orderId: toNonEmptyString(record.orderId) || undefined,
    referralCode: toNonEmptyString(record.referralCode),
    deviceIdHash: toNonEmptyString(record.deviceIdHash),
    ipHash: toNonEmptyString(record.ipHash) || undefined,
    userAgentHash: toNonEmptyString(record.userAgentHash) || undefined,
    referralGoal: Math.max(1, Math.round(toNumber(record.referralGoal, DEFAULT_FREE_DEAL_CONFIG.referralGoal))),
    referralVisitCount: Math.max(0, Math.round(toNumber(record.referralVisitCount, 0))),
    itemLimit: Math.max(1, Math.round(toNumber(record.itemLimit, DEFAULT_FREE_DEAL_CONFIG.itemLimit))),
    fixedPriceEur: Number(Math.max(0.5, toNumber(record.fixedPriceEur, DEFAULT_FREE_DEAL_CONFIG.fixedPriceEur)).toFixed(2)),
    fixedPriceFcfa: Math.max(0, Math.round(toNumber(record.fixedPriceFcfa, convertEurToFcfa(DEFAULT_FREE_DEAL_CONFIG.fixedPriceEur)))),
    selectedProductSlugs: toStringArray(record.selectedProductSlugs),
    paidAt: record.paidAt ? toIsoString(record.paidAt) : undefined,
    unlockedAt: record.unlockedAt ? toIsoString(record.unlockedAt) : undefined,
    createdAt: toIsoString(record.createdAt),
    updatedAt: toIsoString(record.updatedAt),
  };
}

function normalizeReferralVisitRecord(record: Record<string, unknown>): FreeDealReferralVisit {
  return {
    id: toNonEmptyString(record.id),
    claimId: toNonEmptyString(record.claimId),
    referralCode: toNonEmptyString(record.referralCode),
    visitorKeyHash: toNonEmptyString(record.visitorKeyHash),
    visitorDeviceHash: toNonEmptyString(record.visitorDeviceHash),
    visitorIpHash: toNonEmptyString(record.visitorIpHash) || undefined,
    visitorUserAgentHash: toNonEmptyString(record.visitorUserAgentHash) || undefined,
    counted: toBoolean(record.counted, true),
    createdAt: toIsoString(record.createdAt),
  };
}

function hashValue(prefix: string, value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }

  return createHash("sha256").update(`${prefix}:${normalized.toLowerCase()}`).digest("hex");
}

export function resolveFreeDealIdentity(input: FreeDealVisitorIdentity): ResolvedFreeDealIdentity {
  const normalizedDeviceId = input.deviceId?.trim();
  const normalizedIp = input.ip?.trim();
  const normalizedUserAgent = input.userAgent?.trim();
  const fallbackDeviceSource = [normalizedIp, normalizedUserAgent].filter(Boolean).join("|") || "anonymous";
  const deviceSource = normalizedDeviceId || fallbackDeviceSource;

  return {
    deviceIdHash: createHash("sha256").update(`device:${deviceSource.toLowerCase()}`).digest("hex"),
    ipHash: hashValue("ip", normalizedIp),
    userAgentHash: hashValue("ua", normalizedUserAgent),
    userId: input.userId?.trim() || undefined,
    customerEmail: normalizeEmail(input.customerEmail),
  };
}

function buildSharePath(referralCode: string) {
  return `${FREE_DEAL_SHARE_ROUTE_PREFIX}/${encodeURIComponent(referralCode)}`;
}

export function buildFreeDealShareUrl(origin: string, referralCode: string) {
  return `${origin}${buildSharePath(referralCode)}`;
}

async function getClaims() {
  if (canUseDatabase()) {
    try {
      const records = await prisma.freeDealClaimRecord.findMany({ orderBy: { createdAt: "desc" } });
      return records.map((record) => normalizeClaimRecord(record as unknown as Record<string, unknown>));
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  const records = await readJsonFile<Record<string, unknown>[]>(CLAIMS_PATH, []);
  return records.map(normalizeClaimRecord).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function saveClaims(claims: FreeDealClaim[]) {
  await writeJsonFile(CLAIMS_PATH, claims);
}

async function getReferralVisits() {
  if (canUseDatabase()) {
    try {
      const records = await prisma.freeDealReferralVisitRecord.findMany({ orderBy: { createdAt: "desc" } });
      return records.map((record) => normalizeReferralVisitRecord(record as unknown as Record<string, unknown>));
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  const records = await readJsonFile<Record<string, unknown>[]>(VISITS_PATH, []);
  return records.map(normalizeReferralVisitRecord).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function saveReferralVisits(visits: FreeDealReferralVisit[]) {
  await writeJsonFile(VISITS_PATH, visits);
}

async function referralCodeExists(referralCode: string) {
  if (canUseDatabase()) {
    try {
      const existing = await prisma.freeDealClaimRecord.findUnique({ where: { referralCode } });
      return Boolean(existing);
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  const claims = await getClaims();
  return claims.some((claim) => claim.referralCode === referralCode);
}

async function generateUniqueReferralCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = randomBytes(5).toString("hex").slice(0, 8).toUpperCase();
    if (!(await referralCodeExists(candidate))) {
      return candidate;
    }
  }

  return randomBytes(8).toString("hex").toUpperCase();
}

async function updateClaimRecord(claim: FreeDealClaim) {
  if (canUseDatabase()) {
    try {
      await prisma.freeDealClaimRecord.update({
        where: { id: claim.id },
        data: {
          status: claim.status,
          userId: claim.userId,
          customerEmail: claim.customerEmail,
          customerName: claim.customerName,
          orderId: claim.orderId,
          deviceIdHash: claim.deviceIdHash,
          ipHash: claim.ipHash,
          userAgentHash: claim.userAgentHash,
          referralGoal: claim.referralGoal,
          referralVisitCount: claim.referralVisitCount,
          itemLimit: claim.itemLimit,
          fixedPriceEur: claim.fixedPriceEur,
          fixedPriceFcfa: claim.fixedPriceFcfa,
          selectedProductSlugs: toPrismaJson(claim.selectedProductSlugs),
          paidAt: claim.paidAt ? new Date(claim.paidAt) : null,
          unlockedAt: claim.unlockedAt ? new Date(claim.unlockedAt) : null,
        },
      });

      return claim;
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  const claims = await getClaims();
  await saveClaims(claims.map((entry) => (entry.id === claim.id ? claim : entry)));
  return claim;
}

async function createClaimRecord(claim: FreeDealClaim) {
  if (canUseDatabase()) {
    try {
      await prisma.freeDealClaimRecord.create({
        data: {
          id: claim.id,
          status: claim.status,
          userId: claim.userId,
          customerEmail: claim.customerEmail,
          customerName: claim.customerName,
          orderId: claim.orderId,
          referralCode: claim.referralCode,
          deviceIdHash: claim.deviceIdHash,
          ipHash: claim.ipHash,
          userAgentHash: claim.userAgentHash,
          referralGoal: claim.referralGoal,
          referralVisitCount: claim.referralVisitCount,
          itemLimit: claim.itemLimit,
          fixedPriceEur: claim.fixedPriceEur,
          fixedPriceFcfa: claim.fixedPriceFcfa,
          selectedProductSlugs: toPrismaJson(claim.selectedProductSlugs),
          paidAt: claim.paidAt ? new Date(claim.paidAt) : null,
          unlockedAt: claim.unlockedAt ? new Date(claim.unlockedAt) : null,
          createdAt: new Date(claim.createdAt),
          updatedAt: new Date(claim.updatedAt),
        },
      });

      return claim;
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  const claims = await getClaims();
  await saveClaims([claim, ...claims]);
  return claim;
}

async function getClaimReferralVisitCount(claimId: string) {
  if (canUseDatabase()) {
    try {
      return prisma.freeDealReferralVisitRecord.count({
        where: {
          claimId,
          counted: true,
        },
      });
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  const visits = await getReferralVisits();
  return visits.filter((visit) => visit.claimId === claimId && visit.counted).length;
}

async function getLatestMatchingClaim(identity: ResolvedFreeDealIdentity) {
  if (canUseDatabase()) {
    try {
      const orConditions: Array<Record<string, string>> = [{ deviceIdHash: identity.deviceIdHash }];
      if (identity.ipHash) {
        orConditions.push({ ipHash: identity.ipHash });
      }
      if (identity.userId) {
        orConditions.push({ userId: identity.userId });
      }
      if (identity.customerEmail) {
        orConditions.push({ customerEmail: identity.customerEmail });
      }

      const record = await prisma.freeDealClaimRecord.findFirst({
        where: {
          OR: orConditions,
        },
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      });

      return record ? normalizeClaimRecord(record as unknown as Record<string, unknown>) : null;
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  const claims = await getClaims();
  return claims.find((claim) => (
    claim.deviceIdHash === identity.deviceIdHash
    || (identity.ipHash && claim.ipHash === identity.ipHash)
    || (identity.userId && claim.userId === identity.userId)
    || (identity.customerEmail && claim.customerEmail === identity.customerEmail)
  )) ?? null;
}

export async function getFreeDealConfig() {
  if (canUseDatabase()) {
    try {
      const record = await prisma.freeDealConfigRecord.findFirst({ orderBy: { updatedAt: "desc" } });
      if (record) {
        return normalizeConfigRecord(record as unknown as Record<string, unknown>);
      }
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  const record = await readJsonFile<Record<string, unknown>>(CONFIG_PATH, DEFAULT_FREE_DEAL_CONFIG as unknown as Record<string, unknown>);
  return normalizeConfigRecord(record);
}

export async function saveFreeDealConfig(input: Partial<FreeDealConfig>) {
  const current = await getFreeDealConfig();
  const nextConfig = normalizeConfigRecord({
    ...current,
    ...input,
    id: DEFAULT_CONFIG_ID,
    updatedAt: new Date().toISOString(),
    createdAt: current.createdAt,
  });

  if (canUseDatabase()) {
    try {
      const existing = await prisma.freeDealConfigRecord.findUnique({ where: { id: DEFAULT_CONFIG_ID } });
      if (existing) {
        await prisma.freeDealConfigRecord.update({
          where: { id: DEFAULT_CONFIG_ID },
          data: {
            enabled: nextConfig.enabled,
            pageTitle: nextConfig.pageTitle,
            heroBadge: nextConfig.heroBadge,
            heroTitle: nextConfig.heroTitle,
            heroSubtitle: nextConfig.heroSubtitle,
            bannerText: nextConfig.bannerText,
            ctaLabel: nextConfig.ctaLabel,
            shareTitle: nextConfig.shareTitle,
            shareDescription: nextConfig.shareDescription,
            itemLimit: nextConfig.itemLimit,
            fixedPriceEur: nextConfig.fixedPriceEur,
            referralGoal: nextConfig.referralGoal,
            dealTagText: nextConfig.dealTagText,
            productBadgeText: nextConfig.productBadgeText,
            compareAtMultiplier: nextConfig.compareAtMultiplier,
            compareAtExtraEur: nextConfig.compareAtExtraEur,
            productSlugs: toPrismaJson(nextConfig.productSlugs),
          },
        });
      } else {
        await prisma.freeDealConfigRecord.create({
          data: {
            id: DEFAULT_CONFIG_ID,
            enabled: nextConfig.enabled,
            pageTitle: nextConfig.pageTitle,
            heroBadge: nextConfig.heroBadge,
            heroTitle: nextConfig.heroTitle,
            heroSubtitle: nextConfig.heroSubtitle,
            bannerText: nextConfig.bannerText,
            ctaLabel: nextConfig.ctaLabel,
            shareTitle: nextConfig.shareTitle,
            shareDescription: nextConfig.shareDescription,
            itemLimit: nextConfig.itemLimit,
            fixedPriceEur: nextConfig.fixedPriceEur,
            referralGoal: nextConfig.referralGoal,
            dealTagText: nextConfig.dealTagText,
            productBadgeText: nextConfig.productBadgeText,
            compareAtMultiplier: nextConfig.compareAtMultiplier,
            compareAtExtraEur: nextConfig.compareAtExtraEur,
            productSlugs: toPrismaJson(nextConfig.productSlugs),
            createdAt: new Date(nextConfig.createdAt),
            updatedAt: new Date(nextConfig.updatedAt),
          },
        });
      }

      return nextConfig;
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  await writeJsonFile(CONFIG_PATH, nextConfig);
  return nextConfig;
}

export async function getFreeDealProducts(config?: FreeDealConfig): Promise<ProductCatalogItem[]> {
  const resolvedConfig = config ?? await getFreeDealConfig();
  return getCatalogProductsBySlugs(resolvedConfig.productSlugs);
}

export async function getFreeDealClaimByOrderId(orderId: string) {
  if (!orderId) {
    return null;
  }

  if (canUseDatabase()) {
    try {
      const record = await prisma.freeDealClaimRecord.findFirst({ where: { orderId } });
      return record ? normalizeClaimRecord(record as unknown as Record<string, unknown>) : null;
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  const claims = await getClaims();
  return claims.find((claim) => claim.orderId === orderId) ?? null;
}

export async function getFreeDealAccessState(input: FreeDealVisitorIdentity, config?: FreeDealConfig): Promise<FreeDealAccessState> {
  const resolvedConfig = config ?? await getFreeDealConfig();

  if (!resolvedConfig.enabled || resolvedConfig.productSlugs.length === 0) {
    return {
      status: "disabled",
      claim: null,
      referralVisitCount: 0,
      referralGoal: resolvedConfig.referralGoal,
      sharePath: null,
    };
  }

  const identity = resolveFreeDealIdentity(input);
  const claim = await getLatestMatchingClaim(identity);

  if (!claim) {
    return {
      status: "eligible",
      claim: null,
      referralVisitCount: 0,
      referralGoal: resolvedConfig.referralGoal,
      sharePath: null,
    };
  }

  const liveVisitCount = await getClaimReferralVisitCount(claim.id);
  const shouldUnlock = liveVisitCount >= claim.referralGoal;
  const nextClaim = liveVisitCount === claim.referralVisitCount && (!shouldUnlock || claim.status === "referral_unlocked")
    ? claim
    : await updateClaimRecord({
        ...claim,
        status: shouldUnlock ? "referral_unlocked" : claim.status,
        referralVisitCount: liveVisitCount,
        unlockedAt: shouldUnlock ? (claim.unlockedAt ?? new Date().toISOString()) : claim.unlockedAt,
        updatedAt: new Date().toISOString(),
      });

  return {
    status: nextClaim.status === "referral_unlocked" ? "unlocked" : "blocked",
    claim: nextClaim,
    referralVisitCount: nextClaim.referralVisitCount,
    referralGoal: nextClaim.referralGoal,
    sharePath: buildSharePath(nextClaim.referralCode),
  };
}

export async function getFreeDealAdminSummary() {
  const [config, claims, visits, products] = await Promise.all([
    getFreeDealConfig(),
    getClaims(),
    getReferralVisits(),
    getFreeDealProducts(),
  ]);

  return {
    config,
    products,
    totalClaims: claims.length,
    blockedClaims: claims.filter((claim) => claim.status === "paid_locked").length,
    unlockedClaims: claims.filter((claim) => claim.status === "referral_unlocked").length,
    referralVisits: visits.filter((visit) => visit.counted).length,
  };
}

export async function registerFreeDealClaimFromPaidOrder(order: SourcingOrder) {
  if (order.paymentStatus !== "paid") {
    return null;
  }

  const existingClaim = await getFreeDealClaimByOrderId(order.id);
  if (existingClaim) {
    return existingClaim;
  }

  const meta = getSourcingOrderMeta(order).freeDeal;
  if (!meta) {
    return null;
  }

  const timestamp = order.paidAt || new Date().toISOString();
  const claim: FreeDealClaim = {
    id: `fdc_${randomBytes(10).toString("hex")}`,
    status: "paid_locked",
    userId: order.userId,
    customerEmail: normalizeEmail(order.customerEmail),
    customerName: order.customerName,
    orderId: order.id,
    referralCode: await generateUniqueReferralCode(),
    deviceIdHash: meta.deviceIdHash,
    ipHash: meta.ipHash,
    userAgentHash: meta.userAgentHash,
    referralGoal: meta.referralGoal,
    referralVisitCount: 0,
    itemLimit: meta.itemLimit,
    fixedPriceEur: meta.fixedPriceEur,
    fixedPriceFcfa: meta.fixedPriceFcfa,
    selectedProductSlugs: meta.selectedProductSlugs,
    paidAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  try {
    return await createClaimRecord(claim);
  } catch {
    return getFreeDealClaimByOrderId(order.id);
  }
}

export async function recordFreeDealReferralVisit(input: {
  referralCode: string;
  visitor: FreeDealVisitorIdentity;
}) {
  const referralCode = input.referralCode.trim().toUpperCase();
  if (!referralCode) {
    return null;
  }

  const identity = resolveFreeDealIdentity(input.visitor);
  const claim = canUseDatabase()
    ? await prisma.freeDealClaimRecord.findUnique({ where: { referralCode } })
      .then((record) => (record ? normalizeClaimRecord(record as unknown as Record<string, unknown>) : null))
      .catch((error) => {
        if (!isPrismaDatabaseUnavailable(error)) {
          throw error;
        }

        enableDatabaseFallback(error);
        return null;
      })
    : null;
  const resolvedClaim = claim ?? (await getClaims()).find((entry) => entry.referralCode === referralCode) ?? null;

  if (!resolvedClaim) {
    return null;
  }

  const visitorKeyHash = createHash("sha256").update([
    identity.deviceIdHash,
    identity.ipHash ?? "",
    identity.userAgentHash ?? "",
  ].join("|")).digest("hex");

  const isOwnerVisit = resolvedClaim.deviceIdHash === identity.deviceIdHash
    || (resolvedClaim.ipHash && identity.ipHash && resolvedClaim.ipHash === identity.ipHash && resolvedClaim.userAgentHash && identity.userAgentHash && resolvedClaim.userAgentHash === identity.userAgentHash);

  if (isOwnerVisit) {
    return resolvedClaim;
  }

  if (canUseDatabase()) {
    const existingVisit = await prisma.freeDealReferralVisitRecord.findUnique({
      where: {
        claimId_visitorKeyHash: {
          claimId: resolvedClaim.id,
          visitorKeyHash,
        },
      },
    });

    if (existingVisit) {
      return resolvedClaim;
    }

    try {
      await prisma.freeDealReferralVisitRecord.create({
        data: {
          claimId: resolvedClaim.id,
          referralCode,
          visitorKeyHash,
          visitorDeviceHash: identity.deviceIdHash,
          visitorIpHash: identity.ipHash,
          visitorUserAgentHash: identity.userAgentHash,
          counted: true,
        },
      });
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        return resolvedClaim;
      }

      enableDatabaseFallback(error);
    }

    if (canUseDatabase()) {
      const visitCount = await getClaimReferralVisitCount(resolvedClaim.id);
      const nextStatus: FreeDealClaimStatus = visitCount >= resolvedClaim.referralGoal ? "referral_unlocked" : resolvedClaim.status;
      return updateClaimRecord({
        ...resolvedClaim,
        status: nextStatus,
        referralVisitCount: visitCount,
        unlockedAt: nextStatus === "referral_unlocked" ? (resolvedClaim.unlockedAt ?? new Date().toISOString()) : resolvedClaim.unlockedAt,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  {
    const visits = await getReferralVisits();
    const alreadyCounted = visits.some((visit) => visit.claimId === resolvedClaim.id && visit.visitorKeyHash === visitorKeyHash);

    if (alreadyCounted) {
      return resolvedClaim;
    }

    await saveReferralVisits([
      {
        id: `fdv_${randomBytes(10).toString("hex")}`,
        claimId: resolvedClaim.id,
        referralCode,
        visitorKeyHash,
        visitorDeviceHash: identity.deviceIdHash,
        visitorIpHash: identity.ipHash,
        visitorUserAgentHash: identity.userAgentHash,
        counted: true,
        createdAt: new Date().toISOString(),
      },
      ...visits,
    ]);
  }

  const visitCount = await getClaimReferralVisitCount(resolvedClaim.id);
  const nextStatus: FreeDealClaimStatus = visitCount >= resolvedClaim.referralGoal ? "referral_unlocked" : resolvedClaim.status;
  const nextClaim = await updateClaimRecord({
    ...resolvedClaim,
    status: nextStatus,
    referralVisitCount: visitCount,
    unlockedAt: nextStatus === "referral_unlocked" ? (resolvedClaim.unlockedAt ?? new Date().toISOString()) : resolvedClaim.unlockedAt,
    updatedAt: new Date().toISOString(),
  });

  return nextClaim;
}

export function isAllowedFreeDealProductSelection(config: FreeDealConfig, selectedSlugs: string[]) {
  if (selectedSlugs.length !== config.itemLimit) {
    return false;
  }

  const uniqueSelected = new Set(selectedSlugs);
  if (uniqueSelected.size !== config.itemLimit) {
    return false;
  }

  const allowedSlugs = new Set(config.productSlugs);
  return selectedSlugs.every((slug) => allowedSlugs.has(slug));
}

export function getFreeDealFixedPriceFcfa(config: Pick<FreeDealConfig, "fixedPriceEur">) {
  return convertEurToFcfa(config.fixedPriceEur);
}

export function getFreeDealPublicHref() {
  return FREE_DEAL_ROUTE;
}
