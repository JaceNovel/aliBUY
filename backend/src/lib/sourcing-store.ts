import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAlibabaImportedProducts } from "@/lib/alibaba-operations-store";
import { getOrSetCatalogRuntimeCache, invalidateCatalogRuntimeCache } from "@/lib/catalog-runtime-cache";
import type {
  AlibabaCatalogMapping,
  AlibabaIntegrationLog,
  SourcingOrder,
  SourcingSeaContainer,
  SourcingSettings,
} from "@/lib/alibaba-sourcing";

const SOURCING_DIR = path.join(process.cwd(), "data", "sourcing");
const SETTINGS_PATH = path.join(SOURCING_DIR, "settings.json");
const ORDERS_PATH = path.join(SOURCING_DIR, "orders.json");
const CONTAINERS_PATH = path.join(SOURCING_DIR, "sea-containers.json");
const LOGS_PATH = path.join(SOURCING_DIR, "alibaba-logs.json");
const CATALOG_MAPPING_PATH = path.join(SOURCING_DIR, "catalog-mapping.json");

function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

async function ensureSourcingDir() {
  await mkdir(SOURCING_DIR, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  await ensureSourcingDir();

  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    await writeJsonFile(filePath, fallback);
    return fallback;
  }
}

async function writeJsonFile<T>(filePath: string, value: T) {
  await ensureSourcingDir();
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMappingDispatchLocation(candidate: unknown) {
  if (typeof candidate !== "string") {
    return "CN";
  }

  const normalized = candidate.trim().toUpperCase();
  if (!normalized) {
    return "CN";
  }

  return /^[A-Z]{2,3}$/.test(normalized) ? normalized : "CN";
}

function buildImplicitCatalogMappingFromImportedProduct(product: Awaited<ReturnType<typeof getAlibabaImportedProducts>>[number]): AlibabaCatalogMapping | null {
  if (!product.slug || !product.sourceProductId) {
    return null;
  }

  const rawPayload = isObjectRecord(product.rawPayload) ? product.rawPayload : null;
  const detail = isObjectRecord(rawPayload?.detail) ? rawPayload.detail : null;
  const firstSku = Array.isArray(detail?.skus) && detail.skus.length > 0 && isObjectRecord(detail.skus[0]) ? detail.skus[0] : null;
  const supplierCompanyId = product.supplierCompanyId
    ?? (typeof detail?.eCompanyId === "string" ? detail.eCompanyId : undefined)
    ?? (typeof rawPayload?.eCompanyId === "string" ? rawPayload.eCompanyId : undefined);

  if (!supplierCompanyId) {
    return null;
  }

  const skuId = typeof firstSku?.sku_id === "number"
    ? String(firstSku.sku_id)
    : typeof firstSku?.sku_id === "string"
      ? firstSku.sku_id
      : undefined;

  return {
    slug: product.slug,
    alibabaProductId: product.sourceProductId,
    supplierCompanyId,
    skuId,
    dispatchLocation: normalizeMappingDispatchLocation(detail?.shipping_from),
    shippingFromCountryCode: "CN",
  };
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  return Number(value ?? 0);
}

function toIsoString(value: unknown, fallback?: string) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  }

  return fallback ?? new Date().toISOString();
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }

  return value as Prisma.InputJsonValue;
}

function normalizeSettings(record: Record<string, unknown>): SourcingSettings {
  return {
    currencyCode: String(record.currencyCode ?? "XOF"),
    airRatePerKgFcfa: toNumber(record.airRatePerKgFcfa),
    airEstimatedDays: String(record.airEstimatedDays ?? "5-10 jours"),
    seaRealCostPerCbmFcfa: toNumber(record.seaRealCostPerCbmFcfa),
    seaSellRatePerCbmFcfa: toNumber(record.seaSellRatePerCbmFcfa),
    seaEstimatedDays: String(record.seaEstimatedDays ?? "20-40 jours"),
    freeAirThresholdFcfa: toNumber(record.freeAirThresholdFcfa),
    freeAirEnabled: Boolean(record.freeAirEnabled),
    airWeightThresholdKg: toNumber(record.airWeightThresholdKg),
    containerTargetCbm: toNumber(record.containerTargetCbm),
    defaultMarginMode: record.defaultMarginMode === "fixed" ? "fixed" : "percent",
    defaultMarginValue: toNumber(record.defaultMarginValue),
    updatedAt: toIsoString(record.updatedAt),
  };
}

