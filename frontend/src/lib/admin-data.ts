import "server-only";

import { cookies, headers } from "next/headers";

import { API_URL } from "@/lib/api";
import { createAuthenticatedUserSession, getCurrentUser } from "@/lib/user-auth";
import { getAlibabaImportedProducts } from "@/lib/alibaba-operations-store";
import { getSourcingOrderMeta, type SourcingOrder } from "@/lib/alibaba-sourcing";
import { getDeliveryNoteDocumentNumber, getDeliveryNoteExportHistory } from "@/lib/admin-sourcing-delivery-note-data";
import type { AdminOrderParcelItem, AdminOrderParcelPhoto, AdminOrderParcelSnapshot } from "@/lib/admin-order-parcel";
import { getCatalogCategories } from "@/lib/catalog-category-service";
import { getCatalogProducts } from "@/lib/catalog-service";
import { getQuoteRequests, getSupportConversations, getUserAddresses, getUserFavoriteSlugs, getUserSupportConversations } from "@/lib/customer-data-store";
import { buildServerForwardHeaders } from "@/lib/server-forward-headers";
import { SITE_URL } from "@/lib/site-config";
import { getSourcingOrders } from "@/lib/sourcing-store";
import { USER_SESSION_COOKIE } from "@/lib/user-session";
import { getStoredUserById, getStoredUsers } from "@/lib/user-store";

type AdminStoredUser = Awaited<ReturnType<typeof getStoredUsers>>[number];
type AdminSourcingOrder = Awaited<ReturnType<typeof getSourcingOrders>>[number];
type AdminQuoteRecord = Awaited<ReturnType<typeof getQuoteRequests>>[number];
type AdminSupportConversation = Awaited<ReturnType<typeof getSupportConversations>>[number];
type AdminUserSupportConversation = Awaited<ReturnType<typeof getUserSupportConversations>>[number];
type AdminCatalogProduct = Awaited<ReturnType<typeof getCatalogProducts>>[number];

function hasExternalAdminApi() {
  if (!API_URL) {
    return false;
  }

  try {
    return new URL(API_URL).host !== new URL(SITE_URL).host;
  } catch {
    return false;
  }
}

async function buildAdminProxyUrl(path: string) {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") || "https";
  const origin = host ? `${proto}://${host}` : SITE_URL;

  return new URL(path, origin).toString();
}

async function fetchAdminOrdersFromApi() {
  const sessionToken = (await cookies()).get(USER_SESSION_COOKIE)?.value
    ?? await getCurrentUser().then((user) => user ? createAuthenticatedUserSession(user) : null).catch(() => null);
  if (!sessionToken) {
    return null;
  }

  const response = await fetch(`${API_URL}/api/admin/orders`, {
    headers: await buildServerForwardHeaders({
      accept: "application/json",
    }, {
      includeAdminApiToken: true,
    }),
    cache: "no-store",
  }).catch(() => null);
  const fallbackResponse = response && response.ok
    ? response
    : await fetch(await buildAdminProxyUrl("/api/admin/orders"), {
    headers: {
      Cookie: `${USER_SESSION_COOKIE}=${encodeURIComponent(sessionToken)}`,
    },
    cache: "no-store",
  }).catch(() => null);

  if (!fallbackResponse?.ok) {
    return null;
  }

  const payload = await fallbackResponse.json().catch(() => null) as { orders?: unknown[] } | null;
  if (!Array.isArray(payload?.orders)) {
    return null;
  }

  return payload.orders.map((order) => normalizeAdminOrderFromApi(order)).filter((order): order is AdminOrderRecord => Boolean(order));
}

async function fetchAdminOrderByIdFromApi(orderId: string) {
  const sessionToken = (await cookies()).get(USER_SESSION_COOKIE)?.value
    ?? await getCurrentUser().then((user) => user ? createAuthenticatedUserSession(user) : null).catch(() => null);
  if (!sessionToken) {
    return null;
  }

  const response = await fetch(`${API_URL}/api/admin/orders/${encodeURIComponent(orderId)}`, {
    headers: await buildServerForwardHeaders({
      accept: "application/json",
    }, {
      includeAdminApiToken: true,
    }),
    cache: "no-store",
  }).catch(() => null);
  const fallbackResponse = response && response.ok
    ? response
    : await fetch(await buildAdminProxyUrl(`/api/admin/orders/${encodeURIComponent(orderId)}`), {
    headers: {
      Cookie: `${USER_SESSION_COOKIE}=${encodeURIComponent(sessionToken)}`,
    },
    cache: "no-store",
  }).catch(() => null);

  if (!fallbackResponse?.ok) {
    return null;
  }

  const payload = await fallbackResponse.json().catch(() => null) as { order?: unknown } | null;
  return normalizeSourcingOrderFromApi(payload?.order);
}

