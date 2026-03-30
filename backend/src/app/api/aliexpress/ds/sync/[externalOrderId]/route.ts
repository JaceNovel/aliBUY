import type { AlibabaPurchaseOrder } from "../../../../../../lib/alibaba-operations";
import {
  extractAlibabaOperationCode,
  extractAlibabaOperationMessage,
  isAlibabaOperationSuccessful,
  normalizeAlibabaLogisticsTracking,
  queryAlibabaOrderLogisticsTracking,
  queryAlibabaPaymentResult,
} from "../../../../../../lib/alibaba-open-platform-client";
import { getAlibabaPurchaseOrders, saveAlibabaPurchaseOrder } from "../../../../../../lib/alibaba-operations-store";

function asString(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function findFirstStringByKeys(payload: unknown, keys: string[]) {
  const needle = new Set(keys.map((key) => key.toLowerCase()));
  const stack: unknown[] = [payload];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object") {
      continue;
    }

    for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
      if (value && typeof value === "object") {
        stack.push(value);
      }

      if (needle.has(key.toLowerCase())) {
        const text = asString(value).trim();
        if (text) {
          return text;
        }
      }
    }
  }

  return null;
}

function mapSupplierStatus(orderStatus?: string | null, logisticsStatus?: string | null) {
  const order = asString(orderStatus).toUpperCase();
  const logistics = asString(logisticsStatus).toUpperCase();

  if (order === "FIN" || logistics === "BUYER_ACCEPT_GOODS") {
    return "delivered";
  }

  if (["SELLER_SEND_PART_GOODS", "WAIT_BUYER_ACCEPT_GOODS"].includes(order)
    || ["SELLER_SEND_GOODS", "SELLER_SEND_PART_GOODS"].includes(logistics)) {
    return "delivering";
  }

  if (["PLACE_ORDER_SUCCESS", "PAYMENT_PROCESSING", "WAIT_SELLER_SEND_GOODS"].includes(order)) {
    return "paid";
  }

  return "pending";
}

async function persistLocalSync(input: {
  externalOrderId: string;
  supplierStatus: string;
  remoteOrderStatus?: string | null;
  remoteLogisticsStatus?: string | null;
  trackingNumber?: string | null;
  shippingProviderName?: string | null;
  orderRaw: unknown;
  trackingRaw: unknown;
}) {
  const orders = await getAlibabaPurchaseOrders();
  const existing = orders.find((entry: AlibabaPurchaseOrder) => asString(entry.tradeId).trim() === input.externalOrderId);
  if (!existing) {
    return;
  }

  const nextOrder: AlibabaPurchaseOrder = {
    ...existing,
    orderStatus: input.supplierStatus === "delivered"
      ? "paid"
      : input.supplierStatus === "paid"
        ? "payment_pending"
        : existing.orderStatus,
    paymentStatus: input.supplierStatus === "paid" || input.supplierStatus === "delivered"
      ? "paid"
      : existing.paymentStatus,
    rawOrderResponse: input.orderRaw,
    rawPaymentResponse: {
      ...(existing.rawPaymentResponse && typeof existing.rawPaymentResponse === "object"
        ? existing.rawPaymentResponse as Record<string, unknown>
        : {}),
      sync: {
        remote_order_status: input.remoteOrderStatus,
        remote_logistics_status: input.remoteLogisticsStatus,
        tracking_number: input.trackingNumber,
        shipping_provider_name: input.shippingProviderName,
        tracking_raw: input.trackingRaw,
      },
    },
    updatedAt: new Date().toISOString(),
  };

  await saveAlibabaPurchaseOrder(nextOrder);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ externalOrderId: string }> },
) {
  try {
    const { externalOrderId } = await params;
    const tradeId = asString(externalOrderId).trim();
    if (!tradeId) {
      return Response.json({ message: "externalOrderId est obligatoire." }, { status: 400 });
    }

    const orderResult = await queryAlibabaPaymentResult({ tradeId });
    if (!orderResult.ok || !isAlibabaOperationSuccessful(orderResult.responseBody)) {
      return Response.json({
        message: extractAlibabaOperationMessage(orderResult.responseBody) || "Lecture du statut commande DS impossible.",
        code: extractAlibabaOperationCode(orderResult.responseBody),
        responseBody: orderResult.responseBody,
      }, { status: 400 });
    }

    const trackingResult = await queryAlibabaOrderLogisticsTracking({ tradeId });
    if (!trackingResult.ok || !isAlibabaOperationSuccessful(trackingResult.responseBody)) {
      return Response.json({
        message: extractAlibabaOperationMessage(trackingResult.responseBody) || "Lecture du suivi DS impossible.",
        code: extractAlibabaOperationCode(trackingResult.responseBody),
        responseBody: trackingResult.responseBody,
      }, { status: 400 });
    }

    const trackingList = normalizeAlibabaLogisticsTracking(trackingResult.responseBody);
    const trackingNumber = trackingList[0]?.trackingNumber || findFirstStringByKeys(trackingResult.responseBody, ["tracking_no", "trackingNumber", "tracking_number"]);
    const shippingProviderName = trackingList[0]?.carrier || findFirstStringByKeys(trackingResult.responseBody, ["service_name", "company_name", "logistics_company"]);
    const remoteOrderStatus = findFirstStringByKeys(orderResult.responseBody, ["order_status", "orderStatus"]);
    const remoteLogisticsStatus = findFirstStringByKeys(trackingResult.responseBody, ["logistics_status", "logisticsStatus"]);
    const supplierStatus = mapSupplierStatus(remoteOrderStatus, remoteLogisticsStatus);

    await persistLocalSync({
      externalOrderId: tradeId,
      supplierStatus,
      remoteOrderStatus,
      remoteLogisticsStatus,
      trackingNumber,
      shippingProviderName,
      orderRaw: orderResult.responseBody,
      trackingRaw: trackingResult.responseBody,
    });

    return Response.json({
      external_order_id: tradeId,
      remote_order_status: remoteOrderStatus,
      remote_logistics_status: remoteLogisticsStatus,
      tracking_number: trackingNumber,
      shipping_provider_name: shippingProviderName,
      supplier_status: supplierStatus,
      order_raw: orderResult.responseBody,
      tracking_raw: trackingResult.responseBody,
    });
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Synchronisation DS impossible.",
    }, { status: 400 });
  }
}