function normalizeOrder(record: Record<string, unknown>): SourcingOrder {
  const orderItems = Array.isArray(record.items) ? record.items : [];

  return {
    id: String(record.id),
    orderNumber: String(record.orderNumber),
    userId: record.userId ? String(record.userId) : undefined,
    customerAddressId: record.customerAddressId ? String(record.customerAddressId) : undefined,
    customerName: String(record.customerName),
    customerEmail: String(record.customerEmail),
    customerPhone: String(record.customerPhone),
    addressLine1: String(record.addressLine1),
    addressLine2: record.addressLine2 ? String(record.addressLine2) : undefined,
    city: String(record.city),
    state: String(record.state),
    postalCode: record.postalCode ? String(record.postalCode) : undefined,
    countryCode: String(record.countryCode),
    shippingMethod: record.shippingMethod === "sea" ? "sea" : record.shippingMethod === "freight" ? "freight" : "air",
    shippingCostFcfa: toNumber(record.shippingCostFcfa),
    cartProductsTotalFcfa: toNumber(record.cartProductsTotalFcfa),
    totalPriceFcfa: toNumber(record.totalPriceFcfa),
    totalWeightKg: toNumber(record.totalWeightKg),
    totalVolumeCbm: toNumber(record.totalVolumeCbm),
    status: String(record.status) as SourcingOrder["status"],
    freightStatus: String(record.freightStatus) as SourcingOrder["freightStatus"],
    supplierOrderStatus: String(record.supplierOrderStatus) as SourcingOrder["supplierOrderStatus"],
    paymentStatus: String(record.paymentStatus ?? "unpaid") as SourcingOrder["paymentStatus"],
    paymentProvider: record.paymentProvider === "moneroo" ? "moneroo" : undefined,
    paymentCurrency: String(record.paymentCurrency ?? "XOF"),
    alibabaTradeIds: Array.isArray(record.alibabaTradeIds) ? record.alibabaTradeIds.map((item) => String(item)) : [],
    freightPayload: record.freightPayload,
    supplierOrderPayload: record.supplierOrderPayload,
    monerooPaymentId: record.monerooPaymentId ? String(record.monerooPaymentId) : undefined,
    monerooCheckoutUrl: record.monerooCheckoutUrl ? String(record.monerooCheckoutUrl) : undefined,
    monerooPaymentStatus: record.monerooPaymentStatus ? String(record.monerooPaymentStatus) : undefined,
    monerooPaymentPayload: record.monerooPaymentPayload,
    monerooInitializedAt: record.monerooInitializedAt ? toIsoString(record.monerooInitializedAt) : undefined,
    monerooVerifiedAt: record.monerooVerifiedAt ? toIsoString(record.monerooVerifiedAt) : undefined,
    paidAt: record.paidAt ? toIsoString(record.paidAt) : undefined,
    containerId: record.containerId ? String(record.containerId) : undefined,
    notes: record.notes ? String(record.notes) : undefined,
    createdAt: toIsoString(record.createdAt),
    updatedAt: toIsoString(record.updatedAt),
    items: orderItems.map((item) => {
      const recordItem = item as Record<string, unknown>;
      const rawTitle = typeof recordItem.title === "string" && recordItem.title.trim().length > 0
        ? recordItem.title
        : typeof recordItem.productName === "string" && recordItem.productName.trim().length > 0
          ? recordItem.productName
          : typeof recordItem.name === "string" && recordItem.name.trim().length > 0
            ? recordItem.name
            : "Produit sourcing";

      return {
        slug: String(recordItem.slug ?? recordItem.productSlug ?? "unknown-product"),
        title: rawTitle,
        quantity: toNumber(recordItem.quantity),
        weightKg: toNumber(recordItem.weightKg),
        volumeCbm: toNumber(recordItem.volumeCbm),
        supplierPriceFcfa: toNumber(recordItem.supplierPriceFcfa),
        marginMode: recordItem.marginMode === "fixed" ? "fixed" : "percent",
        marginValue: toNumber(recordItem.marginValue),
        marginAmountFcfa: toNumber(recordItem.marginAmountFcfa),
        finalUnitPriceFcfa: toNumber(recordItem.finalUnitPriceFcfa),
        finalLinePriceFcfa: toNumber(recordItem.finalLinePriceFcfa),
        image: String(recordItem.image ?? ""),
      };
    }),
  };
}

