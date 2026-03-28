import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import type { CartInputItem } from "@/lib/alibaba-sourcing";
import { prisma } from "@/lib/prisma";

export type SharedCartStatus = "active" | "claimed" | "ordered" | "expired";

export type SharedCartRecord = {
  id: string;
  token: string;
  ownerUserId: string;
  ownerEmail: string;
  ownerDisplayName: string;
  message?: string;
  items: CartInputItem[];
  status: SharedCartStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  claimCount: number;
  lastClaimedAt?: string;
  claimedByUserId?: string;
  claimedByDisplayName?: string;
  claimedOrderId?: string;
};

const SITE_DIR = path.join(process.cwd(), "data", "site");
const SHARED_CARTS_PATH = path.join(SITE_DIR, "shared-carts.json");

let databaseFallbackForced = false;

function getSharedCartLinkDelegate() {
  const delegate = (prisma as unknown as Record<string, unknown>).sharedCartLink;
  if (!delegate || typeof delegate !== "object") {
    return null;
  }

  return delegate as Record<string, (...args: unknown[]) => Promise<unknown>>;
}

function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

function canUseDatabase() {
  return hasDatabase() && !databaseFallbackForced && Boolean(getSharedCartLinkDelegate());
}

function isPrismaDatabaseUnavailable(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown };
  const message = typeof candidate.message === "string" ? candidate.message : "";
  return candidate.code === "P1001"
    || candidate.code === "P2022"
    || message.includes("Can't reach database server")
    || message.includes("db.prisma.io:5432")
    || message.includes("does not exist in the current database");
}