async function fetchAdminUsersOverviewFromApi() {
  const sessionToken = (await cookies()).get(USER_SESSION_COOKIE)?.value
    ?? await getCurrentUser().then((user) => user ? createAuthenticatedUserSession(user) : null).catch(() => null);
  if (!sessionToken) {
    return null;
  }

  const response = API_URL
    ? await fetch(`${API_URL}/api/admin/users`, {
      headers: await buildServerForwardHeaders({
        accept: "application/json",
      }, {
        includeAdminApiToken: true,
      }),
      cache: "no-store",
    }).catch(() => null)
    : null;
  const fallbackResponse = response && response.ok
    ? response
    : await fetch(await buildAdminProxyUrl("/api/admin/users"), {
      headers: {
        Cookie: `${USER_SESSION_COOKIE}=${encodeURIComponent(sessionToken)}`,
      },
      cache: "no-store",
    }).catch(() => null);

  if (!fallbackResponse?.ok) {
    return null;
  }

  const payload = await fallbackResponse.json().catch(() => null) as { users?: unknown[] } | null;
  if (!Array.isArray(payload?.users)) {
    return null;
  }

  return payload.users.map((user) => normalizeAdminUserFromApi(user)).filter((user): user is AdminUserRecord => Boolean(user));
}

async function fetchAdminUserDetailFromApi(userId: string) {
  const sessionToken = (await cookies()).get(USER_SESSION_COOKIE)?.value
    ?? await getCurrentUser().then((user) => user ? createAuthenticatedUserSession(user) : null).catch(() => null);
  if (!sessionToken) {
    return null;
  }

  const response = API_URL
    ? await fetch(`${API_URL}/api/admin/users/${encodeURIComponent(userId)}`, {
      headers: await buildServerForwardHeaders({
        accept: "application/json",
      }, {
        includeAdminApiToken: true,
      }),
      cache: "no-store",
    }).catch(() => null)
    : null;
  const fallbackResponse = response && response.ok
    ? response
    : await fetch(await buildAdminProxyUrl(`/api/admin/users/${encodeURIComponent(userId)}`), {
      headers: {
        Cookie: `${USER_SESSION_COOKIE}=${encodeURIComponent(sessionToken)}`,
      },
      cache: "no-store",
    }).catch(() => null);

  if (!fallbackResponse?.ok) {
    return null;
  }

  const payload = await fallbackResponse.json().catch(() => null) as {
    user?: unknown;
    addresses?: unknown[];
    orders?: unknown[];
  } | null;
  if (!payload?.user) {
    return null;
  }

  const user = normalizeAdminUserFromApi(payload.user);
  if (!user) {
    return null;
  }

  return {
    user,
    addresses: Array.isArray(payload.addresses)
      ? payload.addresses.map((address) => normalizeAdminUserAddressFromApi(address)).filter((address): address is AdminUserAddressRecord => Boolean(address))
      : [],
    orders: Array.isArray(payload.orders)
      ? payload.orders.map((order) => normalizeAdminUserDetailOrderFromApi(order)).filter((order): order is AdminUserOrderDetailRecord => Boolean(order))
      : [],
    quotes: [],
    conversations: [],
    favorites: [],
  } satisfies AdminUserDetailRecord;
}

function normalizeAdminOrderFromApi(order: unknown): AdminOrderRecord | null {
  if (!isObjectRecord(order)) {
    return null;
  }

  const id = typeof order.id === "string" || typeof order.id === "number" ? String(order.id) : "";
  const orderNumber = typeof order.orderNumber === "string" ? order.orderNumber : id;
  const items = Array.isArray(order.items) ? order.items : [];
  const firstItem = items[0];
  const firstItemTitle = isObjectRecord(firstItem)
    ? (typeof firstItem.title === "string" ? firstItem.title : typeof firstItem.productName === "string" ? firstItem.productName : "")
    : "";
  const totalPriceFcfa = typeof order.totalPriceFcfa === "number"
    ? order.totalPriceFcfa
    : typeof order.totalPriceFcfa === "string"
      ? Number(order.totalPriceFcfa)
      : 0;

  return {
    id,
    orderNumber,
    documentNumber: orderNumber,
    pdfExportsCount: 0,
    customerName: typeof order.customerName === "string" ? order.customerName : "Client",
    customerEmail: typeof order.customerEmail === "string" ? order.customerEmail : "",
    customerPhone: typeof order.customerPhone === "string" ? order.customerPhone : "",
    productTitle: firstItemTitle || `Commande ${orderNumber}`,
    shippingMethod: typeof order.shippingMethod === "string" ? order.shippingMethod : "air",
    paymentStatus: typeof order.paymentStatus === "string" ? order.paymentStatus : "pending",
    status: typeof order.status === "string" ? order.status : "pending",
    countryCode: typeof order.countryCode === "string" ? order.countryCode : "",
    addressLine: [order.addressLine1, order.addressLine2, order.city, order.state, order.postalCode]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join(", "),
    totalUsd: convertFcfaToUsd(Number.isFinite(totalPriceFcfa) ? totalPriceFcfa : 0),
    createdAt: typeof order.createdAt === "string" ? order.createdAt : new Date(0).toISOString(),
    href: `/admin/orders/${encodeURIComponent(id)}`,
    parcelHref: `/admin/orders/${encodeURIComponent(id)}/parcel`,
  };
}

