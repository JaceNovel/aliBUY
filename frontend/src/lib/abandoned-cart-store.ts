import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { get, put } from "@vercel/blob";

import type { CartInputItem } from "@/lib/alibaba-sourcing";
import { getVercelBlobAccessMode } from "@/lib/vercel-blob-access";

export type AbandonedCartStatus = "active" | "cleared" | "converted";

export type AbandonedCartRecord = {
  id: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  connectedWhatsapp?: string;
  manychatSubscriberId?: string;
  manychatFlowId?: string;
  manychatPaidTagId?: string;
  items: CartInputItem[];
  itemCount: number;
  cartHash: string;
  status: AbandonedCartStatus;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  reminderSentAt?: string;
  lastReminderResponse?: unknown;
  shareToken?: string;
};

const CUSTOMER_DIR = path.join(os.tmpdir(), "afripay", "data", "customer");
const ABANDONED_CARTS_RUNTIME_PATH = path.join(CUSTOMER_DIR, "abandoned-carts.json");
const ABANDONED_CARTS_SEED_PATH = path.join(process.cwd(), "data", "customer", "abandoned-carts.json");
const ABANDONED_CARTS_BLOB_PATHNAME = "customer/abandoned-carts.json";
const BLOB_ACCESS_MODE = getVercelBlobAccessMode();

