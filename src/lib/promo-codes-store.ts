import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type PromoCodeAmountType = "fixed_fcfa" | "percent";

export type PromoCodeRecord = {
  id: string;
  code: string;
  label: string;
  description?: string;
  amountType: PromoCodeAmountType;
  amountValue: number;
  minOrderFcfa: number;
  maxDiscountFcfa?: number;
  active: boolean;
  startsAt?: string;
  endsAt?: string;
  usageLimit?: number;
  usageCount: number;
  usedOrderIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type PromoCodeValidationResult = {
  promoCode: PromoCodeRecord;
  discountFcfa: number;
  finalTotalFcfa: number;
};

const SITE_DIR = path.join(process.cwd(), "data", "site");
const PROMO_CODES_PATH = path.join(SITE_DIR, "promo-codes.json");

const DEFAULT_PROMO_CODES: PromoCodeRecord[] = [
  {
    id: "promo-welcome-10",
    code: "WELCOME10",
    label: "Bienvenue AfriPay",
    description: "10% sur une commande sourcing eligible.",
    amountType: "percent",
    amountValue: 10,
    minOrderFcfa: 25000,
    maxDiscountFcfa: 15000,
    active: true,
    startsAt: "2026-01-01T00:00:00.000Z",
    endsAt: "2026-12-31T23:59:59.000Z",
    usageLimit: 500,
    usageCount: 0,
    usedOrderIds: [],
    createdAt: "2026-03-25T00:00:00.000Z",
    updatedAt: "2026-03-25T00:00:00.000Z",
  },
];

let databaseFallbackForced = false;

function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

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
    console.warn("[promo-codes-store] database unavailable, falling back to JSON storage", error);
  }
}

async function ensureSiteDir() {
  await mkdir(SITE_DIR, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  await ensureSiteDir();

  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    await writeJsonFile(filePath, fallback);
    return fallback;
  }
}