function normalizeSourcingOrderFromApi(order: unknown): SourcingOrder | null {
  if (!isObjectRecord(order)) {
    return null;
  }

  const id = typeof order.id === "string" || typeof order.id === "number" ? String(order.id) : "";
  if (!id) {
    return null;
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const normalizedItems = items.map((item) => {
    const candidate = isObjectRecord(item) ? item : {};
    const quantity = typeof candidate.quantity === "number"
      ? candidate.quantity
      : typeof candidate.quantity === "string"
        ? Number(candidate.quantity)
        : 1;
    const finalLinePriceFcfa = typeof candidate.finalLinePriceFcfa === "number"
      ? candidate.finalLinePriceFcfa
      : typeof candidate.finalLinePriceFcfa === "string"
        ? Number(candidate.finalLinePriceFcfa)
        : 0;

    return {
      slug: typeof candidate.slug === "string" ? candidate.slug : "",
      title: typeof candidate.title === "string" ? candidate.title : typeof candidate.productName === "string" ? candidate.productName : "Produit",
      productName: typeof candidate.productName === "string" ? candidate.productName : typeof candidate.title === "string" ? candidate.title : "Produit",
      image: typeof candidate.image === "string" && candidate.image.trim().length > 0 ? candidate.image : "/globe.svg",
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      selectedVariants: isObjectRecord(candidate.selectedVariants) ? candidate.selectedVariants as Record<string, string> : undefined,
      selectionLabel: typeof candidate.selectionLabel === "string" ? candidate.selectionLabel : "",
      requiredVariantLabels: [],
      missingVariantLabels: [],
      variantSelectionComplete: true,
      supplierSkuId: undefined,
      supplierSkuCode: undefined,
      weightKg: 0,
      volumeCbm: 0,
      supplierPriceFcfa: Number.isFinite(finalLinePriceFcfa) ? finalLinePriceFcfa : 0,
      marginMode: "fixed" as const,
      marginValue: 0,
      marginAmountFcfa: 0,
      finalUnitPriceFcfa: Number.isFinite(finalLinePriceFcfa) && Number.isFinite(quantity) && quantity > 0 ? finalLinePriceFcfa / quantity : 0,
      finalLinePriceFcfa: Number.isFinite(finalLinePriceFcfa) ? finalLinePriceFcfa : 0,
    };
  });

  const totalPriceFcfa = typeof order.totalPriceFcfa === "number"
    ? order.totalPriceFcfa
    : typeof order.totalPriceFcfa === "string"
      ? Number(order.totalPriceFcfa)
      : 0;
  const meta = isObjectRecord(order.meta) ? order.meta : {};
  const pricing = isObjectRecord(meta.pricing) ? meta.pricing : {};
  const shippingCostFcfa = typeof pricing.shippingPriceFcfa === "number"
    ? pricing.shippingPriceFcfa
    : typeof pricing.shippingPriceFcfa === "string"
      ? Number(pricing.shippingPriceFcfa)
      : 0;
  const cartProductsTotalFcfa = typeof pricing.itemsSubtotalFcfa === "number"
    ? pricing.itemsSubtotalFcfa
    : typeof pricing.itemsSubtotalFcfa === "string"
      ? Number(pricing.itemsSubtotalFcfa)
      : normalizedItems.reduce((sum, item) => sum + item.finalLinePriceFcfa, 0);

  return {
    id,
    orderNumber: typeof order.orderNumber === "string" ? order.orderNumber : id,
    userId: typeof order.userId === "string" ? order.userId : typeof order.userId === "number" ? String(order.userId) : undefined,
    customerName: typeof order.customerName === "string" ? order.customerName : "Client",
    customerEmail: typeof order.customerEmail === "string" ? order.customerEmail : "",
    customerPhone: typeof order.customerPhone === "string" ? order.customerPhone : "",
    addressLine1: typeof order.addressLine1 === "string" ? order.addressLine1 : "",
    addressLine2: typeof order.addressLine2 === "string" ? order.addressLine2 : "",
    city: typeof order.city === "string" ? order.city : "",
    state: typeof order.state === "string" ? order.state : "",
    postalCode: typeof order.postalCode === "string" ? order.postalCode : "",
    countryCode: typeof order.countryCode === "string" ? order.countryCode : "",
    shippingMethod: typeof order.shippingMethod === "string" ? order.shippingMethod as SourcingOrder["shippingMethod"] : "air",
    shippingCostFcfa: Number.isFinite(shippingCostFcfa) ? shippingCostFcfa : 0,
    cartProductsTotalFcfa: Number.isFinite(cartProductsTotalFcfa) ? cartProductsTotalFcfa : 0,
    totalPriceFcfa: Number.isFinite(totalPriceFcfa) ? totalPriceFcfa : 0,
    totalWeightKg: typeof pricing.totalWeightKg === "number"
      ? pricing.totalWeightKg
      : typeof order.totalWeightKg === "number"
        ? order.totalWeightKg
        : 0,
    totalVolumeCbm: typeof pricing.totalVolumeCbm === "number"
      ? pricing.totalVolumeCbm
      : typeof order.totalVolumeCbm === "number"
        ? order.totalVolumeCbm
        : 0,
    status: typeof order.status === "string" ? order.status as SourcingOrder["status"] : "checkout_created",
    freightStatus: typeof order.freightStatus === "string" ? order.freightStatus as SourcingOrder["freightStatus"] : "not_requested",
    supplierOrderStatus: typeof order.supplierOrderStatus === "string" ? order.supplierOrderStatus as SourcingOrder["supplierOrderStatus"] : "not_created",
    paymentStatus: typeof order.paymentStatus === "string" ? order.paymentStatus as SourcingOrder["paymentStatus"] : "pending",
    paymentProvider: order.paymentProvider === "paypal" ? "paypal" : order.paymentProvider === "moneroo" ? "moneroo" : undefined,
    paymentCurrency: typeof order.paymentCurrency === "string" ? order.paymentCurrency : "XOF",
    alibabaTradeIds: Array.isArray(order.alibabaTradeIds) ? order.alibabaTradeIds.filter((value): value is string => typeof value === "string") : [],
    freightPayload: order.freightPayload,
    supplierOrderPayload: order.meta,
    monerooPaymentId: typeof order.monerooPaymentId === "string" ? order.monerooPaymentId : undefined,
    monerooCheckoutUrl: typeof order.monerooCheckoutUrl === "string" ? order.monerooCheckoutUrl : undefined,
    monerooPaymentStatus: typeof order.monerooPaymentStatus === "string" ? order.monerooPaymentStatus : undefined,
    monerooPaymentPayload: undefined,
    monerooInitializedAt: typeof order.monerooInitializedAt === "string" ? order.monerooInitializedAt : undefined,
    monerooVerifiedAt: typeof order.monerooVerifiedAt === "string" ? order.monerooVerifiedAt : undefined,
    paidAt: typeof order.paidAt === "string" ? order.paidAt : undefined,
    containerId: typeof order.containerId === "string" ? order.containerId : undefined,
    notes: typeof meta.notes === "string" ? meta.notes : undefined,
    createdAt: typeof order.createdAt === "string" ? order.createdAt : new Date(0).toISOString(),
    updatedAt: typeof order.updatedAt === "string" ? order.updatedAt : typeof order.createdAt === "string" ? order.createdAt : new Date(0).toISOString(),
    items: normalizedItems,
  };
}

function normalizeAdminUserFromApi(user: unknown): AdminUserRecord | null {
  if (!isObjectRecord(user)) {
    return null;
  }

  const id = typeof user.id === "string" || typeof user.id === "number" ? String(user.id) : "";
  if (!id) {
    return null;
  }

  return {
    id,
    displayName: typeof user.displayName === "string" ? user.displayName : typeof user.name === "string" ? user.name : `Utilisateur ${id}`,
    email: typeof user.email === "string" ? user.email : "",
    phone: typeof user.phone === "string" ? user.phone : "",
    createdAt: typeof user.createdAt === "string" ? user.createdAt : new Date(0).toISOString(),
    ordersCount: typeof user.ordersCount === "number" ? user.ordersCount : Number(user.ordersCount ?? 0),
    paidOrdersCount: typeof user.paidOrdersCount === "number" ? user.paidOrdersCount : Number(user.paidOrdersCount ?? 0),
    addressesCount: typeof user.addressesCount === "number" ? user.addressesCount : Number(user.addressesCount ?? 0),
    quotesCount: typeof user.quotesCount === "number" ? user.quotesCount : Number(user.quotesCount ?? 0),
    conversationsCount: typeof user.conversationsCount === "number" ? user.conversationsCount : Number(user.conversationsCount ?? 0),
    status: typeof user.status === "string" ? user.status : "Nouveau",
  };
}

function normalizeAdminUserAddressFromApi(address: unknown): AdminUserAddressRecord | null {
  if (!isObjectRecord(address)) {
    return null;
  }

  const id = typeof address.id === "string" || typeof address.id === "number" ? String(address.id) : "";
  if (!id) {
    return null;
  }

  return {
    id,
    label: typeof address.label === "string" ? address.label : "",
    recipientName: typeof address.recipientName === "string" ? address.recipientName : "",
    phone: typeof address.phone === "string" ? address.phone : "",
    email: typeof address.email === "string" ? address.email : "",
    addressLine1: typeof address.addressLine1 === "string" ? address.addressLine1 : "",
    addressLine2: typeof address.addressLine2 === "string" ? address.addressLine2 : "",
    city: typeof address.city === "string" ? address.city : "",
    state: typeof address.state === "string" ? address.state : "",
    postalCode: typeof address.postalCode === "string" ? address.postalCode : "",
    countryCode: typeof address.countryCode === "string" ? address.countryCode : "",
    isDefault: Boolean(address.isDefault),
    createdAt: typeof address.createdAt === "string" ? address.createdAt : "",
  };
}

function normalizeAdminUserDetailOrderFromApi(order: unknown): AdminUserOrderDetailRecord | null {
  if (!isObjectRecord(order)) {
    return null;
  }

  const id = typeof order.id === "string" || typeof order.id === "number" ? String(order.id) : "";
  if (!id) {
    return null;
  }

  const totalPriceFcfa = typeof order.totalPriceFcfa === "number"
    ? order.totalPriceFcfa
    : typeof order.totalPriceFcfa === "string"
      ? Number(order.totalPriceFcfa)
      : 0;

  return {
    id,
    orderNumber: typeof order.orderNumber === "string" ? order.orderNumber : id,
    customerName: typeof order.customerName === "string" ? order.customerName : "",
    customerEmail: typeof order.customerEmail === "string" ? order.customerEmail : "",
    customerPhone: typeof order.customerPhone === "string" ? order.customerPhone : "",
    addressLine: [order.addressLine1, order.addressLine2, order.city, order.state, order.postalCode, order.countryCode]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join(", "),
    status: typeof order.status === "string" ? order.status : "pending",
    paymentStatus: typeof order.paymentStatus === "string" ? order.paymentStatus : "pending",
    paymentProvider: typeof order.paymentProvider === "string" ? order.paymentProvider : "",
    totalPriceFcfa: Number.isFinite(totalPriceFcfa) ? totalPriceFcfa : 0,
    createdAt: typeof order.createdAt === "string" ? order.createdAt : new Date(0).toISOString(),
  };
}

export type AdminUserRecord = {
  id: string;
  displayName: string;
  email: string;
  phone?: string;
  createdAt: string;
  ordersCount: number;
  paidOrdersCount?: number;
  addressesCount?: number;
  quotesCount: number;
  conversationsCount: number;
  status: string;
};

export type AdminUserAddressRecord = {
  id: string;
  label?: string;
  recipientName: string;
  phone?: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
  isDefault?: boolean;
  createdAt?: string;
};

export type AdminUserOrderDetailRecord = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  addressLine: string;
  status: string;
  paymentStatus: string;
  paymentProvider: string;
  totalPriceFcfa: number;
  createdAt: string;
};

