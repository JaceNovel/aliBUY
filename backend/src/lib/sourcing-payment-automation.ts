import "server-only";

import {
  createAlibabaDropshippingPayment,
  extractAlibabaOperationCode,
  extractAlibabaOperationMessage,
  isAlibabaOperationSuccessful,
  normalizeAlibabaLogisticsTracking,
  queryAlibabaOrderLogisticsTracking,
  queryAlibabaPaymentResult,
  type AlibabaLogisticsTracking,
} from "@/lib/alibaba-open-platform-client";
import { getSourcingOrderMeta, withSourcingOrderMeta, type SourcingOrder, type SourcingOrderStatus } from "@/lib/alibaba-sourcing";
import { createAlibabaIntegrationLog, saveSourcingOrder } from "@/lib/sourcing-store";

type TradeAutomationSnapshot = {
  tradeId: string;
  paymentRequestedAt?: string;
  paymentRequestStatus: "requested" | "skipped" | "failed";
  paymentRequestCode?: string;
  paymentRequestMessage?: string;
  payUrl?: string;
  paymentResponseBody?: unknown;
  paymentResultCheckedAt?: string;
  paymentResultStatus?: string;
  paymentResultCode?: string;
  paymentResultMessage?: string;
  paymentResultBody?: unknown;
  trackingCheckedAt?: string;
  trackingStatus?: "success" | "failed";
  trackingCode?: string;
  trackingMessage?: string;
  trackingResponseBody?: unknown;
  trackingList?: AlibabaLogisticsTracking[];
};

type PostPaymentAutomationState = {
  lastProcessedAt: string;
  lastTrigger: string;
  trades: TradeAutomationSnapshot[];
};

