import { getSourcingOrderMeta, type SourcingOrder, withSourcingOrderMeta } from "@/lib/alibaba-sourcing";
import { getAbandonedCartRecords, markAbandonedCartReminderSent, type AbandonedCartRecord } from "@/lib/abandoned-cart-store";
import { getAbandonedQuoteRecords, markAbandonedQuoteReminderSent, type AbandonedQuoteRecord } from "@/lib/abandoned-quote-store";
import { getCatalogProductsBySlugs } from "@/lib/catalog-service";
import { createSharedCart } from "@/lib/cart-share-store";
import { SITE_NAME, SITE_URL } from "@/lib/site-config";
import { getSourcingOrders, saveSourcingOrder } from "@/lib/sourcing-store";

type ManyChatApiResponse<T = unknown> = {
  status: "success" | "error";
  data?: T;
  message?: string;
  details?: {
    messages?: Array<{
      message?: string;
    }>;
  };
  code?: number;
};

type ManyChatFieldValue = string | number | boolean | null;

function getManyChatBaseUrl() {
  return (process.env.MANYCHAT_BASE_URL?.trim() || "https://api.manychat.com").replace(/\/+$/, "");
}

function getManyChatApiKey() {
  const apiKey = process.env.MANYCHAT_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("MANYCHAT_API_KEY is required to call the ManyChat API.");
  }

  return apiKey;
}

function normalizeMessageTag(messageTag?: string) {
  return messageTag?.trim() || process.env.MANYCHAT_DEFAULT_MESSAGE_TAG?.trim() || "ACCOUNT_UPDATE";
}

function getCartReminderDelayMinutes() {
  const parsed = Number(process.env.MANYCHAT_CART_ABANDONED_DELAY_MINUTES ?? "60");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
}