function enableDatabaseFallback(error: unknown) {
  if (!databaseFallbackForced) {
    databaseFallbackForced = true;
    console.warn("[cart-share-store] database unavailable, falling back to JSON storage", error);
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

function toIsoString(value: unknown, fallback = new Date().toISOString()) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function normalizeItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as CartInputItem[];
  }

  return value.reduce<CartInputItem[]>((items, entry) => {
      const record = typeof entry === "object" && entry !== null ? entry as Record<string, unknown> : null;
      if (!record) {
        return items;
      }

      const slug = toNonEmptyString(record.slug);
      const quantity = Number(record.quantity ?? 0);
      const selectedVariants = typeof record.selectedVariants === "object" && record.selectedVariants !== null
        ? Object.fromEntries(
            Object.entries(record.selectedVariants as Record<string, unknown>)
              .filter(([, selectedValue]) => typeof selectedValue === "string" && selectedValue.trim().length > 0)
              .map(([label, selectedValue]) => [label.trim(), String(selectedValue).trim()]),
          )
        : undefined;

      if (!slug || !Number.isFinite(quantity) || quantity <= 0) {
        return items;
      }

      items.push({
        slug,
        quantity,
        selectedVariants,
      } satisfies CartInputItem);

      return items;
    }, []);
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toSharedCartRecordFromDatabase(record: {
  id: string;
  token: string;
  ownerUserId: string;
  ownerEmail: string;
  ownerDisplayName: string;
  message: string | null;
  itemsPayload: Prisma.JsonValue;
  status: string;
  claimCount: number;
  lastClaimedAt: Date | null;
  claimedByUserId: string | null;
  claimedByDisplayName: string | null;
  claimedOrderId: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  const normalized = normalizeSharedCart({
    id: record.id,
    token: record.token,
    ownerUserId: record.ownerUserId,
    ownerEmail: record.ownerEmail,
    ownerDisplayName: record.ownerDisplayName,
    message: record.message ?? undefined,
    items: record.itemsPayload,
    status: record.status,
    claimCount: record.claimCount,
    lastClaimedAt: record.lastClaimedAt?.toISOString(),
    claimedByUserId: record.claimedByUserId ?? undefined,
    claimedByDisplayName: record.claimedByDisplayName ?? undefined,
    claimedOrderId: record.claimedOrderId ?? undefined,
    expiresAt: record.expiresAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });

  if (!normalized) {
    throw new Error("Shared cart record is invalid.");
  }

  return isExpired(normalized) && normalized.status !== "ordered"
    ? { ...normalized, status: "expired" as const }
    : normalized;
}

function normalizeSharedCart(value: unknown): SharedCartRecord | null {
  const record = typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
  if (!record) {
    return null;
  }

  const items = normalizeItems(record.items);
  if (items.length === 0) {
    return null;
  }

  return {
    id: toNonEmptyString(record.id, randomUUID()),
    token: toNonEmptyString(record.token, randomBytes(16).toString("hex")),
    ownerUserId: toNonEmptyString(record.ownerUserId),
    ownerEmail: toNonEmptyString(record.ownerEmail),
    ownerDisplayName: toNonEmptyString(record.ownerDisplayName, "Client AfriPay"),
    message: toNonEmptyString(record.message),
    items,
    status: record.status === "claimed" || record.status === "ordered" || record.status === "expired" ? record.status : "active",
    createdAt: toIsoString(record.createdAt),
    updatedAt: toIsoString(record.updatedAt),
    expiresAt: toIsoString(record.expiresAt, new Date(Date.now() + (1000 * 60 * 60 * 24 * 7)).toISOString()),
    claimCount: Number(record.claimCount ?? 0) > 0 ? Number(record.claimCount) : 0,
    lastClaimedAt: typeof record.lastClaimedAt === "string" ? toIsoString(record.lastClaimedAt) : undefined,
    claimedByUserId: toNonEmptyString(record.claimedByUserId),
    claimedByDisplayName: toNonEmptyString(record.claimedByDisplayName),
    claimedOrderId: toNonEmptyString(record.claimedOrderId),
  };
}

function isExpired(sharedCart: SharedCartRecord) {
  return new Date(sharedCart.expiresAt).getTime() < Date.now();
}

export async function getSharedCarts() {
  if (canUseDatabase()) {
    try {
      const records = await getSharedCartLinkDelegate()!.findMany({ orderBy: { createdAt: "desc" } }) as Array<Parameters<typeof toSharedCartRecordFromDatabase>[0]>;
      return records.map(toSharedCartRecordFromDatabase);
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  const raw = await readJsonFile<SharedCartRecord[]>(SHARED_CARTS_PATH, []);
  return raw
    .map(normalizeSharedCart)
    .filter((entry): entry is SharedCartRecord => Boolean(entry))
    .map((entry) => (isExpired(entry) && entry.status !== "ordered"
      ? { ...entry, status: "expired" as const }
      : entry))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function saveSharedCarts(nextSharedCarts: SharedCartRecord[]) {
  if (canUseDatabase()) {
    try {
      await prisma.$transaction(async (transaction) => {
        const sharedCartLink = (transaction as unknown as Record<string, unknown>).sharedCartLink as Record<string, (...args: unknown[]) => Promise<unknown>> | undefined;
        if (!sharedCartLink) {
          throw new Error("sharedCartLink Prisma delegate is unavailable.");
        }

        await sharedCartLink.deleteMany({
          where: nextSharedCarts.length > 0 ? { id: { notIn: nextSharedCarts.map((sharedCart) => sharedCart.id) } } : {},
        });

        for (const sharedCart of nextSharedCarts) {
          await sharedCartLink.upsert({
            where: { id: sharedCart.id },
            update: {
              token: sharedCart.token,
              ownerUserId: sharedCart.ownerUserId,
              ownerEmail: sharedCart.ownerEmail,
              ownerDisplayName: sharedCart.ownerDisplayName,
              message: sharedCart.message ?? null,
              itemsPayload: toPrismaJson(sharedCart.items),
              status: sharedCart.status,
              claimCount: sharedCart.claimCount,
              lastClaimedAt: sharedCart.lastClaimedAt ? new Date(sharedCart.lastClaimedAt) : null,
              claimedByUserId: sharedCart.claimedByUserId ?? null,
              claimedByDisplayName: sharedCart.claimedByDisplayName ?? null,
              claimedOrderId: sharedCart.claimedOrderId ?? null,
              expiresAt: new Date(sharedCart.expiresAt),
            },
            create: {
              id: sharedCart.id,
              token: sharedCart.token,
              ownerUserId: sharedCart.ownerUserId,
              ownerEmail: sharedCart.ownerEmail,
              ownerDisplayName: sharedCart.ownerDisplayName,
              message: sharedCart.message ?? null,
              itemsPayload: toPrismaJson(sharedCart.items),
              status: sharedCart.status,
              claimCount: sharedCart.claimCount,
              lastClaimedAt: sharedCart.lastClaimedAt ? new Date(sharedCart.lastClaimedAt) : null,
              claimedByUserId: sharedCart.claimedByUserId ?? null,
              claimedByDisplayName: sharedCart.claimedByDisplayName ?? null,
              claimedOrderId: sharedCart.claimedOrderId ?? null,
              expiresAt: new Date(sharedCart.expiresAt),
            },
          });
        }
      });
      return nextSharedCarts;
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  await writeJsonFile(SHARED_CARTS_PATH, nextSharedCarts);
  return nextSharedCarts;
}

export async function createSharedCart(input: {
  ownerUserId: string;
  ownerEmail: string;
  ownerDisplayName: string;
  message?: string;
  items: CartInputItem[];
}) {
  const sharedCarts = await getSharedCarts();
  const timestamp = new Date().toISOString();
  const sharedCart: SharedCartRecord = {
    id: randomUUID(),
    token: randomBytes(16).toString("hex"),
    ownerUserId: input.ownerUserId,
    ownerEmail: input.ownerEmail,
    ownerDisplayName: input.ownerDisplayName,
    message: input.message?.trim() || undefined,
    items: normalizeItems(input.items),
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
    expiresAt: new Date(Date.now() + (1000 * 60 * 60 * 24 * 7)).toISOString(),
    claimCount: 0,
  };

  await saveSharedCarts([sharedCart, ...sharedCarts]);
  return sharedCart;
}

export async function getSharedCartByToken(token: string) {
  if (!token.trim()) {
    return null;
  }

  if (canUseDatabase()) {
    try {
      const record = await getSharedCartLinkDelegate()!.findUnique({ where: { token: token.trim() } }) as Parameters<typeof toSharedCartRecordFromDatabase>[0] | null;
      return record ? toSharedCartRecordFromDatabase(record) : null;
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  const sharedCarts = await getSharedCarts();
  return sharedCarts.find((sharedCart) => sharedCart.token === token.trim()) ?? null;
}

export async function getSharedCartSummariesForOwner(ownerUserId: string) {
  if (canUseDatabase()) {
    try {
      const records = await getSharedCartLinkDelegate()!.findMany({
        where: { ownerUserId },
        orderBy: { createdAt: "desc" },
        take: 6,
      }) as Array<Parameters<typeof toSharedCartRecordFromDatabase>[0]>;
      return records.map(toSharedCartRecordFromDatabase);
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  const sharedCarts = await getSharedCarts();
  return sharedCarts.filter((sharedCart) => sharedCart.ownerUserId === ownerUserId).slice(0, 6);
}

export async function markSharedCartClaimed(input: { token: string; claimerUserId: string; claimerDisplayName: string }) {
  if (canUseDatabase()) {
    try {
      const sharedCartLink = getSharedCartLinkDelegate();
      if (!sharedCartLink) {
        throw new Error("sharedCartLink Prisma delegate is unavailable.");
      }

      const existing = await sharedCartLink.findUnique({ where: { token: input.token.trim() } }) as {
        status: string;
        claimCount: number;
      } | null;
      if (!existing) {
        return null;
      }

      const nextRecord = await sharedCartLink.update({
        where: { token: input.token.trim() },
        data: {
          status: existing.status === "ordered" ? "ordered" : "claimed",
          claimCount: existing.claimCount + 1,
          lastClaimedAt: new Date(),
          claimedByUserId: input.claimerUserId,
          claimedByDisplayName: input.claimerDisplayName,
        },
      }) as Parameters<typeof toSharedCartRecordFromDatabase>[0];

      return toSharedCartRecordFromDatabase(nextRecord);
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  const sharedCarts = await getSharedCarts();
  const sharedCart = sharedCarts.find((entry) => entry.token === input.token.trim());
  if (!sharedCart) {
    return null;
  }

  const nextSharedCart: SharedCartRecord = {
    ...sharedCart,
    status: sharedCart.status === "ordered" ? "ordered" : "claimed",
    claimCount: sharedCart.claimCount + 1,
    lastClaimedAt: new Date().toISOString(),
    claimedByUserId: input.claimerUserId,
    claimedByDisplayName: input.claimerDisplayName,
    updatedAt: new Date().toISOString(),
  };

  await saveSharedCarts(sharedCarts.map((entry) => (entry.id === sharedCart.id ? nextSharedCart : entry)));
  return nextSharedCart;
}

export async function markSharedCartOrdered(input: { token: string; claimerUserId: string; claimerDisplayName: string; orderId: string }) {
  if (canUseDatabase()) {
    try {
      const sharedCartLink = getSharedCartLinkDelegate();
      if (!sharedCartLink) {
        throw new Error("sharedCartLink Prisma delegate is unavailable.");
      }

      const existing = await sharedCartLink.findUnique({ where: { token: input.token.trim() } }) as {
        claimedOrderId: string | null;
        claimCount: number;
      } | null;
      if (!existing) {
        return null;
      }

      const nextRecord = await sharedCartLink.update({
        where: { token: input.token.trim() },
        data: {
          status: "ordered",
          claimCount: existing.claimedOrderId ? existing.claimCount : existing.claimCount + 1,
          lastClaimedAt: new Date(),
          claimedByUserId: input.claimerUserId,
          claimedByDisplayName: input.claimerDisplayName,
          claimedOrderId: input.orderId,
        },
      }) as Parameters<typeof toSharedCartRecordFromDatabase>[0];

      return toSharedCartRecordFromDatabase(nextRecord);
    } catch (error) {
      if (!isPrismaDatabaseUnavailable(error)) {
        throw error;
      }

      enableDatabaseFallback(error);
    }
  }

  const sharedCarts = await getSharedCarts();
  const sharedCart = sharedCarts.find((entry) => entry.token === input.token.trim());
  if (!sharedCart) {
    return null;
  }

  const nextSharedCart: SharedCartRecord = {
    ...sharedCart,
    status: "ordered",
    claimCount: sharedCart.claimCount + (sharedCart.claimedOrderId ? 0 : 1),
    lastClaimedAt: new Date().toISOString(),
    claimedByUserId: input.claimerUserId,
    claimedByDisplayName: input.claimerDisplayName,
    claimedOrderId: input.orderId,
    updatedAt: new Date().toISOString(),
  };

  await saveSharedCarts(sharedCarts.map((entry) => (entry.id === sharedCart.id ? nextSharedCart : entry)));
  return nextSharedCart;
}