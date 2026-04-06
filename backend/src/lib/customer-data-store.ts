import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { get, put } from "@vercel/blob";

import type { CustomerAddressRecord } from "@/lib/customer-addresses";
import { canonicalizeCountryCode } from "@/lib/country-utils";
import { hasConfiguredDatabaseUrl, prisma } from "@/lib/prisma";
import { getVercelBlobAccessMode } from "@/lib/vercel-blob-access";

const DATABASE_UNAVAILABLE_MESSAGE = "Le service de donnees n'est pas configure sur cette instance.";
const CUSTOMER_ADDRESSES_RUNTIME_PATH = path.join(os.tmpdir(), "afripay", "data", "account", "customer-addresses.json");
const CUSTOMER_ADDRESSES_SEED_PATH = path.join(process.cwd(), "data", "account", "customer-addresses.json");
const CUSTOMER_ADDRESSES_BLOB_PATHNAME = "account/customer-addresses.json";
const CUSTOMER_DATA_DIR = path.join(os.tmpdir(), "afripay", "data", "customer");
const QUOTE_REQUESTS_RUNTIME_PATH = path.join(CUSTOMER_DATA_DIR, "quote-requests.json");
const QUOTE_REQUESTS_SEED_PATH = path.join(process.cwd(), "data", "customer", "quote-requests.json");
const QUOTE_REQUESTS_BLOB_PATHNAME = "customer/quote-requests.json";
const SUPPORT_CONVERSATIONS_RUNTIME_PATH = path.join(CUSTOMER_DATA_DIR, "support-conversations.json");
const SUPPORT_CONVERSATIONS_SEED_PATH = path.join(process.cwd(), "data", "customer", "support-conversations.json");
const SUPPORT_CONVERSATIONS_BLOB_PATHNAME = "customer/support-conversations.json";
const BLOB_ACCESS_MODE = getVercelBlobAccessMode();

export type FavoriteRecord = {
  id: string;
  userId: string;
  userEmail: string;
  productSlug: string;
  createdAt: string;
};

export type QuoteRequestStatus = "En attente" | "En traitement" | "Complété" | "Rejeté";

export type QuoteRequestRecord = {
  id: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  productName: string;
  quantity: string;
  specifications: string;
  budget: string;
  shippingWindow: string;
  notes?: string;
  status: QuoteRequestStatus;
  createdAt: string;
  updatedAt: string;
};

export type SupportConversationStatus = "en ligne" | "en transit" | "dossier clos";
export type SupportConversationTab = "service" | "agents";

export type SupportConversationMessage = {
  id: string;
  side: "left" | "right";
  text: string;
  createdAt: string;
};

export type SupportConversationRecord = {
  id: string;
  userId: string;
  userEmail: string;
  tab: SupportConversationTab;
  name: string;
  email?: string;
  role: string;
  preview: string;
  time: string;
  status: SupportConversationStatus;
  aiEnabled?: boolean;
  orderId?: string;
  messages: SupportConversationMessage[];
  createdAt: string;
  updatedAt: string;
};

type CustomerAddressInput = {
  label: string;
  recipientName: string;
  phone: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode?: string;
  countryCode: string;
  isDefault?: boolean;
};

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

async function readCustomerAddressesFile() {
  const blobValue = await readJsonBlob<CustomerAddressRecord[]>(CUSTOMER_ADDRESSES_BLOB_PATHNAME);
  if (blobValue) {
    return blobValue;
  }

  return readJsonRuntimeFile<CustomerAddressRecord[]>(CUSTOMER_ADDRESSES_RUNTIME_PATH, CUSTOMER_ADDRESSES_SEED_PATH, []);
}

async function writeCustomerAddressesFile(addresses: CustomerAddressRecord[]) {
  if (canUseBlobStore()) {
    await writeJsonBlob(CUSTOMER_ADDRESSES_BLOB_PATHNAME, addresses);
    return;
  }

  await writeJsonRuntimeFile(CUSTOMER_ADDRESSES_RUNTIME_PATH, addresses);
}

async function readQuoteRequestsFile() {
  const blobValue = await readJsonBlob<QuoteRequestRecord[]>(QUOTE_REQUESTS_BLOB_PATHNAME);
  if (blobValue) {
    return blobValue;
  }

  return readJsonRuntimeFile<QuoteRequestRecord[]>(QUOTE_REQUESTS_RUNTIME_PATH, QUOTE_REQUESTS_SEED_PATH, []);
}