function getLocalCartReminderDelaySeconds() {
  const parsed = Number(process.env.MANYCHAT_LOCAL_CART_ABANDONED_DELAY_SECONDS ?? "30");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

function getLocalQuoteReminderDelaySeconds() {
  const parsed = Number(process.env.MANYCHAT_LOCAL_QUOTE_ABANDONED_DELAY_SECONDS ?? "45");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 45;
}

function getCartReminderBatchSize() {
  const parsed = Number(process.env.MANYCHAT_CART_ABANDONED_BATCH_SIZE ?? "20");
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : 20;
}

function normalizeOptionalString(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeNumericLikeId(value?: string | number | null) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  return /^\d+$/.test(normalized) ? Number(normalized) : normalized;
}

async function manyChatRequest<T>(path: string, init: {
  method: "GET" | "POST";
  body?: Record<string, unknown>;
  searchParams?: URLSearchParams;
}) {
  const url = new URL(`${getManyChatBaseUrl()}${path}`);
  if (init.searchParams) {
    url.search = init.searchParams.toString();
  }

  const response = await fetch(url.toString(), {
    method: init.method,
    headers: {
      Authorization: `Bearer ${getManyChatApiKey()}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  const rawPayload = await response.text();
  let payload: ManyChatApiResponse<T> | null = null;

  if (rawPayload) {
    try {
      payload = JSON.parse(rawPayload) as ManyChatApiResponse<T>;
    } catch {
      payload = null;
    }
  }

  if (!response.ok || payload?.status === "error") {
    const detailMessages = payload?.details?.messages
      ?.map((entry) => entry.message?.trim())
      .filter((message): message is string => Boolean(message));
    const message = payload?.message || detailMessages?.join(" | ") || `ManyChat request failed with status ${response.status}.`;
    throw new Error(message);
  }

  if (!payload) {
    throw new Error("ManyChat returned an empty or invalid JSON response.");
  }

  return payload;
}

export async function sendMessage(subscriberId: string, message: string, messageTag?: string) {
  const normalizedSubscriberId = normalizeOptionalString(subscriberId);
  const normalizedMessage = normalizeOptionalString(message);
  if (!normalizedSubscriberId || !normalizedMessage) {
    throw new Error("subscriberId and message are required.");
  }

  return manyChatRequest("/fb/sending/sendContent", {
    method: "POST",
    body: {
      subscriber_id: normalizedSubscriberId,
      data: {
        text: normalizedMessage,
      },
      message_tag: normalizeMessageTag(messageTag),
    },
  });
}

export async function sendFlow(subscriberId: string, flowId: string) {
  const normalizedSubscriberId = normalizeOptionalString(subscriberId);
  const normalizedFlowId = normalizeOptionalString(flowId);
  if (!normalizedSubscriberId || !normalizedFlowId) {
    throw new Error("subscriberId and flowId are required.");
  }

  return manyChatRequest("/fb/sending/sendFlow", {
    method: "POST",
    body: {
      subscriber_id: normalizedSubscriberId,
      flow_ns: normalizedFlowId,
    },
  });
}

export async function addTag(subscriberId: string, tagId: string | number) {
  const normalizedSubscriberId = normalizeOptionalString(subscriberId);
  const normalizedTagId = normalizeNumericLikeId(tagId);
  if (!normalizedSubscriberId || normalizedTagId === undefined) {
    throw new Error("subscriberId and tagId are required.");
  }

  return manyChatRequest("/fb/subscriber/addTag", {
    method: "POST",
    body: {
      subscriber_id: normalizedSubscriberId,
      tag_id: normalizedTagId,
    },
  });
}

export async function removeTag(subscriberId: string, tagId: string | number) {
  const normalizedSubscriberId = normalizeOptionalString(subscriberId);
  const normalizedTagId = normalizeNumericLikeId(tagId);
  if (!normalizedSubscriberId || normalizedTagId === undefined) {
    throw new Error("subscriberId and tagId are required.");
  }

  return manyChatRequest("/fb/subscriber/removeTag", {
    method: "POST",
    body: {
      subscriber_id: normalizedSubscriberId,
      tag_id: normalizedTagId,
    },
  });
}

export async function setCustomField(subscriberId: string, fieldId: string | number, value: ManyChatFieldValue) {
  const normalizedSubscriberId = normalizeOptionalString(subscriberId);
  const normalizedFieldId = normalizeNumericLikeId(fieldId);
  if (!normalizedSubscriberId || normalizedFieldId === undefined) {
    throw new Error("subscriberId and fieldId are required.");
  }

  return manyChatRequest("/fb/subscriber/setCustomField", {
    method: "POST",
    body: {
      subscriber_id: normalizedSubscriberId,
      field_id: normalizedFieldId,
      field_value: value,
    },
  });
}

export async function getSubscriber(subscriberId: string) {
  const normalizedSubscriberId = normalizeOptionalString(subscriberId);
  if (!normalizedSubscriberId) {
    throw new Error("subscriberId is required.");
  }

  return manyChatRequest("/fb/subscriber/getInfo", {
    method: "GET",
    searchParams: new URLSearchParams({
      subscriber_id: normalizedSubscriberId,
    }),
  });
}

function buildOrderProductsLabel(order: SourcingOrder) {
  return order.items
    .map((item) => `${item.title} x${item.quantity}`)
    .join(", ")
    .slice(0, 240);
}

function buildTrackingCode(order: SourcingOrder) {
  const base = order.orderNumber.replace(/[^A-Z0-9]+/gi, "").slice(-10);
  return base ? `AFP-${base}` : undefined;
}

function buildLogisticsMessage(order: SourcingOrder, input: {
  title: string;
  detail?: string;
}) {
  const trackingCode = buildTrackingCode(order);
  const lines = [
    `AfriPay - Mise a jour logistique`,
    `Commande: ${order.orderNumber}`,
    `Statut: ${input.title}`,
    trackingCode ? `Tracking: ${trackingCode}` : undefined,
    input.detail,
  ].filter((line): line is string => Boolean(line && line.trim()));

  return lines.join("\n");
}

function buildAbandonedCartMessage(input: {
  userDisplayName: string;
  productLabel: string;
  shareUrl: string;
  itemCount: number;
}) {
  const greeting = input.userDisplayName.trim() ? `${input.userDisplayName},` : "Bonjour,";
  const itemLabel = input.itemCount > 1 ? `${input.itemCount} articles` : `${input.itemCount} article`;

  return [
    `${greeting} votre panier AfriPay vous attend toujours.`,
    `${itemLabel}: ${input.productLabel}`,
    `Reprendre mon panier: ${input.shareUrl}`,
  ].join("\n");
}

function buildAbandonedQuoteMessage(record: AbandonedQuoteRecord) {
  const greeting = record.userDisplayName.trim() ? `${record.userDisplayName},` : "Bonjour,";
  const productLabel = record.productName || "votre demande";
  const quantityLabel = record.quantity ? `Quantite: ${record.quantity}` : undefined;
  const budgetLabel = record.budget ? `Budget: ${record.budget}` : undefined;

  return [
    `${greeting} votre demande de devis AfriPay n'est pas encore envoyee.`,
    `Produit: ${productLabel}`,
    quantityLabel,
    budgetLabel,
    `${SITE_URL.replace(/\/$/, "")}/quotes`,
  ].filter(Boolean).join("\n");
}

async function buildAbandonedCartProductsLabel(record: AbandonedCartRecord) {
  const products = await getCatalogProductsBySlugs(record.items.map((item) => item.slug));
  const titleMap = new Map(products.map((product) => [product.slug, product.title] as const));

  return record.items
    .slice(0, 4)
    .map((item) => `${titleMap.get(item.slug) ?? item.slug} x${item.quantity}`)
    .join(", ");
}

async function maybeSetOrderCustomField(subscriberId: string, fieldId: string | undefined, value: ManyChatFieldValue) {
  const normalizedFieldId = normalizeOptionalString(fieldId);
  if (!normalizedFieldId || value === null || value === "") {
    return;
  }

  await setCustomField(subscriberId, normalizedFieldId, value);
}

export async function triggerManyChatOrderPaidFlow(order: SourcingOrder) {
  const meta = getSourcingOrderMeta(order);
  const manychat = meta.manychat;
  const apiKey = process.env.MANYCHAT_API_KEY?.trim();

  if (!apiKey || !manychat?.subscriberId || manychat.orderConfirmationSentAt) {
    return order;
  }

  const subscriberId = manychat.subscriberId;
  const flowId = manychat.flowId || normalizeOptionalString(process.env.MANYCHAT_ORDER_CONFIRMATION_FLOW_ID);

  await Promise.all([
    maybeSetOrderCustomField(subscriberId, process.env.MANYCHAT_CF_PRODUCT_ID, buildOrderProductsLabel(order)),
    maybeSetOrderCustomField(subscriberId, process.env.MANYCHAT_CF_AMOUNT_ID, order.totalPriceFcfa),
    maybeSetOrderCustomField(subscriberId, process.env.MANYCHAT_CF_ORDER_NUMBER_ID, order.orderNumber),
    maybeSetOrderCustomField(subscriberId, process.env.MANYCHAT_CF_SHIPPING_METHOD_ID, order.shippingMethod),
  ]);

  const paidTagId = manychat.paidTagId || normalizeOptionalString(process.env.MANYCHAT_PAID_TAG_ID);
  if (paidTagId) {
    await addTag(subscriberId, paidTagId);
  }

  if (!flowId) {
    return order;
  }

  const flowResponse = await sendFlow(subscriberId, flowId);
  const updatedOrder = withSourcingOrderMeta(order, {
    manychat: {
      ...manychat,
      orderConfirmationSentAt: new Date().toISOString(),
      lastFlowResponse: flowResponse,
    },
  });
  await saveSourcingOrder(updatedOrder);
  return updatedOrder;
}

function isOrderEligibleForCartReminder(order: SourcingOrder) {
  if (!process.env.MANYCHAT_API_KEY?.trim()) {
    return false;
  }

  const meta = getSourcingOrderMeta(order);
  const manychat = meta.manychat;
  if (!manychat?.subscriberId || manychat.cartReminderSentAt) {
    return false;
  }

  if (!normalizeOptionalString(process.env.MANYCHAT_CART_ABANDONED_FLOW_ID)) {
    return false;
  }

  if (["paid", "failed", "cancelled"].includes(order.paymentStatus)) {
    return false;
  }

  const referenceTimestamp = order.monerooInitializedAt || order.createdAt;
  const elapsedMs = Date.now() - new Date(referenceTimestamp).getTime();
  return Number.isFinite(elapsedMs) && elapsedMs >= getCartReminderDelayMinutes() * 60_000;
}

export async function triggerManyChatCartReminderFlow(order: SourcingOrder) {
  const meta = getSourcingOrderMeta(order);
  const manychat = meta.manychat;
  const flowId = normalizeOptionalString(process.env.MANYCHAT_CART_ABANDONED_FLOW_ID);

  if (!flowId || !manychat?.subscriberId || manychat.cartReminderSentAt) {
    return order;
  }

  const subscriberId = manychat.subscriberId;

  await Promise.all([
    maybeSetOrderCustomField(subscriberId, process.env.MANYCHAT_CF_PRODUCT_ID, buildOrderProductsLabel(order)),
    maybeSetOrderCustomField(subscriberId, process.env.MANYCHAT_CF_AMOUNT_ID, order.totalPriceFcfa),
    maybeSetOrderCustomField(subscriberId, process.env.MANYCHAT_CF_ORDER_NUMBER_ID, order.orderNumber),
    maybeSetOrderCustomField(subscriberId, process.env.MANYCHAT_CF_SHIPPING_METHOD_ID, order.shippingMethod),
  ]);

  const flowResponse = await sendFlow(subscriberId, flowId);
  const updatedOrder = withSourcingOrderMeta(order, {
    manychat: {
      ...manychat,
      cartReminderSentAt: new Date().toISOString(),
      lastCartReminderResponse: flowResponse,
    },
  });
  await saveSourcingOrder(updatedOrder);
  return updatedOrder;
}

export async function triggerManyChatLogisticsUpdate(order: SourcingOrder, input: {
  title: string;
  detail?: string;
}) {
  const meta = getSourcingOrderMeta(order);
  const manychat = meta.manychat;

  if (!process.env.MANYCHAT_API_KEY?.trim() || !manychat?.subscriberId) {
    return order;
  }

  const subscriberId = manychat.subscriberId;
  const message = buildLogisticsMessage(order, input);
  const trackingCode = buildTrackingCode(order);

  await Promise.all([
    maybeSetOrderCustomField(subscriberId, process.env.MANYCHAT_CF_ORDER_NUMBER_ID, order.orderNumber),
    maybeSetOrderCustomField(subscriberId, process.env.MANYCHAT_CF_SHIPPING_METHOD_ID, order.shippingMethod),
    maybeSetOrderCustomField(subscriberId, process.env.MANYCHAT_CF_PRODUCT_ID, buildOrderProductsLabel(order)),
    maybeSetOrderCustomField(subscriberId, process.env.MANYCHAT_CF_AMOUNT_ID, order.totalPriceFcfa),
    maybeSetOrderCustomField(subscriberId, process.env.MANYCHAT_CF_TRACKING_CODE_ID, trackingCode ?? null),
    maybeSetOrderCustomField(subscriberId, process.env.MANYCHAT_CF_LOGISTICS_STATUS_ID, input.title),
  ]);

  const response = await sendMessage(subscriberId, message, "ACCOUNT_UPDATE");
  const updatedOrder = withSourcingOrderMeta(order, {
    manychat: {
      ...manychat,
      logisticsLastSentAt: new Date().toISOString(),
      logisticsLastStatusSent: input.title,
      lastLogisticsResponse: response,
    },
  });
  await saveSourcingOrder(updatedOrder);
  return updatedOrder;
}

function isAbandonedCartEligibleForReminder(record: AbandonedCartRecord) {
  if (!process.env.MANYCHAT_API_KEY?.trim()) {
    return false;
  }

  if (record.status !== "active" || record.items.length === 0 || record.itemCount === 0) {
    return false;
  }

  if (!record.manychatSubscriberId || record.reminderSentAt) {
    return false;
  }

  const elapsedMs = Date.now() - new Date(record.lastActivityAt).getTime();
  return Number.isFinite(elapsedMs) && elapsedMs >= getLocalCartReminderDelaySeconds() * 1000;
}

function isAbandonedQuoteEligibleForReminder(record: AbandonedQuoteRecord) {
  if (!process.env.MANYCHAT_API_KEY?.trim()) {
    return false;
  }

  if (record.status !== "active") {
    return false;
  }

  if (!record.manychatSubscriberId || record.reminderSentAt) {
    return false;
  }

  if (!record.productName && !record.specifications && !record.notes) {
    return false;
  }

  const elapsedMs = Date.now() - new Date(record.lastActivityAt).getTime();
  return Number.isFinite(elapsedMs) && elapsedMs >= getLocalQuoteReminderDelaySeconds() * 1000;
}

export async function triggerManyChatAbandonedCartReminder(record: AbandonedCartRecord) {
  if (!process.env.MANYCHAT_API_KEY?.trim() || !record.manychatSubscriberId || record.items.length === 0) {
    return null;
  }

  const sharedCart = await createSharedCart({
    ownerUserId: record.userId,
    ownerEmail: record.userEmail,
    ownerDisplayName: record.userDisplayName,
    message: "Votre panier AfriPay vous attend",
    items: record.items,
  });
  const shareUrl = `${SITE_URL.replace(/\/$/, "")}/cart/shared/${encodeURIComponent(sharedCart.token)}`;
  const productLabel = await buildAbandonedCartProductsLabel(record);

  await Promise.all([
    maybeSetOrderCustomField(record.manychatSubscriberId, process.env.MANYCHAT_CF_PRODUCT_ID, productLabel),
    maybeSetOrderCustomField(record.manychatSubscriberId, process.env.MANYCHAT_CF_ORDER_NUMBER_ID, `PANIER-${record.itemCount}`),
  ]);

  const flowId = record.manychatFlowId || normalizeOptionalString(process.env.MANYCHAT_CART_ABANDONED_FLOW_ID);
  let flowResponse: unknown = null;
  if (flowId) {
    flowResponse = await sendFlow(record.manychatSubscriberId, flowId);
  }

  const messageResponse = await sendMessage(
    record.manychatSubscriberId,
    buildAbandonedCartMessage({
      userDisplayName: record.userDisplayName,
      productLabel: productLabel || `${record.itemCount} article(s)`,
      shareUrl,
      itemCount: record.itemCount,
    }),
    "ACCOUNT_UPDATE",
  );

  await markAbandonedCartReminderSent({
    userId: record.userId,
    response: {
      flowResponse,
      messageResponse,
      shareUrl,
      siteName: SITE_NAME,
    },
    shareToken: sharedCart.token,
  });

  return {
    flowResponse,
    messageResponse,
    shareToken: sharedCart.token,
    shareUrl,
  };
}

export async function triggerManyChatAbandonedQuoteReminder(record: AbandonedQuoteRecord) {
  if (!process.env.MANYCHAT_API_KEY?.trim() || !record.manychatSubscriberId) {
    return null;
  }

  await Promise.all([
    maybeSetOrderCustomField(record.manychatSubscriberId, process.env.MANYCHAT_CF_PRODUCT_ID, record.productName || record.specifications || "Devis AfriPay"),
    maybeSetOrderCustomField(record.manychatSubscriberId, process.env.MANYCHAT_CF_ORDER_NUMBER_ID, "DEVIS-AFRIPAY"),
  ]);

  const flowId = record.manychatFlowId || normalizeOptionalString(process.env.MANYCHAT_CART_ABANDONED_FLOW_ID);
  let flowResponse: unknown = null;
  if (flowId) {
    flowResponse = await sendFlow(record.manychatSubscriberId, flowId);
  }

  const messageResponse = await sendMessage(
    record.manychatSubscriberId,
    buildAbandonedQuoteMessage(record),
    "ACCOUNT_UPDATE",
  );

  await markAbandonedQuoteReminderSent({
    userId: record.userId,
    response: {
      flowResponse,
      messageResponse,
      productName: record.productName,
      siteName: SITE_NAME,
    },
  });

  return {
    flowResponse,
    messageResponse,
  };
}

export async function processManyChatCartAbandonmentQueue() {
  const orders = await getSourcingOrders();
  const carts = await getAbandonedCartRecords();
  const quotes = await getAbandonedQuoteRecords();
  const eligibleOrders = orders
    .filter(isOrderEligibleForCartReminder)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .slice(0, getCartReminderBatchSize());
  const eligibleCarts = carts
    .filter(isAbandonedCartEligibleForReminder)
    .sort((left, right) => left.lastActivityAt.localeCompare(right.lastActivityAt))
    .slice(0, getCartReminderBatchSize());
  const eligibleQuotes = quotes
    .filter(isAbandonedQuoteEligibleForReminder)
    .sort((left, right) => left.lastActivityAt.localeCompare(right.lastActivityAt))
    .slice(0, getCartReminderBatchSize());

  const processed: Array<{ orderId: string; orderNumber: string }> = [];
  const skipped: Array<{ orderId: string; reason: string }> = [];
  const processedCarts: Array<{ userId: string; itemCount: number }> = [];
  const skippedCarts: Array<{ userId: string; reason: string }> = [];
  const processedQuotes: Array<{ userId: string; productName: string }> = [];
  const skippedQuotes: Array<{ userId: string; reason: string }> = [];

  for (const order of eligibleOrders) {
    try {
      await triggerManyChatCartReminderFlow(order);
      processed.push({ orderId: order.id, orderNumber: order.orderNumber });
    } catch (error) {
      skipped.push({
        orderId: order.id,
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  for (const cart of eligibleCarts) {
    try {
      await triggerManyChatAbandonedCartReminder(cart);
      processedCarts.push({ userId: cart.userId, itemCount: cart.itemCount });
    } catch (error) {
      skippedCarts.push({
        userId: cart.userId,
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  for (const quote of eligibleQuotes) {
    try {
      await triggerManyChatAbandonedQuoteReminder(quote);
      processedQuotes.push({
        userId: quote.userId,
        productName: quote.productName || "Devis AfriPay",
      });
    } catch (error) {
      skippedQuotes.push({
        userId: quote.userId,
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  return {
    scanned: orders.length,
    eligible: eligibleOrders.length,
    processed,
    skipped,
    scannedCarts: carts.length,
    eligibleCarts: eligibleCarts.length,
    processedCarts,
    skippedCarts,
    scannedQuotes: quotes.length,
    eligibleQuotes: eligibleQuotes.length,
    processedQuotes,
    skippedQuotes,
    delayMinutes: getCartReminderDelayMinutes(),
    localCartDelaySeconds: getLocalCartReminderDelaySeconds(),
    localQuoteDelaySeconds: getLocalQuoteReminderDelaySeconds(),
  };
}