function normalizeContainer(record: Record<string, unknown>): SourcingSeaContainer {
  return {
    id: String(record.id),
    code: String(record.code),
    targetCbm: toNumber(record.targetCbm),
    currentCbm: toNumber(record.currentCbm),
    fillPercent: toNumber(record.fillPercent),
    status: String(record.status) as SourcingSeaContainer["status"],
    orderIds: Array.isArray(record.orderIds) ? record.orderIds.map((item) => String(item)) : [],
    orderCount: toNumber(record.orderCount),
    createdAt: toIsoString(record.createdAt),
    updatedAt: toIsoString(record.updatedAt),
    readyToShipAt: record.readyToShipAt ? toIsoString(record.readyToShipAt) : undefined,
    shipmentTriggeredAt: record.shipmentTriggeredAt ? toIsoString(record.shipmentTriggeredAt) : undefined,
  };
}

function normalizeLog(record: Record<string, unknown>): AlibabaIntegrationLog {
  return {
    id: String(record.id),
    orderId: record.orderId ? String(record.orderId) : undefined,
    action: String(record.action),
    endpoint: String(record.endpoint),
    status: String(record.status),
    requestBody: record.requestBody,
    responseBody: record.responseBody,
    createdAt: toIsoString(record.createdAt),
  };
}

export async function getSourcingSettings() {
  return getOrSetCatalogRuntimeCache("sourcing-settings", 20_000, async () => {
    if (hasDatabase()) {
      const record = await prisma.sourcingSettings.findFirst({ orderBy: { updatedAt: "desc" } });
      if (record) {
        return normalizeSettings(record as unknown as Record<string, unknown>);
      }
    }

    return normalizeSettings(await readJsonFile<Record<string, unknown>>(SETTINGS_PATH, {
      currencyCode: "XOF",
      airRatePerKgFcfa: 10000,
      airEstimatedDays: "5-10 jours",
      seaRealCostPerCbmFcfa: 180000,
      seaSellRatePerCbmFcfa: 210000,
      seaEstimatedDays: "20-40 jours",
      freeAirThresholdFcfa: 15000,
      freeAirEnabled: true,
      airWeightThresholdKg: 1,
      containerTargetCbm: 1,
      defaultMarginMode: "percent",
      defaultMarginValue: 10,
      updatedAt: new Date().toISOString(),
    }));
  });
}