function canUseBlobStore() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function readJsonBlob<T>(pathname: string): Promise<T | null> {
  if (!canUseBlobStore()) {
    return null;
  }

  try {
    const blob = await get(pathname, {
      access: BLOB_ACCESS_MODE,
      useCache: false,
    });

    if (!blob?.stream) {
      return null;
    }

    const raw = await new Response(blob.stream).text();
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJsonBlob<T>(pathname: string, value: T) {
  if (!canUseBlobStore()) {
    return;
  }

  await put(pathname, `${JSON.stringify(value, null, 2)}\n`, {
    access: BLOB_ACCESS_MODE,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json; charset=utf-8",
  });
}

async function readJsonRuntimeFile<T>(runtimePath: string, seedPath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(runtimePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    try {
      const raw = await readFile(seedPath, "utf8");
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
}

async function writeJsonRuntimeFile<T>(runtimePath: string, value: T) {
  await mkdir(path.dirname(runtimePath), { recursive: true });
  await writeFile(runtimePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
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

    const slug = normalizeOptionalString(record.slug);
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
    });

    return items;
  }, []);
}

function toIsoString(value: unknown, fallback: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function buildCartHash(items: CartInputItem[]) {
  return JSON.stringify(
    [...items]
      .map((item) => ({
        slug: item.slug,
        quantity: item.quantity,
        selectedVariants: item.selectedVariants
          ? Object.fromEntries(Object.entries(item.selectedVariants).sort(([left], [right]) => left.localeCompare(right)))
          : undefined,
      }))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
  );
}

function normalizeRecord(value: unknown): AbandonedCartRecord | null {
  const record = typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
  if (!record) {
    return null;
  }

  const items = normalizeItems(record.items);
  const createdAt = toIsoString(record.createdAt, new Date().toISOString());
  const updatedAt = toIsoString(record.updatedAt, createdAt);
  const lastActivityAt = toIsoString(record.lastActivityAt, updatedAt);

  return {
    id: normalizeOptionalString(record.id) ?? randomUUID(),
    userId: normalizeOptionalString(record.userId) ?? "",
    userEmail: normalizeOptionalString(record.userEmail) ?? "",
    userDisplayName: normalizeOptionalString(record.userDisplayName) ?? "Client AfriPay",
    connectedWhatsapp: normalizeOptionalString(record.connectedWhatsapp),
    manychatSubscriberId: normalizeOptionalString(record.manychatSubscriberId),
    manychatFlowId: normalizeOptionalString(record.manychatFlowId),
    manychatPaidTagId: normalizeOptionalString(record.manychatPaidTagId),
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    cartHash: normalizeOptionalString(record.cartHash) ?? buildCartHash(items),
    status: record.status === "cleared" || record.status === "converted" ? record.status : "active",
    createdAt,
    updatedAt,
    lastActivityAt,
    reminderSentAt: normalizeOptionalString(record.reminderSentAt),
    lastReminderResponse: record.lastReminderResponse,
    shareToken: normalizeOptionalString(record.shareToken),
  };
}

async function readStore() {
  const blobValue = await readJsonBlob<AbandonedCartRecord[]>(ABANDONED_CARTS_BLOB_PATHNAME);
  if (blobValue) {
    return blobValue.map(normalizeRecord).filter((entry): entry is AbandonedCartRecord => Boolean(entry));
  }

  const value = await readJsonRuntimeFile<AbandonedCartRecord[]>(ABANDONED_CARTS_RUNTIME_PATH, ABANDONED_CARTS_SEED_PATH, []);
  return value.map(normalizeRecord).filter((entry): entry is AbandonedCartRecord => Boolean(entry));
}

async function writeStore(records: AbandonedCartRecord[]) {
  if (canUseBlobStore()) {
    await writeJsonBlob(ABANDONED_CARTS_BLOB_PATHNAME, records);
    return;
  }

  await writeJsonRuntimeFile(ABANDONED_CARTS_RUNTIME_PATH, records);
}

export async function getAbandonedCartRecords() {
  return readStore();
}

export async function upsertAbandonedCartRecord(input: {
  userId: string;
  userEmail: string;
  userDisplayName: string;
  connectedWhatsapp?: string;
  manychatSubscriberId?: string;
  manychatFlowId?: string;
  manychatPaidTagId?: string;
  items: CartInputItem[];
}) {
  const records = await readStore();
  const now = new Date().toISOString();
  const normalizedItems = normalizeItems(input.items);
  const itemCount = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartHash = buildCartHash(normalizedItems);
  const existing = records.find((entry) => entry.userId === input.userId);
  const shouldResetReminder = !existing || existing.cartHash !== cartHash || existing.status !== "active";

  const nextRecord: AbandonedCartRecord = {
    id: existing?.id ?? randomUUID(),
    userId: input.userId,
    userEmail: input.userEmail,
    userDisplayName: input.userDisplayName,
    connectedWhatsapp: input.connectedWhatsapp,
    manychatSubscriberId: input.manychatSubscriberId,
    manychatFlowId: input.manychatFlowId,
    manychatPaidTagId: input.manychatPaidTagId,
    items: normalizedItems,
    itemCount,
    cartHash,
    status: itemCount > 0 ? "active" : "cleared",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lastActivityAt: now,
    reminderSentAt: shouldResetReminder ? undefined : existing?.reminderSentAt,
    lastReminderResponse: shouldResetReminder ? undefined : existing?.lastReminderResponse,
    shareToken: shouldResetReminder ? undefined : existing?.shareToken,
  };

  const nextRecords = existing
    ? records.map((entry) => entry.userId === input.userId ? nextRecord : entry)
    : [...records, nextRecord];

  await writeStore(nextRecords);
  return nextRecord;
}

export async function markAbandonedCartRecordCleared(userId: string, status: AbandonedCartStatus = "cleared") {
  const records = await readStore();
  const nextRecords = records.map((entry) => entry.userId === userId
    ? {
        ...entry,
        status,
        items: [],
        itemCount: 0,
        updatedAt: new Date().toISOString(),
      }
    : entry);
  await writeStore(nextRecords);
  return nextRecords.find((entry) => entry.userId === userId) ?? null;
}

export async function markAbandonedCartReminderSent(input: {
  userId: string;
  response?: unknown;
  shareToken?: string;
}) {
  const records = await readStore();
  const timestamp = new Date().toISOString();
  const nextRecords = records.map((entry) => entry.userId === input.userId
    ? {
        ...entry,
        reminderSentAt: timestamp,
        updatedAt: timestamp,
        lastReminderResponse: input.response ?? entry.lastReminderResponse,
        shareToken: input.shareToken ?? entry.shareToken,
      }
    : entry);

  await writeStore(nextRecords);
  return nextRecords.find((entry) => entry.userId === input.userId) ?? null;
}