export type AdminUserDetailRecord = {
  user: AdminUserRecord & { role?: string };
  addresses: AdminUserAddressRecord[];
  orders: AdminUserOrderDetailRecord[];
  quotes: AdminQuoteRecord[];
  conversations: AdminUserSupportConversation[];
  favorites: AdminCatalogProduct[];
};

export type AdminOrderRecord = {
  id: string;
  orderNumber: string;
  documentNumber: string;
  pdfExportsCount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  productTitle: string;
  shippingMethod: string;
  paymentStatus: string;
  status: string;
  countryCode: string;
  addressLine: string;
  totalUsd: number;
  createdAt: string;
  href: string;
  parcelHref: string;
};

export type AdminImportRequestStatus = "En attente" | "En traitement" | "Complété" | "Rejeté";

export type AdminImportRequest = {
  requestCode: string;
  orderId: string;
  clientName: string;
  email: string;
  phone: string;
  product: string;
  productUrl: string;
  productDescription: string;
  budget: string;
  additionalInfo: string;
  quantity: number;
  dateLabel: string;
  createdAt: string;
  updatedLabel: string;
  status: AdminImportRequestStatus;
  corridor: string;
  tracking: string;
  agent: string;
  href: string;
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMediaUrl(candidate: unknown) {
  if (typeof candidate !== "string") {
    return undefined;
  }

  const normalized = candidate.trim();
  if (!normalized) {
    return undefined;
  }

  if (normalized.startsWith("//")) {
    return `https:${normalized}`;
  }

  return /^https?:\/\//i.test(normalized) ? normalized : undefined;
}

function collectFirstStringByKeys(value: unknown, keys: Set<string>, depth = 0): string | undefined {
  if (depth > 4 || !value) {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = collectFirstStringByKeys(entry, keys, depth + 1);
      if (nested) {
        return nested;
      }
    }

    return undefined;
  }

  if (!isObjectRecord(value)) {
    return undefined;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (keys.has(key) && typeof nestedValue === "string" && nestedValue.trim()) {
      return nestedValue.trim();
    }
  }

  for (const nestedValue of Object.values(value)) {
    const nested = collectFirstStringByKeys(nestedValue, keys, depth + 1);
    if (nested) {
      return nested;
    }
  }

  return undefined;
}