async function writeQuoteRequestsFile(requests: QuoteRequestRecord[]) {
  if (canUseBlobStore()) {
    await writeJsonBlob(QUOTE_REQUESTS_BLOB_PATHNAME, requests);
    return;
  }

  await writeJsonRuntimeFile(QUOTE_REQUESTS_RUNTIME_PATH, requests);
}

async function readSupportConversationsFile() {
  const blobValue = await readJsonBlob<SupportConversationRecord[]>(SUPPORT_CONVERSATIONS_BLOB_PATHNAME);
  if (blobValue) {
    return blobValue;
  }

  return readJsonRuntimeFile<SupportConversationRecord[]>(SUPPORT_CONVERSATIONS_RUNTIME_PATH, SUPPORT_CONVERSATIONS_SEED_PATH, []);
}

async function writeSupportConversationsFile(conversations: SupportConversationRecord[]) {
  if (canUseBlobStore()) {
    await writeJsonBlob(SUPPORT_CONVERSATIONS_BLOB_PATHNAME, conversations);
    return;
  }

  await writeJsonRuntimeFile(SUPPORT_CONVERSATIONS_RUNTIME_PATH, conversations);
}

function sortCustomerAddresses(addresses: CustomerAddressRecord[]) {
  return [...addresses].sort((left, right) => {
    if (left.isDefault === right.isDefault) {
      return right.updatedAt.localeCompare(left.updatedAt);
    }

    return left.isDefault ? -1 : 1;
  });
}

function toTimeLabel(isoDate: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoDate));
}

function toQuoteRequestStatus(value: string): QuoteRequestStatus {
  if (value === "En traitement" || value === "Complété" || value === "Rejeté") {
    return value;
  }

  return "En attente";
}

function toSupportConversationStatus(value: string): SupportConversationStatus {
  if (value === "en transit" || value === "dossier clos") {
    return value;
  }

  return "en ligne";
}

function toSupportConversationTab(value: string): SupportConversationTab {
  return value === "agents" ? "agents" : "service";
}