async function writeJsonFile<T>(filePath: string, value: T) {
  await ensureSiteDir();
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function toNonEmptyString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function toPositiveNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, value);
  }

  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function toOptionalIsoString(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

function toPrismaJsonArray(value: string[]): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toPromoCodeRecordFromDatabase(record: {
  id: string;
  code: string;
  label: string;
  description: string | null;
  amountType: string;
  amountValue: number;
  minOrderFcfa: number;
  maxDiscountFcfa: number | null;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  usageCount: number;
  usedOrderIds: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return normalizePromoCode({
    id: record.id,
    code: record.code,
    label: record.label,
    description: record.description ?? undefined,
    amountType: record.amountType,
    amountValue: record.amountValue,
    minOrderFcfa: record.minOrderFcfa,
    maxDiscountFcfa: record.maxDiscountFcfa ?? undefined,
    active: record.active,
    startsAt: record.startsAt?.toISOString(),
    endsAt: record.endsAt?.toISOString(),
    usageLimit: record.usageLimit ?? undefined,
    usageCount: record.usageCount,
    usedOrderIds: toStringArray(record.usedOrderIds),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }, 0);
}

async function ensureDefaultPromoCodesInDatabase() {
  const count = await prisma.promoCode.count();
  if (count > 0) {
    return;
  }

  await prisma.$transaction(
    DEFAULT_PROMO_CODES.map((promoCode) => prisma.promoCode.upsert({
      where: { code: promoCode.code },
      update: {
        label: promoCode.label,
        description: promoCode.description ?? null,
        amountType: promoCode.amountType,
        amountValue: promoCode.amountValue,
        minOrderFcfa: promoCode.minOrderFcfa,
        maxDiscountFcfa: promoCode.maxDiscountFcfa ?? null,
        active: promoCode.active,
        startsAt: promoCode.startsAt ? new Date(promoCode.startsAt) : null,
        endsAt: promoCode.endsAt ? new Date(promoCode.endsAt) : null,
        usageLimit: promoCode.usageLimit ?? null,
        usageCount: promoCode.usageCount,
        usedOrderIds: toPrismaJsonArray(promoCode.usedOrderIds),
      },
      create: {
        id: promoCode.id,
        code: promoCode.code,
        label: promoCode.label,
        description: promoCode.description ?? null,
        amountType: promoCode.amountType,
        amountValue: promoCode.amountValue,
        minOrderFcfa: promoCode.minOrderFcfa,
        maxDiscountFcfa: promoCode.maxDiscountFcfa ?? null,
        active: promoCode.active,
        startsAt: promoCode.startsAt ? new Date(promoCode.startsAt) : null,
        endsAt: promoCode.endsAt ? new Date(promoCode.endsAt) : null,
        usageLimit: promoCode.usageLimit ?? null,
        usageCount: promoCode.usageCount,
        usedOrderIds: toPrismaJsonArray(promoCode.usedOrderIds),
      },
    })),
  );
}

function normalizePromoCode(value: unknown, index: number): PromoCodeRecord {
  const record = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const timestamp = new Date().toISOString();
  const code = toNonEmptyString(record.code, `PROMO${index + 1}`).toUpperCase();

  return {
    id: toNonEmptyString(record.id, randomUUID()),
    code,
    label: toNonEmptyString(record.label, code),
    description: toNonEmptyString(record.description),
    amountType: record.amountType === "percent" ? "percent" : "fixed_fcfa",
    amountValue: toPositiveNumber(record.amountValue, 0),
    minOrderFcfa: toPositiveNumber(record.minOrderFcfa, 0),
    maxDiscountFcfa: typeof record.maxDiscountFcfa === "undefined" ? undefined : toPositiveNumber(record.maxDiscountFcfa, 0),
    active: record.active !== false,
    startsAt: toOptionalIsoString(record.startsAt),
    endsAt: toOptionalIsoString(record.endsAt),
    usageLimit: typeof record.usageLimit === "undefined" ? undefined : toPositiveNumber(record.usageLimit, 0),
    usageCount: toPositiveNumber(record.usageCount, 0),
    usedOrderIds: toStringArray(record.usedOrderIds),
    createdAt: toOptionalIsoString(record.createdAt) ?? timestamp,
    updatedAt: toOptionalIsoString(record.updatedAt) ?? timestamp,
  };
}

function normalizePromoCodes(value: unknown) {
  if (!Array.isArray(value)) {
    return DEFAULT_PROMO_CODES;
  }

  return value.map(normalizePromoCode);
}

function isPromoCodeActive(promoCode: PromoCodeRecord, at = new Date()) {
  if (!promoCode.active) {
    return false;
  }

  if (promoCode.startsAt && new Date(promoCode.startsAt).getTime() > at.getTime()) {
    return false;
  }

  if (promoCode.endsAt && new Date(promoCode.endsAt).getTime() < at.getTime()) {
    return false;
  }

  if (typeof promoCode.usageLimit === "number" && promoCode.usageCount >= promoCode.usageLimit) {
    return false;
  }

  return true;
}

export async function getPromoCodes() {
  if (canUseDatabase()) {
    try {
      await ensureDefaultPromoCodesInDatabase();
      const records = await prisma.promoCode.findMany({ orderBy: { code: "asc" } });
      return records.map(toPromoCodeRecordFromDatabase);
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  const raw = await readJsonFile<PromoCodeRecord[]>(PROMO_CODES_PATH, DEFAULT_PROMO_CODES);
  return normalizePromoCodes(raw).sort((left, right) => left.code.localeCompare(right.code));
}

export async function savePromoCodes(nextPromoCodes: PromoCodeRecord[]) {
  const normalized = normalizePromoCodes(nextPromoCodes).map((promoCode) => ({
    ...promoCode,
    updatedAt: new Date().toISOString(),
  }));

  if (canUseDatabase()) {
    try {
      await prisma.$transaction([
        prisma.promoCode.deleteMany({
          where: normalized.length > 0 ? { id: { notIn: normalized.map((promoCode) => promoCode.id) } } : {},
        }),
        ...normalized.map((promoCode) => prisma.promoCode.upsert({
          where: { id: promoCode.id },
          update: {
            code: promoCode.code,
            label: promoCode.label,
            description: promoCode.description ?? null,
            amountType: promoCode.amountType,
            amountValue: promoCode.amountValue,
            minOrderFcfa: promoCode.minOrderFcfa,
            maxDiscountFcfa: promoCode.maxDiscountFcfa ?? null,
            active: promoCode.active,
            startsAt: promoCode.startsAt ? new Date(promoCode.startsAt) : null,
            endsAt: promoCode.endsAt ? new Date(promoCode.endsAt) : null,
            usageLimit: promoCode.usageLimit ?? null,
            usageCount: promoCode.usageCount,
            usedOrderIds: toPrismaJsonArray(promoCode.usedOrderIds),
          },
          create: {
            id: promoCode.id,
            code: promoCode.code,
            label: promoCode.label,
            description: promoCode.description ?? null,
            amountType: promoCode.amountType,
            amountValue: promoCode.amountValue,
            minOrderFcfa: promoCode.minOrderFcfa,
            maxDiscountFcfa: promoCode.maxDiscountFcfa ?? null,
            active: promoCode.active,
            startsAt: promoCode.startsAt ? new Date(promoCode.startsAt) : null,
            endsAt: promoCode.endsAt ? new Date(promoCode.endsAt) : null,
            usageLimit: promoCode.usageLimit ?? null,
            usageCount: promoCode.usageCount,
            usedOrderIds: toPrismaJsonArray(promoCode.usedOrderIds),
          },
        })),
      ]);
      return normalized;
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  await writeJsonFile(PROMO_CODES_PATH, normalized);
  return normalized;
}

export async function upsertPromoCode(input: Partial<PromoCodeRecord> & Pick<PromoCodeRecord, "code" | "label" | "amountType" | "amountValue">) {
  const promoCodes = await getPromoCodes();
  const normalizedCode = input.code.trim().toUpperCase();
  const existing = promoCodes.find((promoCode) => promoCode.id === input.id || promoCode.code === normalizedCode);
  const timestamp = new Date().toISOString();
  const nextPromoCode: PromoCodeRecord = normalizePromoCode({
    ...existing,
    ...input,
    code: normalizedCode,
    id: existing?.id ?? input.id ?? randomUUID(),
    usageCount: existing?.usageCount ?? 0,
    usedOrderIds: existing?.usedOrderIds ?? [],
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  }, promoCodes.length);

  const nextPromoCodes = existing
    ? promoCodes.map((promoCode) => (promoCode.id === existing.id ? nextPromoCode : promoCode))
    : [nextPromoCode, ...promoCodes];

  await savePromoCodes(nextPromoCodes);
  return nextPromoCode;
}

export async function deletePromoCode(codeOrId: string) {
  const promoCodes = await getPromoCodes();
  const nextPromoCodes = promoCodes.filter((promoCode) => promoCode.id !== codeOrId && promoCode.code !== codeOrId.toUpperCase());
  await savePromoCodes(nextPromoCodes);
  return nextPromoCodes;
}

export async function getPromoCodeByCode(code: string) {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) {
    return null;
  }

  if (canUseDatabase()) {
    try {
      const record = await prisma.promoCode.findUnique({ where: { code: normalizedCode } });
      return record ? toPromoCodeRecordFromDatabase(record) : null;
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  const promoCodes = await getPromoCodes();
  return promoCodes.find((promoCode) => promoCode.code === normalizedCode) ?? null;
}

export async function validatePromoCodeForAmount(input: { code: string; totalFcfa: number }) {
  const promoCode = await getPromoCodeByCode(input.code);
  if (!promoCode) {
    throw new Error("Code promo introuvable.");
  }

  if (!isPromoCodeActive(promoCode)) {
    throw new Error("Ce code promo n'est pas actif.");
  }

  if (input.totalFcfa < promoCode.minOrderFcfa) {
    throw new Error(`Ce code promo est disponible dès ${promoCode.minOrderFcfa.toLocaleString("fr-FR")} FCFA.`);
  }

  let discountFcfa = promoCode.amountType === "percent"
    ? Math.round((input.totalFcfa * promoCode.amountValue) / 100)
    : Math.round(promoCode.amountValue);

  if (typeof promoCode.maxDiscountFcfa === "number") {
    discountFcfa = Math.min(discountFcfa, promoCode.maxDiscountFcfa);
  }

  discountFcfa = Math.max(0, Math.min(discountFcfa, input.totalFcfa));

  if (discountFcfa <= 0) {
    throw new Error("Ce code promo ne génère aucune réduction sur ce panier.");
  }

  return {
    promoCode,
    discountFcfa,
    finalTotalFcfa: Math.max(0, input.totalFcfa - discountFcfa),
  } satisfies PromoCodeValidationResult;
}

export async function consumePromoCode(input: { code: string; orderId: string }) {
  const normalizedCode = input.code.trim().toUpperCase();

  if (canUseDatabase()) {
    try {
      const existing = await prisma.promoCode.findUnique({ where: { code: normalizedCode } });
      if (!existing) {
        return null;
      }

      const usedOrderIds = toStringArray(existing.usedOrderIds);
      if (usedOrderIds.includes(input.orderId)) {
        return toPromoCodeRecordFromDatabase(existing);
      }

      const nextRecord = await prisma.promoCode.update({
        where: { code: normalizedCode },
        data: {
          usageCount: existing.usageCount + 1,
          usedOrderIds: toPrismaJsonArray([...usedOrderIds, input.orderId]),
        },
      });

      return toPromoCodeRecordFromDatabase(nextRecord);
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  const promoCodes = await getPromoCodes();
  const existing = promoCodes.find((promoCode) => promoCode.code === normalizedCode);

  if (!existing) {
    return null;
  }

  if (existing.usedOrderIds.includes(input.orderId)) {
    return existing;
  }

  const nextPromoCode: PromoCodeRecord = {
    ...existing,
    usageCount: existing.usageCount + 1,
    usedOrderIds: [...existing.usedOrderIds, input.orderId],
    updatedAt: new Date().toISOString(),
  };

  await savePromoCodes(promoCodes.map((promoCode) => (promoCode.id === existing.id ? nextPromoCode : promoCode)));
  return nextPromoCode;
}