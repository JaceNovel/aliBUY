import { getSourcingOrderMeta, type SourcingOrder, withSourcingOrderMeta } from "@/lib/alibaba-sourcing";
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
      lastLogisticsResponse: response,
    },
  });
  await saveSourcingOrder(updatedOrder);
  return updatedOrder;
}

export async function processManyChatCartAbandonmentQueue() {
  const orders = await getSourcingOrders();
  const eligibleOrders = orders
    .filter(isOrderEligibleForCartReminder)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .slice(0, getCartReminderBatchSize());

  const processed: Array<{ orderId: string; orderNumber: string }> = [];
  const skipped: Array<{ orderId: string; reason: string }> = [];

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

  return {
    scanned: orders.length,
    eligible: eligibleOrders.length,
    processed,
    skipped,
    delayMinutes: getCartReminderDelayMinutes(),
  };
}