export async function saveSourcingSettings(settings: SourcingSettings) {
  const normalized = { ...settings, updatedAt: new Date().toISOString() };

  if (hasDatabase()) {
    const existing = await prisma.sourcingSettings.findFirst({ orderBy: { updatedAt: "desc" } });
    if (existing) {
      await prisma.sourcingSettings.update({
        where: { id: existing.id },
        data: {
          currencyCode: normalized.currencyCode,
          airRatePerKgFcfa: normalized.airRatePerKgFcfa,
          airEstimatedDays: normalized.airEstimatedDays,
          seaRealCostPerCbmFcfa: normalized.seaRealCostPerCbmFcfa,
          seaSellRatePerCbmFcfa: normalized.seaSellRatePerCbmFcfa,
          seaEstimatedDays: normalized.seaEstimatedDays,
          freeAirThresholdFcfa: normalized.freeAirThresholdFcfa,
          freeAirEnabled: normalized.freeAirEnabled,
          airWeightThresholdKg: normalized.airWeightThresholdKg,
          containerTargetCbm: normalized.containerTargetCbm,
          defaultMarginMode: normalized.defaultMarginMode,
          defaultMarginValue: normalized.defaultMarginValue,
        },
      });
    } else {
      await prisma.sourcingSettings.create({ data: normalized });
    }

    invalidateCatalogRuntimeCache();
    return normalized;
  }

  await writeJsonFile(SETTINGS_PATH, normalized);
  invalidateCatalogRuntimeCache();
  return normalized;
}

export async function getSourcingOrders() {
  return getOrSetCatalogRuntimeCache("sourcing-orders", 20_000, async () => {
    if (hasDatabase()) {
      const records = await prisma.sourcingOrder.findMany({ include: { items: true }, orderBy: { createdAt: "desc" } });
      return records.map((record) => normalizeOrder(record as unknown as Record<string, unknown>));
    }

    const records = await readJsonFile<Record<string, unknown>[]>(ORDERS_PATH, []);
    return records.map(normalizeOrder).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  });
}

export async function getSourcingOrderById(orderId: string) {
  if (!orderId) {
    return null;
  }

  if (hasDatabase()) {
    const record = await prisma.sourcingOrder.findUnique({ where: { id: orderId }, include: { items: true } });
    return record ? normalizeOrder(record as unknown as Record<string, unknown>) : null;
  }

  const orders = await getSourcingOrders();
  return orders.find((entry) => entry.id === orderId) ?? null;
}

export async function getSourcingOrderByMonerooPaymentId(paymentId: string) {
  if (!paymentId) {
    return null;
  }

  if (hasDatabase()) {
    const record = await prisma.sourcingOrder.findFirst({ where: { monerooPaymentId: paymentId }, include: { items: true } });
    return record ? normalizeOrder(record as unknown as Record<string, unknown>) : null;
  }

  const orders = await getSourcingOrders();
  return orders.find((entry) => entry.monerooPaymentId === paymentId) ?? null;
}