function mapConversation(record: {
  id: string;
  userId: string;
  user: { email: string };
  tab: string;
  name: string;
  email: string | null;
  role: string;
  preview: string;
  time: string;
  status: string;
  aiEnabled: boolean;
  orderId: string | null;
  createdAt: Date;
  updatedAt: Date;
  messages: Array<{ id: string; side: string; text: string; createdAt: Date }>;
}): SupportConversationRecord {
  return {
    id: record.id,
    userId: record.userId,
    userEmail: record.user.email,
    tab: toSupportConversationTab(record.tab),
    name: record.name,
    email: record.email ?? undefined,
    role: record.role,
    preview: record.preview,
    time: record.time,
    status: toSupportConversationStatus(record.status),
    aiEnabled: record.aiEnabled,
    orderId: record.orderId ?? undefined,
    messages: record.messages.map((message) => ({
      id: message.id,
      side: message.side === "right" ? "right" : "left",
      text: message.text,
      createdAt: message.createdAt.toISOString(),
    })),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapCustomerAddress(record: {
  id: string;
  userId: string;
  label: string;
  recipientName: string;
  phone: string;
  email: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string | null;
  countryCode: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}): CustomerAddressRecord {
  return {
    id: record.id,
    userId: record.userId,
    label: record.label,
    recipientName: record.recipientName,
    phone: record.phone,
    email: record.email ?? undefined,
    addressLine1: record.addressLine1,
    addressLine2: record.addressLine2 ?? undefined,
    city: record.city,
    state: record.state,
    postalCode: record.postalCode ?? undefined,
    countryCode: canonicalizeCountryCode(record.countryCode, "TG"),
    isDefault: record.isDefault,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function normalizeCustomerAddressInput(input: CustomerAddressInput) {
  return {
    label: input.label.trim(),
    recipientName: input.recipientName.trim(),
    phone: input.phone.trim(),
    email: input.email?.trim() || null,
    addressLine1: input.addressLine1.trim(),
    addressLine2: input.addressLine2?.trim() || null,
    city: input.city.trim(),
    state: input.state.trim(),
    postalCode: input.postalCode?.trim() || null,
    countryCode: canonicalizeCountryCode(input.countryCode, "TG"),
  };
}

function hasDatabase() {
  return hasConfiguredDatabaseUrl();
}

function createDatabaseUnavailableError() {
  return new Error(DATABASE_UNAVAILABLE_MESSAGE);
}

export async function getFavoriteRecords() {
  if (!hasDatabase()) {
    return [];
  }

  const records = await prisma.favorite.findMany({ include: { user: true }, orderBy: { createdAt: "desc" } });
  return records.map((record) => ({
    id: record.id,
    userId: record.userId,
    userEmail: record.user.email,
    productSlug: record.productSlug,
    createdAt: record.createdAt.toISOString(),
  }));
}

export async function getUserAddresses(userId: string) {
  if (!hasDatabase()) {
    const addresses = await readCustomerAddressesFile();
    return sortCustomerAddresses(addresses.filter((address) => address.userId === userId));
  }

  const addresses = await prisma.customerAddress.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });

  return addresses.map(mapCustomerAddress);
}

export async function getUserDefaultAddress(userId: string) {
  if (!hasDatabase()) {
    const addresses = await getUserAddresses(userId);
    return addresses.find((address) => address.isDefault);
  }

  const address = await prisma.customerAddress.findFirst({
    where: { userId, isDefault: true },
    orderBy: { updatedAt: "desc" },
  });

  return address ? mapCustomerAddress(address) : undefined;
}

export async function getUserAddressById(userId: string, addressId: string) {
  if (!hasDatabase()) {
    const addresses = await readCustomerAddressesFile();
    return addresses.find((address) => address.id === addressId && address.userId === userId);
  }

  const address = await prisma.customerAddress.findFirst({
    where: { id: addressId, userId },
  });

  return address ? mapCustomerAddress(address) : undefined;
}

export async function createUserAddress(userId: string, input: CustomerAddressInput) {
  if (!hasDatabase()) {
    const normalized = normalizeCustomerAddressInput(input);
    const addresses = await readCustomerAddressesFile();
    const userAddresses = addresses.filter((address) => address.userId === userId);
    const shouldBeDefault = Boolean(input.isDefault) || userAddresses.length === 0;
    const timestamp = new Date().toISOString();
    const nextAddress: CustomerAddressRecord = {
      id: crypto.randomUUID(),
      userId,
      label: normalized.label,
      recipientName: normalized.recipientName,
      phone: normalized.phone,
      email: normalized.email ?? undefined,
      addressLine1: normalized.addressLine1,
      addressLine2: normalized.addressLine2 ?? undefined,
      city: normalized.city,
      state: normalized.state,
      postalCode: normalized.postalCode ?? undefined,
      countryCode: normalized.countryCode,
      isDefault: shouldBeDefault,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const nextAddresses = shouldBeDefault
      ? addresses.map((address) => address.userId === userId ? { ...address, isDefault: false } : address)
      : addresses;

    await writeCustomerAddressesFile([nextAddress, ...nextAddresses]);
    return nextAddress;
  }

  const normalized = normalizeCustomerAddressInput(input);
  const hasAnyAddress = (await prisma.customerAddress.count({ where: { userId } })) > 0;
  const shouldBeDefault = input.isDefault || !hasAnyAddress;

  const address = await prisma.$transaction(async (transaction) => {
    if (shouldBeDefault) {
      await transaction.customerAddress.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return transaction.customerAddress.create({
      data: {
        userId,
        ...normalized,
        isDefault: shouldBeDefault,
      },
    });
  });

  return mapCustomerAddress(address);
}

export async function updateUserAddress(userId: string, addressId: string, input: CustomerAddressInput) {
  if (!hasDatabase()) {
    const addresses = await readCustomerAddressesFile();
    const existing = addresses.find((address) => address.id === addressId && address.userId === userId);

    if (!existing) {
      throw new Error("Adresse introuvable.");
    }

    const normalized = normalizeCustomerAddressInput(input);
    const userAddresses = addresses.filter((address) => address.userId === userId);
    const shouldBeDefault = Boolean(input.isDefault) || (existing.isDefault && !input.isDefault) || userAddresses.length === 1;
    const updatedAddress: CustomerAddressRecord = {
      ...existing,
      label: normalized.label,
      recipientName: normalized.recipientName,
      phone: normalized.phone,
      email: normalized.email ?? undefined,
      addressLine1: normalized.addressLine1,
      addressLine2: normalized.addressLine2 ?? undefined,
      city: normalized.city,
      state: normalized.state,
      postalCode: normalized.postalCode ?? undefined,
      countryCode: normalized.countryCode,
      isDefault: shouldBeDefault,
      updatedAt: new Date().toISOString(),
    };
    const nextAddresses = addresses.map((address) => {
      if (address.id === addressId && address.userId === userId) {
        return updatedAddress;
      }

      if (shouldBeDefault && address.userId === userId) {
        return { ...address, isDefault: false };
      }

      return address;
    });

    await writeCustomerAddressesFile(nextAddresses);
    return updatedAddress;
  }

  const existing = await prisma.customerAddress.findFirst({
    where: { id: addressId, userId },
  });

  if (!existing) {
    throw new Error("Adresse introuvable.");
  }

  const normalized = normalizeCustomerAddressInput(input);
  const addressCount = await prisma.customerAddress.count({ where: { userId } });
  const shouldBeDefault = input.isDefault || (existing.isDefault && !input.isDefault) || addressCount === 1;

  const address = await prisma.$transaction(async (transaction) => {
    if (shouldBeDefault) {
      await transaction.customerAddress.updateMany({
        where: { userId, isDefault: true, NOT: { id: addressId } },
        data: { isDefault: false },
      });
    }

    return transaction.customerAddress.update({
      where: { id: addressId },
      data: {
        ...normalized,
        isDefault: shouldBeDefault,
      },
    });
  });

  return mapCustomerAddress(address);
}

export async function setUserDefaultAddress(userId: string, addressId: string) {
  if (!hasDatabase()) {
    const addresses = await readCustomerAddressesFile();
    const existing = addresses.find((address) => address.id === addressId && address.userId === userId);

    if (!existing) {
      throw new Error("Adresse introuvable.");
    }

    const timestamp = new Date().toISOString();
    const nextAddresses = addresses.map((address) => {
      if (address.userId !== userId) {
        return address;
      }

      return {
        ...address,
        isDefault: address.id === addressId,
        updatedAt: address.id === addressId ? timestamp : address.updatedAt,
      };
    });
    const nextAddress = nextAddresses.find((address) => address.id === addressId && address.userId === userId);

    await writeCustomerAddressesFile(nextAddresses);
    if (!nextAddress) {
      throw new Error("Adresse introuvable.");
    }

    return nextAddress;
  }

  const existing = await prisma.customerAddress.findFirst({
    where: { id: addressId, userId },
  });

  if (!existing) {
    throw new Error("Adresse introuvable.");
  }

  const address = await prisma.$transaction(async (transaction) => {
    await transaction.customerAddress.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });

    return transaction.customerAddress.update({
      where: { id: addressId },
      data: { isDefault: true },
    });
  });

  return mapCustomerAddress(address);
}

export async function deleteUserAddress(userId: string, addressId: string) {
  if (!hasDatabase()) {
    const addresses = await readCustomerAddressesFile();
    const existing = addresses.find((address) => address.id === addressId && address.userId === userId);

    if (!existing) {
      throw new Error("Adresse introuvable.");
    }

    const remainingAddresses = addresses.filter((address) => !(address.id === addressId && address.userId === userId));
    if (existing.isDefault) {
      const nextDefault = sortCustomerAddresses(remainingAddresses.filter((address) => address.userId === userId))[0];
      if (nextDefault) {
        for (const address of remainingAddresses) {
          if (address.id === nextDefault.id && address.userId === userId) {
            address.isDefault = true;
            address.updatedAt = new Date().toISOString();
          }
        }
      }
    }

    await writeCustomerAddressesFile(remainingAddresses);
    return;
  }

  const existing = await prisma.customerAddress.findFirst({
    where: { id: addressId, userId },
  });

  if (!existing) {
    throw new Error("Adresse introuvable.");
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.customerAddress.delete({ where: { id: addressId } });

    if (!existing.isDefault) {
      return;
    }

    const nextAddress = await transaction.customerAddress.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });

    if (nextAddress) {
      await transaction.customerAddress.update({
        where: { id: nextAddress.id },
        data: { isDefault: true },
      });
    }
  });
}

