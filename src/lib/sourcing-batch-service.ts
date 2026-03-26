import "server-only";

import { createAlibabaSupplierOrders, verifyAlibabaSupplierFreight } from "@/lib/alibaba-open-platform-client";
import {
  AIR_BATCH_TARGET_KG,
  SEA_BATCH_TARGET_CBM,
  getSourcingAlibabaPayUrls,
  getSourcingAlibabaPaymentRollup,
  getSourcingOrderBatchMode,
  getSourcingOrderMeta,
  isSourcingOrderClientPaid,
  isSourcingOrderEligibleForSupplierPayment,
  type SourcingBatchMode,
  type SourcingOrder,
  type SourcingOrderStatus,
  withSourcingOrderMeta,
} from "@/lib/alibaba-sourcing";
import { appendOrderAutomationNotification } from "@/lib/customer-data-store";
import { runSourcingPostPaymentAutomation } from "@/lib/sourcing-payment-automation";
import { createAlibabaIntegrationLog, getAlibabaCatalogMappings, getSourcingOrderById, getSourcingOrders, saveSourcingOrder } from "@/lib/sourcing-store";

function nowIso() {
  return new Date().toISOString();
}

type NotificationState = {
  batchReadyModes: SourcingBatchMode[];
  payUrlKeys: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getObjectSupplierPayload(order: SourcingOrder): Record<string, unknown> {
  if (isRecord(order.supplierOrderPayload)) {
    return { ...order.supplierOrderPayload };
  }

  return typeof order.supplierOrderPayload === "undefined"
    ? {}
    : { rawPayload: order.supplierOrderPayload };
}

function getNotificationState(order: SourcingOrder): NotificationState {
  const payload = getObjectSupplierPayload(order);
  const notificationsValue = payload["notifications"];
  const notifications = isRecord(notificationsValue) ? notificationsValue : null;

  return {
    batchReadyModes: Array.isArray(notifications?.batchReadyModes)
      ? notifications.batchReadyModes.filter((entry): entry is SourcingBatchMode => entry === "air" || entry === "sea")
      : [],
    payUrlKeys: Array.isArray(notifications?.payUrlKeys)
      ? notifications.payUrlKeys.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [],
  };
}

function withNotificationState(order: SourcingOrder, state: NotificationState) {
  const payload = getObjectSupplierPayload(order);
  const existingNotificationsValue = payload["notifications"];
  const existingNotifications = isRecord(existingNotificationsValue) ? existingNotificationsValue : {};
  const meta = getSourcingOrderMeta(order);

  return {
    ...order,
    supplierOrderPayload: {
      ...payload,
      notifications: {
        ...existingNotifications,
        batchReadyModes: Array.from(new Set(state.batchReadyModes)),
        payUrlKeys: Array.from(new Set(state.payUrlKeys)),
      },
      __afripaySourcingMeta: {
        deliveryProfile: meta.deliveryProfile,
        workflow: meta.workflow,
        promo: meta.promo,
        sharedCart: meta.sharedCart,
        paymentContext: meta.paymentContext,
        freeDeal: meta.freeDeal,
      },
    },
  } satisfies SourcingOrder;
}

function getEligibleBatchOrders(orders: SourcingOrder[], mode: SourcingBatchMode) {
  return orders.filter((order) => isSourcingOrderEligibleForSupplierPayment(order) && getSourcingOrderBatchMode(order) === mode);
}

function isBatchReady(mode: SourcingBatchMode, orders: SourcingOrder[]) {
  if (mode === "air") {
    const totalWeight = orders.reduce((total, order) => total + order.totalWeightKg, 0);
    return totalWeight >= AIR_BATCH_TARGET_KG;
  }

  const totalCbm = orders.reduce((total, order) => total + order.totalVolumeCbm, 0);
  return totalCbm >= SEA_BATCH_TARGET_CBM;
}

async function persistOrderNotificationState(order: SourcingOrder, patch: Partial<NotificationState>) {
  const current = getNotificationState(order);
  const nextOrder = withNotificationState(order, {
    batchReadyModes: patch.batchReadyModes ?? current.batchReadyModes,
    payUrlKeys: patch.payUrlKeys ?? current.payUrlKeys,
  });

  if (nextOrder === order) {
    return order;
  }

  await saveSourcingOrder({
    ...nextOrder,
    updatedAt: nowIso(),
  });
  return nextOrder;
}

async function notifyBatchReadyForOrders(orders: SourcingOrder[], mode: SourcingBatchMode) {
  for (const order of orders) {
    const state = getNotificationState(order);
    if (state.batchReadyModes.includes(mode)) {
      continue;
    }

    const message = mode === "air"
      ? `Votre commande ${order.orderNumber} est maintenant dans un lot avion pret. Le groupe a atteint 2 kg et peut etre lance par notre equipe.`
      : `Votre commande ${order.orderNumber} est maintenant dans un lot maritime pret. Le groupe a atteint 1 CBM et peut etre lance par notre equipe.`;

    await appendOrderAutomationNotification({
      userId: order.userId,
      orderId: order.id,
      orderLabel: order.orderNumber,
      text: message,
    });

    await persistOrderNotificationState(order, {
      batchReadyModes: [...state.batchReadyModes, mode],
    });
  }
}

async function notifyOrderPayUrlRequired(previousOrder: SourcingOrder, nextOrder: SourcingOrder) {
  const previousPayUrls = new Set(getSourcingAlibabaPayUrls(previousOrder));
  const nextPayUrls = getSourcingAlibabaPayUrls(nextOrder);
  const state = getNotificationState(nextOrder);
  const freshPayUrls = nextPayUrls.filter((entry) => !previousPayUrls.has(entry) && !state.payUrlKeys.includes(entry));

  if (freshPayUrls.length === 0) {
    return nextOrder;
  }

  await appendOrderAutomationNotification({
    userId: nextOrder.userId,
    orderId: nextOrder.id,
    orderLabel: nextOrder.orderNumber,
    text: `Votre commande ${nextOrder.orderNumber} requiert une reprise manuelle de paiement fournisseur. Un lien de paiement Alibaba est disponible dans l'administration pour finaliser l'achat fournisseur.`,
  });

  return persistOrderNotificationState(nextOrder, {
    payUrlKeys: [...state.payUrlKeys, ...freshPayUrls],
  });
}

function getDeferredSupplierPaymentStatus(order: SourcingOrder): SourcingOrderStatus {
  const paymentRollup = getSourcingAlibabaPaymentRollup(order);
  const batchMode = getSourcingOrderBatchMode(order);

  if (paymentRollup === "paid") {
    return "supplier_paid";
  }

  if (paymentRollup === "partial") {
    return "supplier_paid_partial";
  }

  if (paymentRollup === "pending") {
    return "supplier_payment_requested";
  }

  if (paymentRollup === "failed" || paymentRollup === "pay_url_available") {
    return "supplier_payment_failed";
  }

  if (batchMode === "air") {
    return "air_batch_pending";
  }

  if (batchMode === "sea") {
    return "sea_batch_pending";
  }

  return order.status;
}

export async function syncSourcingOrderForDeferredSupplierPayment(order: SourcingOrder, trigger: "moneroo-verify" | "moneroo-webhook" | "admin-repair") {
  if (!isSourcingOrderEligibleForSupplierPayment(order)) {
    return order;
  }

  const allOrders = await getSourcingOrders();
  const mode = getSourcingOrderBatchMode(order);
  const previousEligibleOrders = mode ? getEligibleBatchOrders(allOrders, mode) : [];
  const previousReady = mode ? isBatchReady(mode, previousEligibleOrders) : false;

  const nextStatus = getDeferredSupplierPaymentStatus(order);
  const nextOrder: SourcingOrder = {
    ...order,
    status: nextStatus,
    updatedAt: nowIso(),
  };

  await saveSourcingOrder(nextOrder);
  await createAlibabaIntegrationLog({
    orderId: order.id,
    action: "supplier-payment-queued",
    endpoint: "internal",
    status: "success",
    requestBody: { trigger },
    responseBody: { status: nextStatus },
  });

  if (mode) {
    const nextOrders = allOrders.some((entry) => entry.id === nextOrder.id)
      ? allOrders.map((entry) => (entry.id === nextOrder.id ? nextOrder : entry))
      : [nextOrder, ...allOrders];
    const nextEligibleOrders = getEligibleBatchOrders(nextOrders, mode);
    const nextReady = isBatchReady(mode, nextEligibleOrders);

    if (nextReady && !previousReady) {
      await notifyBatchReadyForOrders(nextEligibleOrders, mode);
    } else if (nextReady) {
      await notifyBatchReadyForOrders(nextEligibleOrders.filter((entry) => entry.id === nextOrder.id), mode);
    }
  }

  return nextOrder;
}

export async function repairBlockedSourcingOrderForSupplierPayment(orderId: string) {
  const order = await getSourcingOrderById(orderId);
  if (!order) {
    throw new Error("Commande sourcing introuvable.");
  }

  if (!isSourcingOrderClientPaid(order)) {
    throw new Error("Cette commande n'est pas encore marquée comme payée côté client.");
  }

  const mappings = await getAlibabaCatalogMappings();
  const currentMeta = getSourcingOrderMeta(order);

  try {
    const freightVerification = await verifyAlibabaSupplierFreight(order, mappings);
    let nextOrder = withSourcingOrderMeta({
      ...order,
      freightStatus: freightVerification.freightStatus,
      freightPayload: freightVerification.freightPayload,
      updatedAt: nowIso(),
    }, currentMeta);

    await saveSourcingOrder(nextOrder);

    const supplierOrders = await createAlibabaSupplierOrders(nextOrder, mappings, freightVerification);
    nextOrder = withSourcingOrderMeta({
      ...nextOrder,
      supplierOrderStatus: supplierOrders.supplierOrderStatus,
      alibabaTradeIds: supplierOrders.alibabaTradeIds,
      supplierOrderPayload: supplierOrders.supplierOrderPayload,
      updatedAt: nowIso(),
    }, getSourcingOrderMeta(nextOrder));

    await saveSourcingOrder(nextOrder);
    await createAlibabaIntegrationLog({
      orderId: order.id,
      action: "supplier-preparation-repair",
      endpoint: "internal",
      status: "success",
      requestBody: { orderNumber: order.orderNumber },
      responseBody: {
        freightStatus: nextOrder.freightStatus,
        supplierOrderStatus: nextOrder.supplierOrderStatus,
        alibabaTradeIds: nextOrder.alibabaTradeIds,
      },
    });

    return syncSourcingOrderForDeferredSupplierPayment(nextOrder, "admin-repair");
  } catch (error) {
    const message = error instanceof Error ? error.message : "supplier_preparation_repair_failed";
    const failedOrder = withSourcingOrderMeta({
      ...order,
      freightStatus: "failed",
      supplierOrderStatus: "failed",
      supplierOrderPayload: { failed: true, reason: message },
      updatedAt: nowIso(),
    }, currentMeta);
    await saveSourcingOrder(failedOrder);
    await createAlibabaIntegrationLog({
      orderId: order.id,
      action: "supplier-preparation-repair",
      endpoint: "internal",
      status: "failed",
      requestBody: { orderNumber: order.orderNumber },
      responseBody: { message },
    });
    throw error;
  }
}

export async function launchSourcingSupplierPaymentForOrder(orderId: string, trigger: "admin-order-manual") {
  const order = await getSourcingOrderById(orderId);
  if (!order) {
    throw new Error("Commande sourcing introuvable.");
  }

  if (!isSourcingOrderEligibleForSupplierPayment(order)) {
    throw new Error("Cette commande n'est pas eligible au lancement fournisseur.");
  }

  const nextOrder = await runSourcingPostPaymentAutomation(order, trigger);
  return notifyOrderPayUrlRequired(order, nextOrder);
}

export async function launchSourcingSupplierPaymentBatch(mode: SourcingBatchMode) {
  const orders = await getSourcingOrders();
  const eligibleOrders = orders
    .filter((order) => isSourcingOrderEligibleForSupplierPayment(order) && getSourcingOrderBatchMode(order) === mode)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  const processedOrders: SourcingOrder[] = [];
  const failures: Array<{ orderId: string; message: string }> = [];

  for (const order of eligibleOrders) {
    try {
      const automatedOrder = await runSourcingPostPaymentAutomation(order, mode === "air" ? "admin-air-batch" : "admin-sea-batch");
      processedOrders.push(await notifyOrderPayUrlRequired(order, automatedOrder));
    } catch (error) {
      const message = error instanceof Error ? error.message : "supplier_batch_launch_failed";
      failures.push({ orderId: order.id, message });
      await createAlibabaIntegrationLog({
        orderId: order.id,
        action: "supplier-batch-launch",
        endpoint: "internal",
        status: "failed",
        requestBody: { mode },
        responseBody: { message },
      });
    }
  }

  return {
    processedOrders,
    processedCount: processedOrders.length,
    failedCount: failures.length,
    failures,
  };
}