export async function saveSourcingOrder(order: SourcingOrder) {
  if (hasDatabase()) {
    await prisma.sourcingOrder.upsert({
      where: { id: order.id },
      update: {
        userId: order.userId ?? null,
        customerAddressId: order.customerAddressId ?? null,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        addressLine1: order.addressLine1,
        addressLine2: order.addressLine2,
        city: order.city,
        state: order.state,
        postalCode: order.postalCode,
        countryCode: order.countryCode,
        shippingMethod: order.shippingMethod,
        shippingCostFcfa: order.shippingCostFcfa,
        cartProductsTotalFcfa: order.cartProductsTotalFcfa,
        totalPriceFcfa: order.totalPriceFcfa,
        totalWeightKg: order.totalWeightKg,
        totalVolumeCbm: order.totalVolumeCbm,
        status: order.status,
        freightStatus: order.freightStatus,
        supplierOrderStatus: order.supplierOrderStatus,
        paymentStatus: order.paymentStatus,
        paymentProvider: order.paymentProvider,
        paymentCurrency: order.paymentCurrency,
        alibabaTradeIds: order.alibabaTradeIds,
        freightPayload: toPrismaJson(order.freightPayload),
        supplierOrderPayload: toPrismaJson(order.supplierOrderPayload),
        monerooPaymentId: order.monerooPaymentId,
        monerooCheckoutUrl: order.monerooCheckoutUrl,
        monerooPaymentStatus: order.monerooPaymentStatus,
        monerooPaymentPayload: toPrismaJson(order.monerooPaymentPayload),
        monerooInitializedAt: order.monerooInitializedAt ? new Date(order.monerooInitializedAt) : null,
        monerooVerifiedAt: order.monerooVerifiedAt ? new Date(order.monerooVerifiedAt) : null,
        paidAt: order.paidAt ? new Date(order.paidAt) : null,
        notes: order.notes,
        containerId: order.containerId,
        items: {
          deleteMany: {},
          create: order.items.map((item) => ({
            productSlug: item.slug,
            productName: item.title,
            quantity: item.quantity,
            supplierPriceFcfa: item.supplierPriceFcfa,
            marginMode: item.marginMode,
            marginValue: item.marginValue,
            marginAmountFcfa: item.marginAmountFcfa,
            finalUnitPriceFcfa: item.finalUnitPriceFcfa,
            finalLinePriceFcfa: item.finalLinePriceFcfa,
            weightKg: item.weightKg,
            volumeCbm: item.volumeCbm,
            image: item.image,
          })),
        },
      },
      create: {
        id: order.id,
        orderNumber: order.orderNumber,
        userId: order.userId ?? null,
        customerAddressId: order.customerAddressId ?? null,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        addressLine1: order.addressLine1,
        addressLine2: order.addressLine2,
        city: order.city,
        state: order.state,
        postalCode: order.postalCode,
        countryCode: order.countryCode,
        shippingMethod: order.shippingMethod,
        shippingCostFcfa: order.shippingCostFcfa,
        cartProductsTotalFcfa: order.cartProductsTotalFcfa,
        totalPriceFcfa: order.totalPriceFcfa,
        totalWeightKg: order.totalWeightKg,
        totalVolumeCbm: order.totalVolumeCbm,
        status: order.status,
        freightStatus: order.freightStatus,
        supplierOrderStatus: order.supplierOrderStatus,
        paymentStatus: order.paymentStatus,
        paymentProvider: order.paymentProvider,
        paymentCurrency: order.paymentCurrency,
        alibabaTradeIds: order.alibabaTradeIds,
        freightPayload: toPrismaJson(order.freightPayload),
        supplierOrderPayload: toPrismaJson(order.supplierOrderPayload),
        monerooPaymentId: order.monerooPaymentId,
        monerooCheckoutUrl: order.monerooCheckoutUrl,
        monerooPaymentStatus: order.monerooPaymentStatus,
        monerooPaymentPayload: toPrismaJson(order.monerooPaymentPayload),
        monerooInitializedAt: order.monerooInitializedAt ? new Date(order.monerooInitializedAt) : null,
        monerooVerifiedAt: order.monerooVerifiedAt ? new Date(order.monerooVerifiedAt) : null,
        paidAt: order.paidAt ? new Date(order.paidAt) : null,
        notes: order.notes,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        containerId: order.containerId,
        items: {
          create: order.items.map((item) => ({
            productSlug: item.slug,
            productName: item.title,
            quantity: item.quantity,
            supplierPriceFcfa: item.supplierPriceFcfa,
            marginMode: item.marginMode,
            marginValue: item.marginValue,
            marginAmountFcfa: item.marginAmountFcfa,
            finalUnitPriceFcfa: item.finalUnitPriceFcfa,
            finalLinePriceFcfa: item.finalLinePriceFcfa,
            weightKg: item.weightKg,
            volumeCbm: item.volumeCbm,
            image: item.image,
          })),
        },
      },
    });

    invalidateCatalogRuntimeCache();
    return order;
  }

  const orders = await getSourcingOrders();
  const nextOrders = orders.some((entry) => entry.id === order.id)
    ? orders.map((entry) => entry.id === order.id ? order : entry)
    : [order, ...orders];
  await writeJsonFile(ORDERS_PATH, nextOrders);
  invalidateCatalogRuntimeCache();
  return order;
}