export async function getUserFavoriteSlugs(userId: string) {
  const records = await getFavoriteRecords();
  return records.filter((record) => record.userId === userId).map((record) => record.productSlug);
}

export async function isUserFavoriteProduct(userId: string, productSlug: string) {
  if (!hasDatabase()) {
    return false;
  }

  const record = await prisma.favorite.findUnique({
    where: {
      userId_productSlug: {
        userId,
        productSlug,
      },
    },
    select: { id: true },
  });

  return Boolean(record);
}

export async function toggleUserFavorite(input: { userId: string; userEmail: string; productSlug: string }) {
  if (!hasDatabase()) {
    throw createDatabaseUnavailableError();
  }

  const existing = await prisma.favorite.findUnique({
    where: {
      userId_productSlug: {
        userId: input.userId,
        productSlug: input.productSlug,
      },
    },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return { isFavorite: false };
  }

  await prisma.favorite.create({
    data: {
      userId: input.userId,
      productSlug: input.productSlug,
    },
  });

  return { isFavorite: true };
}

export async function getQuoteRequests() {
  if (!hasDatabase()) {
    const requests = await readQuoteRequestsFile();
    return [...requests].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  const requests = await prisma.quoteRequest.findMany({ include: { user: true }, orderBy: { createdAt: "desc" } });
  return requests.map((request) => ({
    id: request.id,
    userId: request.userId,
    userEmail: request.user.email,
    userDisplayName: request.user.displayName,
    productName: request.productName,
    quantity: request.quantity,
    specifications: request.specifications,
    budget: request.budget,
    shippingWindow: request.shippingWindow,
    notes: request.notes ?? undefined,
    status: toQuoteRequestStatus(request.status),
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  }));
}

export async function getUserQuoteRequests(userId: string) {
  const requests = await getQuoteRequests();
  return requests.filter((request) => request.userId === userId).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function createQuoteRequest(input: {
  userId: string;
  userEmail: string;
  userDisplayName: string;
  productName: string;
  quantity: string;
  specifications: string;
  budget: string;
  shippingWindow: string;
  notes?: string;
}) {
  if (!hasDatabase()) {
    const requests = await readQuoteRequestsFile();
    const timestamp = new Date().toISOString();
    const request: QuoteRequestRecord = {
      id: crypto.randomUUID(),
      userId: input.userId,
      userEmail: input.userEmail,
      userDisplayName: input.userDisplayName,
      productName: input.productName.trim(),
      quantity: input.quantity.trim(),
      specifications: input.specifications.trim(),
      budget: input.budget.trim(),
      shippingWindow: input.shippingWindow.trim(),
      notes: input.notes?.trim() || undefined,
      status: "En attente",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await writeQuoteRequestsFile([request, ...requests]);
    return request;
  }

  const request = await prisma.quoteRequest.create({
    data: {
      userId: input.userId,
      productName: input.productName.trim(),
      quantity: input.quantity.trim(),
      specifications: input.specifications.trim(),
      budget: input.budget.trim(),
      shippingWindow: input.shippingWindow.trim(),
      notes: input.notes?.trim() || null,
      status: "En attente",
    },
    include: { user: true },
  });

  return {
    id: request.id,
    userId: request.userId,
    userEmail: request.user.email,
    userDisplayName: request.user.displayName,
    productName: request.productName,
    quantity: request.quantity,
    specifications: request.specifications,
    budget: request.budget,
    shippingWindow: request.shippingWindow,
    notes: request.notes ?? undefined,
    status: "En attente",
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  };
}

export async function getSupportConversations() {
  if (!hasDatabase()) {
    const conversations = await readSupportConversationsFile();
    return [...conversations].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  const conversations = await prisma.supportConversation.findMany({
    include: { user: true, messages: { orderBy: { createdAt: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });

  return conversations.map(mapConversation);
}

export async function getUserSupportConversations(userId: string) {
  const conversations = await getSupportConversations();
  return conversations.filter((conversation) => conversation.userId === userId).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function ensureDefaultSupportConversation(input: {
  userId: string;
  userEmail: string;
  userDisplayName: string;
}) {
  if (!hasDatabase()) {
    const conversations = await readSupportConversationsFile();
    const existing = conversations.find((conversation) => conversation.userId === input.userId && conversation.tab === "service" && !conversation.orderId);

    if (existing) {
      return existing;
    }

    const createdAt = new Date().toISOString();
    const conversation: SupportConversationRecord = {
      id: crypto.randomUUID(),
      userId: input.userId,
      userEmail: input.userEmail,
      tab: "service",
      name: "Support AfriPay",
      email: input.userEmail,
      role: `Support client pour ${input.userDisplayName}`,
      preview: "Bienvenue. Posez votre question et notre equipe prendra le relais.",
      time: toTimeLabel(createdAt),
      status: "en ligne",
      aiEnabled: false,
      messages: [
        {
          id: crypto.randomUUID(),
          side: "left",
          text: "Bienvenue sur votre espace support AfriPay. Vous pouvez poser ici vos questions sur vos commandes, devis, paiements et favoris.",
          createdAt,
        },
      ],
      createdAt,
      updatedAt: createdAt,
    };

    await writeSupportConversationsFile([conversation, ...conversations]);
    return conversation;
  }

  const conversations = await getSupportConversations();
  const existing = conversations.find((conversation) => conversation.userId === input.userId && conversation.tab === "service" && !conversation.orderId);

  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const conversation = await prisma.supportConversation.create({
    data: {
      userId: input.userId,
      tab: "service",
      name: "Support AfriPay",
      role: `Support client pour ${input.userDisplayName}`,
      preview: "Bienvenue. Posez votre question et notre equipe prendra le relais.",
      time: toTimeLabel(now),
      status: "en ligne",
      aiEnabled: false,
      messages: {
        create: {
          side: "left",
          text: "Bienvenue sur votre espace support AfriPay. Vous pouvez poser ici vos questions sur vos commandes, devis, paiements et favoris.",
        },
      },
    },
    include: { user: true, messages: { orderBy: { createdAt: "asc" } } },
  });

  return mapConversation(conversation);
}

export async function ensureOrderSupportConversation(input: {
  userId: string;
  userEmail: string;
  userDisplayName: string;
  orderId: string;
  orderLabel: string;
}) {
  if (!hasDatabase()) {
    const conversations = await readSupportConversationsFile();
    const existing = conversations.find((conversation) => conversation.userId === input.userId && conversation.orderId === input.orderId && conversation.tab === "service");

    if (existing) {
      return existing;
    }

    const createdAt = new Date().toISOString();
    const conversation: SupportConversationRecord = {
      id: crypto.randomUUID(),
      userId: input.userId,
      userEmail: input.userEmail,
      tab: "service",
      name: "Support commande",
      email: input.userEmail,
      role: `Suivi de ${input.orderLabel}`,
      preview: `Conversation ouverte pour ${input.orderLabel}.`,
      time: toTimeLabel(createdAt),
      status: "en ligne",
      aiEnabled: false,
      orderId: input.orderId,
      messages: [
        {
          id: crypto.randomUUID(),
          side: "left",
          text: `Votre conversation de suivi pour ${input.orderLabel} est ouverte. Notre equipe peut vous repondre ici.`,
          createdAt,
        },
      ],
      createdAt,
      updatedAt: createdAt,
    };

    await writeSupportConversationsFile([conversation, ...conversations]);
    return conversation;
  }

  const existing = await prisma.supportConversation.findFirst({
    where: {
      userId: input.userId,
      orderId: input.orderId,
      tab: "service",
    },
    include: { user: true, messages: { orderBy: { createdAt: "asc" } } },
  });

  if (existing) {
    return mapConversation(existing);
  }

  const now = new Date().toISOString();
  const conversation = await prisma.supportConversation.create({
    data: {
      userId: input.userId,
      orderId: input.orderId,
      tab: "service",
      name: "Support commande",
      role: `Suivi de ${input.orderLabel}`,
      preview: `Conversation ouverte pour ${input.orderLabel}.`,
      time: toTimeLabel(now),
      status: "en ligne",
      aiEnabled: false,
      messages: {
        create: {
          side: "left",
          text: `Votre conversation de suivi pour ${input.orderLabel} est ouverte. Notre equipe peut vous repondre ici.`,
        },
      },
    },
    include: { user: true, messages: { orderBy: { createdAt: "asc" } } },
  });

  return mapConversation(conversation);
}

export async function appendSupportConversationMessage(input: {
  userId: string;
  conversationId: string;
  text: string;
}) {
  if (!hasDatabase()) {
    const conversations = await readSupportConversationsFile();
    const conversation = conversations.find((entry) => entry.id === input.conversationId && entry.userId === input.userId);

    if (!conversation) {
      throw new Error("Conversation introuvable.");
    }

    const trimmedText = input.text.trim();
    if (!trimmedText) {
      throw new Error("Message vide.");
    }

    const now = new Date().toISOString();
    const nextConversation: SupportConversationRecord = {
      ...conversation,
      preview: trimmedText,
      time: toTimeLabel(now),
      updatedAt: now,
      messages: [
        ...conversation.messages,
        {
          id: crypto.randomUUID(),
          side: "right",
          text: trimmedText,
          createdAt: now,
        },
      ],
    };

    const nextConversations = conversations.map((entry) => entry.id === conversation.id ? nextConversation : entry);
    await writeSupportConversationsFile(nextConversations);
    return nextConversation;
  }

  const conversation = await prisma.supportConversation.findFirst({
    where: {
      id: input.conversationId,
      userId: input.userId,
    },
  });

  if (!conversation) {
    throw new Error("Conversation introuvable.");
  }

  const now = new Date().toISOString();
  await prisma.supportConversation.update({
    where: { id: conversation.id },
    data: {
      preview: input.text.trim(),
      time: toTimeLabel(now),
      messages: {
        create: {
          side: "right",
          text: input.text.trim(),
        },
      },
    },
  });

  const nextConversation = await prisma.supportConversation.findUnique({
    where: { id: conversation.id },
    include: { user: true, messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!nextConversation) {
    throw new Error("Conversation introuvable.");
  }

  return mapConversation(nextConversation);
}

export async function appendAdminSupportConversationMessage(input: {
  conversationId: string;
  text: string;
}) {
  if (!hasDatabase()) {
    const conversations = await readSupportConversationsFile();
    const conversation = conversations.find((entry) => entry.id === input.conversationId);

    if (!conversation) {
      throw new Error("Conversation introuvable.");
    }

    const trimmedText = input.text.trim();
    if (!trimmedText) {
      throw new Error("Message vide.");
    }

    const now = new Date().toISOString();
    const nextConversation: SupportConversationRecord = {
      ...conversation,
      preview: trimmedText,
      time: toTimeLabel(now),
      status: "en ligne",
      updatedAt: now,
      messages: [
        ...conversation.messages,
        {
          id: crypto.randomUUID(),
          side: "left",
          text: trimmedText,
          createdAt: now,
        },
      ],
    };

    const nextConversations = conversations.map((entry) => entry.id === conversation.id ? nextConversation : entry);
    await writeSupportConversationsFile(nextConversations);
    return nextConversation;
  }

  const conversation = await prisma.supportConversation.findUnique({
    where: { id: input.conversationId },
  });

  if (!conversation) {
    throw new Error("Conversation introuvable.");
  }

  const trimmedText = input.text.trim();
  if (!trimmedText) {
    throw new Error("Message vide.");
  }

  const now = new Date().toISOString();
  await prisma.supportConversation.update({
    where: { id: conversation.id },
    data: {
      preview: trimmedText,
      time: toTimeLabel(now),
      status: "en ligne",
      messages: {
        create: {
          side: "left",
          text: trimmedText,
        },
      },
    },
  });

  const nextConversation = await prisma.supportConversation.findUnique({
    where: { id: conversation.id },
    include: { user: true, messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!nextConversation) {
    throw new Error("Conversation introuvable.");
  }

  return mapConversation(nextConversation);
}

export async function appendOrderAutomationNotification(input: {
  userId?: string;
  orderId: string;
  orderLabel: string;
  text: string;
}) {
  if (!input.userId) {
    return null;
  }

  if (!hasDatabase()) {
    const conversation = await ensureOrderSupportConversation({
      userId: input.userId,
      userEmail: "support@afripay.local",
      userDisplayName: input.orderLabel,
      orderId: input.orderId,
      orderLabel: input.orderLabel,
    });

    return appendAdminSupportConversationMessage({
      conversationId: conversation.id,
      text: input.text,
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, displayName: true },
  });

  if (!user) {
    return null;
  }

  const conversation = await ensureOrderSupportConversation({
    userId: user.id,
    userEmail: user.email,
    userDisplayName: user.displayName,
    orderId: input.orderId,
    orderLabel: input.orderLabel,
  });

  return appendAdminSupportConversationMessage({
    conversationId: conversation.id,
    text: input.text,
  });
}
