import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { get, put } from "@vercel/blob";

import { getVercelBlobAccessMode } from "@/lib/vercel-blob-access";

export type AbandonedQuoteStatus = "active" | "cleared" | "submitted";

export type AbandonedQuoteRecord = {
  id: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  connectedWhatsapp?: string;
  manychatSubscriberId?: string;
  manychatFlowId?: string;
  productName: string;
  quantity: string;
  specifications: string;
  budget: string;
  shippingWindow: string;
  notes?: string;
  status: AbandonedQuoteStatus;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  reminderSentAt?: string;
  lastReminderResponse?: unknown;
};

const CUSTOMER_DIR = path.join(os.tmpdir(), "afripay", "data", "customer");
const ABANDONED_QUOTES_RUNTIME_PATH = path.join(CUSTOMER_DIR, "abandoned-quotes.json");
const ABANDONED_QUOTES_SEED_PATH = path.join(process.cwd(), "data", "customer", "abandoned-quotes.json");
const ABANDONED_QUOTES_BLOB_PATHNAME = "customer/abandoned-quotes.json";
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

function toIsoString(value: unknown, fallback: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function normalizeRecord(value: unknown): AbandonedQuoteRecord | null {
  const record = typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
  if (!record) {
    return null;
  }

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
    productName: normalizeOptionalString(record.productName) ?? "",
    quantity: normalizeOptionalString(record.quantity) ?? "",
    specifications: normalizeOptionalString(record.specifications) ?? "",
    budget: normalizeOptionalString(record.budget) ?? "",
    shippingWindow: normalizeOptionalString(record.shippingWindow) ?? "",
    notes: normalizeOptionalString(record.notes),
    status: record.status === "cleared" || record.status === "submitted" ? record.status : "active",
    createdAt,
    updatedAt,
    lastActivityAt,
    reminderSentAt: normalizeOptionalString(record.reminderSentAt),
    lastReminderResponse: record.lastReminderResponse,
  };
}

async function readStore() {
  const blobValue = await readJsonBlob<AbandonedQuoteRecord[]>(ABANDONED_QUOTES_BLOB_PATHNAME);
  if (blobValue) {
    return blobValue.map(normalizeRecord).filter((entry): entry is AbandonedQuoteRecord => Boolean(entry));
  }

  const value = await readJsonRuntimeFile<AbandonedQuoteRecord[]>(ABANDONED_QUOTES_RUNTIME_PATH, ABANDONED_QUOTES_SEED_PATH, []);
  return value.map(normalizeRecord).filter((entry): entry is AbandonedQuoteRecord => Boolean(entry));
}

async function writeStore(records: AbandonedQuoteRecord[]) {
  if (canUseBlobStore()) {
    await writeJsonBlob(ABANDONED_QUOTES_BLOB_PATHNAME, records);
    return;
  }

  await writeJsonRuntimeFile(ABANDONED_QUOTES_RUNTIME_PATH, records);
}

function buildDraftHash(input: {
  productName: string;
  quantity: string;
  specifications: string;
  budget: string;
  shippingWindow: string;
  notes?: string;
}) {
  return JSON.stringify({
    productName: input.productName.trim(),
    quantity: input.quantity.trim(),
    specifications: input.specifications.trim(),
    budget: input.budget.trim(),
    shippingWindow: input.shippingWindow.trim(),
    notes: input.notes?.trim() || "",
  });
}

export async function getAbandonedQuoteRecords() {
  return readStore();
}

export async function getUserAbandonedQuoteRecord(userId: string) {
  const records = await readStore();
  return records.find((entry) => entry.userId === userId) ?? null;
}

export async function upsertAbandonedQuoteRecord(input: {
  userId: string;
  userEmail: string;
  userDisplayName: string;
  connectedWhatsapp?: string;
  manychatSubscriberId?: string;
  manychatFlowId?: string;
  productName: string;
  quantity: string;
  specifications: string;
  budget: string;
  shippingWindow: string;
  notes?: string;
}) {
  const records = await readStore();
  const now = new Date().toISOString();
  const existing = records.find((entry) => entry.userId === input.userId);
  const nextDraftHash = buildDraftHash(input);
  const previousDraftHash = existing ? buildDraftHash(existing) : null;
  const hasMeaningfulDraft = Boolean(input.productName.trim() || input.quantity.trim() || input.specifications.trim() || input.notes?.trim());
  const shouldResetReminder = !existing || previousDraftHash !== nextDraftHash || existing.status !== "active";

  const nextRecord: AbandonedQuoteRecord = {
    id: existing?.id ?? randomUUID(),
    userId: input.userId,
    userEmail: input.userEmail,
    userDisplayName: input.userDisplayName,
    connectedWhatsapp: input.connectedWhatsapp,
    manychatSubscriberId: input.manychatSubscriberId,
    manychatFlowId: input.manychatFlowId,
    productName: input.productName.trim(),
    quantity: input.quantity.trim(),
    specifications: input.specifications.trim(),
    budget: input.budget.trim(),
    shippingWindow: input.shippingWindow.trim(),
    notes: input.notes?.trim() || undefined,
    status: hasMeaningfulDraft ? "active" : "cleared",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lastActivityAt: now,
    reminderSentAt: shouldResetReminder ? undefined : existing?.reminderSentAt,
    lastReminderResponse: shouldResetReminder ? undefined : existing?.lastReminderResponse,
  };

  const nextRecords = existing
    ? records.map((entry) => entry.userId === input.userId ? nextRecord : entry)
    : [...records, nextRecord];

  await writeStore(nextRecords);
  return nextRecord;
}

export async function markAbandonedQuoteRecordCleared(userId: string, status: AbandonedQuoteStatus = "cleared") {
  const records = await readStore();
  const nextRecords = records.map((entry) => entry.userId === userId
    ? {
        ...entry,
        status,
        productName: "",
        quantity: "",
        specifications: "",
        budget: "",
        shippingWindow: "",
        notes: undefined,
        updatedAt: new Date().toISOString(),
      }
    : entry);

  await writeStore(nextRecords);
  return nextRecords.find((entry) => entry.userId === userId) ?? null;
}

export async function markAbandonedQuoteReminderSent(input: {
  userId: string;
  response?: unknown;
}) {
  const records = await readStore();
  const timestamp = new Date().toISOString();
  const nextRecords = records.map((entry) => entry.userId === input.userId
    ? {
        ...entry,
        reminderSentAt: timestamp,
        updatedAt: timestamp,
        lastReminderResponse: input.response ?? entry.lastReminderResponse,
      }
    : entry);

  await writeStore(nextRecords);
  return nextRecords.find((entry) => entry.userId === input.userId) ?? null;
}