export async function getUserSourcingOrders(input: { userId: string; email: string }) {
  const orders = await getSourcingOrders();
  const normalizedEmail = input.email.trim().toLowerCase();

  return orders.filter((order) => order.userId === input.userId || order.customerEmail.trim().toLowerCase() === normalizedEmail);
}

export async function getSourcingSeaContainers() {
  return getOrSetCatalogRuntimeCache("sourcing-sea-containers", 20_000, async () => {
    if (hasDatabase()) {
      const records = await prisma.sourcingSeaContainer.findMany({ orderBy: { createdAt: "desc" } });
      return records.map((record) => normalizeContainer(record as unknown as Record<string, unknown>));
    }

    const records = await readJsonFile<Record<string, unknown>[]>(CONTAINERS_PATH, []);
    return records.map(normalizeContainer).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  });
}

export async function saveSourcingSeaContainer(container: SourcingSeaContainer) {
  if (hasDatabase()) {
    await prisma.sourcingSeaContainer.upsert({
      where: { id: container.id },
      update: {
        code: container.code,
        targetCbm: container.targetCbm,
        currentCbm: container.currentCbm,
        fillPercent: container.fillPercent,
        status: container.status,
        orderCount: container.orderCount,
        readyToShipAt: container.readyToShipAt,
        shipmentTriggeredAt: container.shipmentTriggeredAt,
      },
      create: {
        id: container.id,
        code: container.code,
        targetCbm: container.targetCbm,
        currentCbm: container.currentCbm,
        fillPercent: container.fillPercent,
        status: container.status,
        orderCount: container.orderCount,
        createdAt: container.createdAt,
        updatedAt: container.updatedAt,
        readyToShipAt: container.readyToShipAt,
        shipmentTriggeredAt: container.shipmentTriggeredAt,
      },
    });

    invalidateCatalogRuntimeCache();
    return container;
  }

  const containers = await getSourcingSeaContainers();
  const nextContainers = containers.some((entry) => entry.id === container.id)
    ? containers.map((entry) => entry.id === container.id ? container : entry)
    : [container, ...containers];
  await writeJsonFile(CONTAINERS_PATH, nextContainers);
  invalidateCatalogRuntimeCache();
  return container;
}

export async function getAlibabaIntegrationLogs() {
  if (hasDatabase()) {
    const records = await prisma.alibabaIntegrationLog.findMany({ orderBy: { createdAt: "desc" } });
    return records.map((record) => normalizeLog(record as unknown as Record<string, unknown>));
  }

  const records = await readJsonFile<Record<string, unknown>[]>(LOGS_PATH, []);
  return records.map(normalizeLog).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function createAlibabaIntegrationLog(input: Omit<AlibabaIntegrationLog, "id" | "createdAt">) {
  const log: AlibabaIntegrationLog = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
  };

  if (hasDatabase()) {
    await prisma.alibabaIntegrationLog.create({
      data: {
        ...log,
        requestBody: toPrismaJson(log.requestBody),
        responseBody: toPrismaJson(log.responseBody),
      },
    });

    return log;
  }

  const logs = await getAlibabaIntegrationLogs();
  await writeJsonFile(LOGS_PATH, [log, ...logs]);
  return log;
}

export async function getAlibabaCatalogMappings() {
  const [explicitMappings, importedProducts] = await Promise.all([
    readJsonFile<AlibabaCatalogMapping[]>(CATALOG_MAPPING_PATH, []),
    getAlibabaImportedProducts(),
  ]);
  const mergedMappings = new Map<string, AlibabaCatalogMapping>();

  for (const product of importedProducts) {
    const implicitMapping = buildImplicitCatalogMappingFromImportedProduct(product);
    if (implicitMapping) {
      mergedMappings.set(implicitMapping.slug, implicitMapping);
    }
  }

  for (const mapping of explicitMappings) {
    mergedMappings.set(mapping.slug, mapping);
  }

  return [...mergedMappings.values()];
}

export function createSourcingIds() {
  return randomUUID();
}