function nowIso() {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getObjectSupplierPayload(order: SourcingOrder) {
  if (isRecord(order.supplierOrderPayload)) {
    return { ...order.supplierOrderPayload };
  }

  return typeof order.supplierOrderPayload === "undefined"
    ? {}
    : { rawPayload: order.supplierOrderPayload };
}

function getExistingAutomationState(order: SourcingOrder): PostPaymentAutomationState | null {
  const payload = getObjectSupplierPayload(order);
  const automation = "automation" in payload ? payload.automation : undefined;
  const postPayment = isRecord(automation) && isRecord(automation.alibabaPostPayment)
    ? automation.alibabaPostPayment
    : null;

  if (!postPayment || !Array.isArray(postPayment.trades)) {
    return null;
  }

  return {
    lastProcessedAt: typeof postPayment.lastProcessedAt === "string" ? postPayment.lastProcessedAt : "",
    lastTrigger: typeof postPayment.lastTrigger === "string" ? postPayment.lastTrigger : "",
    trades: postPayment.trades.filter((entry): entry is TradeAutomationSnapshot => isRecord(entry) && typeof entry.tradeId === "string").map((entry) => ({
      tradeId: entry.tradeId,
      paymentRequestedAt: typeof entry.paymentRequestedAt === "string" ? entry.paymentRequestedAt : undefined,
      paymentRequestStatus: entry.paymentRequestStatus === "requested" || entry.paymentRequestStatus === "failed" ? entry.paymentRequestStatus : "skipped",
      paymentRequestCode: typeof entry.paymentRequestCode === "string" ? entry.paymentRequestCode : undefined,
      paymentRequestMessage: typeof entry.paymentRequestMessage === "string" ? entry.paymentRequestMessage : undefined,
      payUrl: typeof entry.payUrl === "string" ? entry.payUrl : undefined,
      paymentResponseBody: entry.paymentResponseBody,
      paymentResultCheckedAt: typeof entry.paymentResultCheckedAt === "string" ? entry.paymentResultCheckedAt : undefined,
      paymentResultStatus: typeof entry.paymentResultStatus === "string" ? entry.paymentResultStatus : undefined,
      paymentResultCode: typeof entry.paymentResultCode === "string" ? entry.paymentResultCode : undefined,
      paymentResultMessage: typeof entry.paymentResultMessage === "string" ? entry.paymentResultMessage : undefined,
      paymentResultBody: entry.paymentResultBody,
      trackingCheckedAt: typeof entry.trackingCheckedAt === "string" ? entry.trackingCheckedAt : undefined,
      trackingStatus: entry.trackingStatus === "failed" ? "failed" : entry.trackingStatus === "success" ? "success" : undefined,
      trackingCode: typeof entry.trackingCode === "string" ? entry.trackingCode : undefined,
      trackingMessage: typeof entry.trackingMessage === "string" ? entry.trackingMessage : undefined,
      trackingResponseBody: entry.trackingResponseBody,
      trackingList: Array.isArray(entry.trackingList) ? entry.trackingList as AlibabaLogisticsTracking[] : undefined,
    })),
  };
}

function withSupplierPayloadPatch(order: SourcingOrder, patch: Record<string, unknown>) {
  const payload = getObjectSupplierPayload(order);
  const automationValue = "automation" in payload ? payload.automation : undefined;
  const existingAutomation = isRecord(automationValue) ? automationValue : {};
  const meta = getSourcingOrderMeta(order);
  const nextOrder = {
    ...order,
    updatedAt: nowIso(),
    supplierOrderPayload: {
      ...payload,
      automation: {
        ...existingAutomation,
        ...patch,
      },
    },
  } satisfies SourcingOrder;

  return withSourcingOrderMeta(nextOrder, {
    deliveryProfile: meta.deliveryProfile,
    workflow: meta.workflow,
    promo: meta.promo,
    sharedCart: meta.sharedCart,
    paymentContext: meta.paymentContext,
    freeDeal: meta.freeDeal,
  });
}

function parsePaymentPayUrl(responseBody: unknown) {
  const response = isRecord(responseBody) ? responseBody : null;
  const value = isRecord(response?.value) ? response.value : null;
  const direct = typeof response?.pay_url === "string" ? response.pay_url : undefined;
  const nested = typeof value?.pay_url === "string" ? value.pay_url : undefined;
  return nested || direct;
}

function parseAlibabaPaymentStatus(responseBody: unknown) {
  const response = isRecord(responseBody) ? responseBody : null;
  const value = isRecord(response?.value) ? response.value : null;
  const status = typeof value?.status === "string"
    ? value.status
    : typeof response?.status === "string"
      ? response.status
      : undefined;

  return status?.trim().toLowerCase();
}

function compareStatusPriority(left: SourcingOrderStatus, right: SourcingOrderStatus) {
  const order = [
    "checkout_created",
    "grouped_sea",
    "ready_to_ship",
    "submitted_to_supplier",
    "air_batch_pending",
    "sea_batch_pending",
    "supplier_payment_requested",
    "supplier_payment_failed",
    "supplier_paid_partial",
    "supplier_paid",
    "shipment_triggered",
    "in_transit_to_agent",
    "delivered_to_agent",
    "relay_ready",
    "completed",
  ] as const;

  return order.indexOf(left) - order.indexOf(right);
}

function deriveStatusFromPayment(currentStatus: SourcingOrderStatus, trades: TradeAutomationSnapshot[]) {
  const paidCount = trades.filter((trade) => trade.paymentResultStatus === "paid").length;
  const hasPayUrl = trades.some((trade) => Boolean(trade.payUrl));
  const hasFailed = trades.some((trade) => trade.paymentRequestStatus === "failed" || trade.paymentResultStatus === "failed");
  const hasPending = trades.some((trade) => trade.paymentRequestStatus === "requested" || (typeof trade.paymentResultStatus === "string" && trade.paymentResultStatus !== "paid" && trade.paymentResultStatus !== "failed"));

  if (trades.length > 0 && paidCount === trades.length) {
    return compareStatusPriority(currentStatus, "supplier_paid") < 0 ? "supplier_paid" : currentStatus;
  }

  if (paidCount > 0) {
    return compareStatusPriority(currentStatus, "supplier_paid_partial") < 0 ? "supplier_paid_partial" : currentStatus;
  }

  if (hasPending) {
    return compareStatusPriority(currentStatus, "supplier_payment_requested") < 0 ? "supplier_payment_requested" : currentStatus;
  }

  if (hasPayUrl || hasFailed) {
    return compareStatusPriority(currentStatus, "supplier_payment_failed") < 0 ? "supplier_payment_failed" : currentStatus;
  }

  return currentStatus;
}

function deriveStatusFromTracking(currentStatus: SourcingOrderStatus, trades: TradeAutomationSnapshot[]) {
  const hasTracking = trades.some((trade) => (trade.trackingList ?? []).some((entry) => Boolean(entry.trackingNumber) || entry.eventList.length > 0));
  if (!hasTracking) {
    return currentStatus;
  }

  return compareStatusPriority(currentStatus, "shipment_triggered") < 0 ? "shipment_triggered" : currentStatus;
}

export async function runSourcingPostPaymentAutomation(order: SourcingOrder, trigger: "moneroo-verify" | "moneroo-webhook" | "admin-order-manual" | "admin-air-batch" | "admin-sea-batch") {
  if (order.paymentStatus !== "paid" || order.alibabaTradeIds.length === 0) {
    return order;
  }

  const existingState = getExistingAutomationState(order);
  const previousTrades = new Map((existingState?.trades ?? []).map((trade) => [trade.tradeId, trade] as const));
  const processedAt = nowIso();
  const tradeSnapshots: TradeAutomationSnapshot[] = [];

  for (const tradeId of order.alibabaTradeIds) {
    const previous = previousTrades.get(tradeId);
    const snapshot: TradeAutomationSnapshot = {
      tradeId,
      paymentRequestStatus: "skipped",
      payUrl: previous?.payUrl,
      paymentResultStatus: previous?.paymentResultStatus,
      trackingList: previous?.trackingList,
    };

    try {
      const shouldRequestPayment = previous?.paymentResultStatus !== "paid" && previous?.paymentResultStatus !== "pending" && !previous?.payUrl;

      if (shouldRequestPayment) {
        const paymentRequest = await createAlibabaDropshippingPayment({ tradeId });
        const paymentRequestOk = paymentRequest.ok && isAlibabaOperationSuccessful(paymentRequest.responseBody);
        snapshot.paymentRequestedAt = processedAt;
        snapshot.paymentRequestStatus = paymentRequestOk ? "requested" : "failed";
        snapshot.paymentRequestCode = extractAlibabaOperationCode(paymentRequest.responseBody);
        snapshot.paymentRequestMessage = extractAlibabaOperationMessage(paymentRequest.responseBody);
        snapshot.payUrl = parsePaymentPayUrl(paymentRequest.responseBody) || previous?.payUrl;
        snapshot.paymentResponseBody = paymentRequest.responseBody;

        await createAlibabaIntegrationLog({
          orderId: order.id,
          action: "supplier-payment-request",
          endpoint: "/alibaba/dropshipping/order/pay",
          status: paymentRequestOk ? "success" : "failed",
          requestBody: { tradeId, trigger },
          responseBody: paymentRequest.responseBody,
        });
      }

      const paymentResult = await queryAlibabaPaymentResult({ tradeId });
      const paymentResultOk = paymentResult.ok && isAlibabaOperationSuccessful(paymentResult.responseBody);
      snapshot.paymentResultCheckedAt = processedAt;
      snapshot.paymentResultStatus = parseAlibabaPaymentStatus(paymentResult.responseBody) || (paymentResultOk ? "pending" : previous?.paymentResultStatus);
      snapshot.paymentResultCode = extractAlibabaOperationCode(paymentResult.responseBody);
      snapshot.paymentResultMessage = extractAlibabaOperationMessage(paymentResult.responseBody);
      snapshot.paymentResultBody = paymentResult.responseBody;

      await createAlibabaIntegrationLog({
        orderId: order.id,
        action: "supplier-payment-result-query",
        endpoint: "/alibaba/order/pay/result/query",
        status: paymentResultOk ? "success" : "failed",
        requestBody: { tradeId, trigger },
        responseBody: paymentResult.responseBody,
      });

      const trackingResult = await queryAlibabaOrderLogisticsTracking({ tradeId });
      const trackingOk = trackingResult.ok && isAlibabaOperationSuccessful(trackingResult.responseBody);
      snapshot.trackingCheckedAt = processedAt;
      snapshot.trackingStatus = trackingOk ? "success" : "failed";
      snapshot.trackingCode = extractAlibabaOperationCode(trackingResult.responseBody);
      snapshot.trackingMessage = extractAlibabaOperationMessage(trackingResult.responseBody);
      snapshot.trackingResponseBody = trackingResult.responseBody;
      snapshot.trackingList = trackingOk ? normalizeAlibabaLogisticsTracking(trackingResult.responseBody) : (previous?.trackingList ?? []);

      await createAlibabaIntegrationLog({
        orderId: order.id,
        action: "supplier-logistics-tracking-sync",
        endpoint: "/order/logistics/tracking/get",
        status: trackingOk ? "success" : "failed",
        requestBody: { tradeId, trigger },
        responseBody: trackingResult.responseBody,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "alibaba_trade_automation_failed";
      snapshot.paymentRequestStatus = snapshot.paymentRequestStatus === "requested" ? snapshot.paymentRequestStatus : "failed";
      snapshot.paymentRequestMessage = snapshot.paymentRequestMessage || message;
      snapshot.paymentResultStatus = snapshot.paymentResultStatus || previous?.paymentResultStatus || "failed";
      snapshot.trackingStatus = "failed";
      snapshot.trackingMessage = message;

      await createAlibabaIntegrationLog({
        orderId: order.id,
        action: "supplier-post-payment-automation",
        endpoint: "internal",
        status: "failed",
        requestBody: { tradeId, trigger },
        responseBody: { message },
      });
    }

    tradeSnapshots.push(snapshot);
  }

  let nextOrder = withSupplierPayloadPatch(order, {
    alibabaPostPayment: {
      lastProcessedAt: processedAt,
      lastTrigger: trigger,
      trades: tradeSnapshots,
    },
  });

  nextOrder = {
    ...nextOrder,
    status: deriveStatusFromTracking(deriveStatusFromPayment(nextOrder.status, tradeSnapshots), tradeSnapshots),
    updatedAt: nowIso(),
  };

  await saveSourcingOrder(nextOrder);
  return nextOrder;
}