function buildAliExpressSourceUrl(sourceProductId?: string, rawPayload?: unknown) {
  const discovered = normalizeMediaUrl(collectFirstStringByKeys(rawPayload, new Set([
    "detail_url",
    "detailUrl",
    "productUrl",
    "product_url",
    "itemUrl",
    "item_url",
    "promotionLink",
    "promotion_link",
  ])));

  if (discovered) {
    return discovered;
  }

  if (typeof sourceProductId === "string" && /^\d+$/.test(sourceProductId.trim())) {
    return `https://www.aliexpress.com/item/${sourceProductId.trim()}.html`;
  }

  return undefined;
}

function isImageUrl(candidate: string) {
  return /\.(avif|bmp|gif|jpe?g|png|webp)(?:$|\?)/i.test(candidate);
}

function dedupeStrings(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)));
}

function dedupeParcelPhotos(photos: AdminOrderParcelPhoto[]) {
  const seen = new Set<string>();
  const nextPhotos: AdminOrderParcelPhoto[] = [];

  for (const photo of photos) {
    const key = `${photo.source}:${photo.url}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    nextPhotos.push(photo);
  }

  return nextPhotos;
}

function buildClientAddressLines(order: SourcingOrder) {
  return [
    order.customerName,
    order.addressLine1,
    order.addressLine2,
    `${order.city}, ${order.state}${order.postalCode ? ` ${order.postalCode}` : ""}`,
    order.countryCode,
  ].filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function buildParcelRouting(order: SourcingOrder) {
  const meta = getSourcingOrderMeta(order);
  const workflow = meta.workflow;
  const deliveryProfile = meta.deliveryProfile;
  const clientAddressLines = buildClientAddressLines(order);

  if (workflow?.routeType === "customer-forwarder") {
    const hubLabel = deliveryProfile?.forwarder?.hub === "lome" ? "Hub transitaire Lome" : "Hub transitaire Chine";
    return {
      routeLabel: "Agent / transitaire client",
      destinationLabel: hubLabel,
      pickupLabel: deliveryProfile?.forwarder?.parcelMarking || "Remise au transitaire client",
      pickupAddress: deliveryProfile?.forwarder?.addressBlock,
      pickupReadyAt: workflow.deliveredToAgentAt,
      clientAddressLines,
    };
  }

  return {
    routeLabel: deliveryProfile?.usesInternalReceptionAddress ? "Corridor AfriPay avec relais" : "Corridor AfriPay direct",
    destinationLabel: workflow?.relayPointAddress ? "Point relais client" : "Adresse client finale",
    pickupLabel: workflow?.relayPointLabel || (workflow?.relayPointAddress ? "Point relais AfriPay" : "Livraison client finale"),
    pickupAddress: workflow?.relayPointAddress,
    pickupReadyAt: workflow?.availableForPickupAt,
    clientAddressLines,
  };
}


function convertFcfaToUsd(amountFcfa: number) {
  return Number((amountFcfa / 610).toFixed(2));
}

export async function getAdminSuppliers() {
  const products = await getCatalogProducts();
  const supplierMap = new Map<
    string,
    {
      name: string;
      location: string;
      yearsInBusiness: number;
      productCount: number;
      responseTime: string;
      status: string;
    }
  >();

  for (const product of products) {
    const existing = supplierMap.get(product.supplierName);

    if (existing) {
      existing.productCount += 1;
      continue;
    }

    supplierMap.set(product.supplierName, {
      name: product.supplierName,
      location: product.supplierLocation,
      yearsInBusiness: product.yearsInBusiness,
      productCount: 1,
      responseTime: product.responseTime,
      status: product.yearsInBusiness >= 6 ? "Verifie" : "A suivre",
    });
  }

  return Array.from(supplierMap.values()).sort((left, right) => right.productCount - left.productCount);
}

export async function getAdminMetrics() {
  const [users, orders, products, categories] = await Promise.all([
    getStoredUsers(),
    getAdminOrders(),
    getCatalogProducts(),
    getCatalogCategories(),
  ]);
  const revenueUsd = orders.reduce((sum: number, order: AdminOrderRecord) => sum + order.totalUsd, 0);
  const promotionsCount = products.filter((product: AdminCatalogProduct) => product.badge || product.title.toLowerCase().includes("promo")).length;
  const pendingOrdersCount = orders.filter((order: AdminOrderRecord) => order.paymentStatus !== "paid").length;

  return {
    revenueUsd,
    ordersCount: orders.length,
    productsCount: products.length,
    suppliersCount: users.length,
    categoriesCount: categories.length,
    promotionsCount,
    pendingOrdersCount,
  };
}

export async function getAdminMonthlyRevenue() {
  const monthLabels = ["Jan", "Fev", "Mar", "Avr", "Mai", "Juin"];
  const revenueByMonth = new Map<number, number>();
  const orders = await getSourcingOrders();

  for (const order of orders) {
    const monthIndex = new Date(order.createdAt).getUTCMonth();
    revenueByMonth.set(monthIndex, (revenueByMonth.get(monthIndex) ?? 0) + convertFcfaToUsd(order.totalPriceFcfa));
  }

  return monthLabels.map((label, index) => ({
    label,
    value: revenueByMonth.get(index) ?? 0,
  }));
}

export async function getAdminRecentOrders(limit = 5) {
  const orders = await getAdminOrders();

  return [...orders]
    .sort((left: AdminOrderRecord, right: AdminOrderRecord) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit)
    .map((order: AdminOrderRecord) => ({
      id: order.orderNumber,
      customer: order.customerName,
      product: order.productTitle || `Commande ${order.orderNumber}`,
      date: order.createdAt.slice(0, 10),
      totalUsd: order.totalUsd,
      status: order.paymentStatus,
      href: order.href,
      parcelHref: order.parcelHref,
    }));
}

export async function getAdminOrders(options?: { preferProxy?: boolean }): Promise<AdminOrderRecord[]> {
  if (options?.preferProxy !== false && hasExternalAdminApi()) {
    try {
      const proxiedOrders = await fetchAdminOrdersFromApi();
      if (proxiedOrders) {
        return proxiedOrders;
      }
    } catch {
      // Fall back to the local store when the backend API is unreachable.
    }
  }

  const orders = await getSourcingOrders();

  return [...orders]
    .sort((left: AdminSourcingOrder, right: AdminSourcingOrder) => right.createdAt.localeCompare(left.createdAt))
    .map((order: AdminSourcingOrder) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      documentNumber: getDeliveryNoteDocumentNumber(order),
      pdfExportsCount: getDeliveryNoteExportHistory(order).length,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      productTitle: order.items[0]?.title ?? `Commande ${order.orderNumber}`,
      shippingMethod: order.shippingMethod,
      paymentStatus: order.paymentStatus,
      status: order.status,
      countryCode: order.countryCode,
      addressLine: [order.addressLine1, order.addressLine2, `${order.city}, ${order.state}`, order.postalCode].filter(Boolean).join(", "),
      totalUsd: convertFcfaToUsd(order.totalPriceFcfa),
      createdAt: order.createdAt,
      href: `/admin/orders/${encodeURIComponent(order.id)}`,
      parcelHref: `/admin/orders/${encodeURIComponent(order.id)}/parcel`,
    }));
}

export async function getAdminUsersOverview(): Promise<AdminUserRecord[]> {
  if (API_URL) {
    try {
      const proxiedUsers = await fetchAdminUsersOverviewFromApi();
      if (proxiedUsers) {
        return proxiedUsers;
      }
    } catch {
      // Fall back to the local store when the backend API is unreachable.
    }
  }

  const [users, orders, quotes, conversations] = await Promise.all([
    getStoredUsers(),
    getSourcingOrders(),
    getQuoteRequests(),
    getSupportConversations(),
  ]);

  return users.map((user: AdminStoredUser) => {
    const ordersCount = orders.filter((order: AdminSourcingOrder) => order.userId === user.id || order.customerEmail.toLowerCase() === user.email.toLowerCase()).length;
    const quotesCount = quotes.filter((quote: AdminQuoteRecord) => quote.userId === user.id).length;
    const conversationsCount = conversations.filter((conversation: AdminSupportConversation) => conversation.userId === user.id).length;
    const status = ordersCount > 0 || quotesCount > 0 || conversationsCount > 0 ? "Actif" : "Nouveau";

    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      phone: "",
      createdAt: user.createdAt,
      ordersCount,
      paidOrdersCount: 0,
      addressesCount: 0,
      quotesCount,
      conversationsCount,
      status,
    };
  });
}

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetailRecord | null> {
  if (API_URL) {
    try {
      const proxiedUserDetail = await fetchAdminUserDetailFromApi(userId);
      if (proxiedUserDetail) {
        return proxiedUserDetail;
      }
    } catch {
      // Fall back to the local store when the backend API is unreachable.
    }
  }

  const user = await getStoredUserById(userId);
  if (!user) {
    return null;
  }

  const [addresses, favoriteSlugs, quotes, conversations, orders, products] = await Promise.all([
    getUserAddresses(userId),
    getUserFavoriteSlugs(userId),
    getQuoteRequests(),
    getUserSupportConversations(userId),
    getSourcingOrders(),
    getCatalogProducts(),
  ]);

  const userQuotes = quotes.filter((quote: AdminQuoteRecord) => quote.userId === userId);
  const userOrders = orders.filter((order: AdminSourcingOrder) => order.userId === userId || order.customerEmail.toLowerCase() === user.email.toLowerCase());
  const favorites = products.filter((product: AdminCatalogProduct) => favoriteSlugs.includes(product.slug));

  return {
    user: {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      phone: "",
      createdAt: user.createdAt,
      ordersCount: userOrders.length,
      paidOrdersCount: userOrders.filter((order) => order.paymentStatus === "paid").length,
      addressesCount: addresses.length,
      quotesCount: userQuotes.length,
      conversationsCount: conversations.length,
      status: userOrders.length > 0 || userQuotes.length > 0 || conversations.length > 0 ? "Actif" : "Nouveau",
    },
    addresses: addresses.map((address) => ({
      id: address.id,
      recipientName: address.recipientName,
      phone: address.phone,
      email: address.email,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      countryCode: address.countryCode,
    })),
    orders: userOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      addressLine: [order.addressLine1, order.addressLine2, order.city, order.state, order.postalCode, order.countryCode]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .join(", "),
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentProvider: "",
      totalPriceFcfa: order.totalPriceFcfa,
      createdAt: order.createdAt,
    })),
    quotes: userQuotes,
    conversations,
    favorites,
  };
}

export async function getAdminOrderById(orderId: string) {
  if (hasExternalAdminApi()) {
    try {
      const proxiedOrder = await fetchAdminOrderByIdFromApi(orderId);
      if (proxiedOrder) {
        return proxiedOrder;
      }
    } catch {
      // Fall back to the local store when the backend API is unreachable.
    }
  }

  const orders = await getSourcingOrders();
  return orders.find((order: AdminSourcingOrder) => order.id === orderId || order.orderNumber === orderId) ?? null;
}

export async function getAdminOrderParcelSnapshot(order: SourcingOrder): Promise<AdminOrderParcelSnapshot> {
  const importedProducts = await getAlibabaImportedProducts();
  const importedByKey = new Map(importedProducts.flatMap((product) => {
    const keys = dedupeStrings([product.id, product.slug, product.sourceProductId]);
    return keys.map((key) => [key, product] as const);
  }));
  const meta = getSourcingOrderMeta(order);
  const manualPhotos = (meta.parcel?.photos ?? []).map((photo) => ({
    id: photo.id,
    url: photo.url,
    label: photo.label,
    createdAt: photo.createdAt,
    source: "manual" as const,
  }));
  const proofMedia = dedupeStrings((meta.workflow?.proofs ?? []).map((proof) => normalizeMediaUrl(proof.mediaUrl)).filter((value): value is string => typeof value === "string" && isImageUrl(value)));

  const items: AdminOrderParcelItem[] = order.items.map((item) => {
    const importedProduct = importedByKey.get(item.slug);
    const gallery = dedupeStrings([
      normalizeMediaUrl(importedProduct?.image),
      ...(importedProduct?.gallery ?? []).map((entry) => normalizeMediaUrl(entry)),
    ]);

    return {
      slug: item.slug,
      title: item.title,
      quantity: item.quantity,
      selectionLabel: item.selectionLabel,
      image: normalizeMediaUrl(importedProduct?.image) ?? item.image,
      gallery,
      sourceProductId: importedProduct?.sourceProductId,
      sourceUrl: buildAliExpressSourceUrl(importedProduct?.sourceProductId, importedProduct?.rawPayload),
      supplierName: importedProduct?.supplierName,
      supplierLocation: importedProduct?.supplierLocation,
      packaging: importedProduct?.packaging,
      itemWeightGrams: importedProduct?.itemWeightGrams,
      overview: importedProduct?.overview ?? [],
      specs: importedProduct?.specs ?? [],
    };
  });

  const sourcePhotos = items.flatMap((item) => item.gallery.map((url, index) => ({
    id: `${item.slug}-source-${index}`,
    url,
    label: item.title,
    source: "source" as const,
  })));
  const proofPhotos = proofMedia.map((url, index) => ({
    id: `proof-${index}`,
    url,
    source: "proof" as const,
  }));
  const photoEntries = dedupeParcelPhotos([...manualPhotos, ...proofPhotos, ...sourcePhotos]);

  return {
    parcelHref: `/admin/orders/${encodeURIComponent(order.id)}/parcel`,
    printHref: `/admin/orders/${encodeURIComponent(order.id)}/parcel/print`,
    totalItems: items.length,
    totalUnits: order.items.reduce((sum, item) => sum + item.quantity, 0),
    supplierNames: dedupeStrings(items.map((item) => item.supplierName)),
    manualNote: meta.parcel?.note,
    manualPhotos,
    proofMedia,
    primaryGallery: dedupeStrings(photoEntries.map((entry) => entry.url)),
    photoEntries,
    sourceLinks: dedupeStrings(items.map((item) => item.sourceUrl)),
    routing: buildParcelRouting(order),
    items,
  };
}

export async function getAdminPromotions() {
  const products = await getCatalogProducts();
  return products
    .filter((product: AdminCatalogProduct) => product.badge || product.title.toLowerCase().includes("promo"))
    .map((product: AdminCatalogProduct) => ({
      name: product.shortTitle,
      badge: product.badge ?? "Promo",
      priceMinUsd: product.minUsd,
      priceMaxUsd: product.maxUsd,
      href: `/products/${product.slug}`,
    }));
}

export const adminPromoCodes: Array<{ code: string; type: string; value: string; minPurchase: string; usages: string; validity: string; status: string; channel: string; href: string }> = [];

export async function getAdminOffers() {
  const products = await getCatalogProducts();
  return products.slice(0, 8).map((product: AdminCatalogProduct) => ({
    name: product.shortTitle,
    supplier: product.supplierName,
    moq: `${product.moq} ${product.unit}`,
    priceMinUsd: product.minUsd,
    category: product.slug.includes("gaming") ? "Gaming" : product.slug.includes("vr") ? "Immersif" : "Lifestyle",
    href: `/products/${product.slug}`,
  }));
}

export const adminEmailCampaigns: Array<{ subject: string; segment: string; status: string; href: string }> = [];

export async function getAdminSupportTickets() {
  const conversations = await getSupportConversations();
  return conversations.map((conversation) => ({
    subject: conversation.preview,
    owner: conversation.name,
    priority: conversation.status === "en ligne" ? "Normale" : conversation.status === "en transit" ? "Moyenne" : "Cloture",
    status: conversation.status,
    href: `/messages?conversationId=${encodeURIComponent(conversation.id)}`,
  }));
}

export async function getAdminImportRequests(): Promise<AdminImportRequest[]> {
  const requests = await getQuoteRequests();
  return requests.map((request) => ({
    requestCode: `imp-${request.id.slice(0, 6)}`,
    orderId: request.id,
    clientName: request.userDisplayName,
    email: request.userEmail,
    phone: "Non renseigne",
    product: request.productName,
    productUrl: "",
    productDescription: request.specifications,
    budget: request.budget || "Sur demande",
    additionalInfo: request.notes || "Aucune information complementaire fournie.",
    quantity: Number.parseInt(request.quantity.replace(/[^0-9]/g, ""), 10) || 0,
    dateLabel: new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(request.createdAt)),
    createdAt: new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(request.createdAt)),
    updatedLabel: `Mis a jour ${new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(request.updatedAt))}`,
    status: request.status,
    corridor: request.shippingWindow,
    tracking: "En attente",
    agent: "Equipe sourcing",
    href: `/admin/imports/${encodeURIComponent(request.id)}`,
  } satisfies AdminImportRequest));
}

export async function getAdminImportRequestById(importId: string): Promise<AdminImportRequest | null> {
  const requests = await getAdminImportRequests();
  return requests.find((request) => request.orderId === importId) ?? null;
}

export function getAdminReviews() {
  return [] as Array<{ product: string; score: number; reviewer: string; summary: string; status: string; responseStatus: string; href: string }>;
}

export const adminSettingsGroups = [
  { label: "Localisation", detail: "Pays FR par defaut, devise contextualisee et langue derivee.", href: "/pricing" },
  { label: "Support vendeur", detail: "Canaux messages relies aux agents logistiques et service client.", href: "/messages" },
  { label: "Catalogue", detail: "Moteur de recherche, suggestions et taxonomie produits centralises.", href: "/products" },
];
