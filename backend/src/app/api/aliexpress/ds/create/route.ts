import type { AlibabaPurchaseOrder } from "../../../../../lib/alibaba-operations";
import {
  createAlibabaBuyNowOrder,
  extractAlibabaOperationCode,
  extractAlibabaOperationMessage,
  extractAlibabaTradeId,
  isAlibabaOperationSuccessful,
} from "../../../../../lib/alibaba-open-platform-client";
import { getAlibabaPurchaseOrders, saveAlibabaPurchaseOrder } from "../../../../../lib/alibaba-operations-store";

type DraftOrderItem = {
  product_id?: string;
  sku_attr?: string;
  qty?: number;
  logistics_service_name?: string;
  memo?: string;
};

type DraftOrderInput = {
  id?: string | number;
  local_order_id?: string | number;
  shipping_address?: Record<string, unknown>;
  items?: DraftOrderItem[];
};

function asString(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function buildDraft(order: DraftOrderInput) {
  const items = Array.isArray(order.items) ? order.items : [];
  if (items.length === 0) {
    throw new Error("Aucun item a commander.");
  }

  const productItems = items.map((line, index) => {
    const productId = asString(line.product_id).trim();
    const skuAttr = asString(line.sku_attr).trim();
    if (!productId) {
      throw new Error(`Ligne #${index + 1}: product_id manquant.`);
    }
    if (!skuAttr) {
      throw new Error(`Ligne #${index + 1}: sku_attr manquant.`);
    }

    return {
      product_id: productId,
      sku_attr: skuAttr,
      product_count: String(Math.max(1, Number(line.qty ?? 1) || 1)),
      logistics_service_name: asString(line.logistics_service_name || "AliExpress Selection Standard"),
      order_memo: asString(line.memo || `Order #${order.id ?? "N/A"}`),
    };
  });

  return {
    ds_extend_request: {
      payment: {
        pay_currency: process.env.ALIEXPRESS_DS_PAYMENT_CURRENCY || "USD",
        try_to_pay: "true",
      },
    },
    param_place_order_request4_open_api_d_t_o: {
      out_order_id: `ds-${asString(order.id || Date.now()).replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 61)}`,
      logistics_address: order.shipping_address && typeof order.shipping_address === "object"
        ? order.shipping_address
        : {},
      product_items: productItems,
    },
  };
}

function isAutoPayWarning(message?: string) {
  const value = (message || "").toLowerCase();
  return value.includes("autopay fail") || value.includes("api pay fail") || value.includes("apipayfail");
}

async function persistLocalOrder(input: {
  localOrderId?: string;
  tradeId?: string;
  supplierStatus: "paid" | "pending" | "failed";
  paymentWarning?: string;
  draftPayload: Record<string, unknown>;
  rawResponse: unknown;
}) {
  if (!input.localOrderId) {
    return;
  }

  const orders = await getAlibabaPurchaseOrders();
  const existing = orders.find((entry: AlibabaPurchaseOrder) => entry.id === input.localOrderId);
  if (!existing) {
    return;
  }

  const nextOrder: AlibabaPurchaseOrder = {
    ...existing,
    tradeId: input.tradeId || existing.tradeId,
    buyNowPayload: input.draftPayload,
    orderStatus: input.tradeId ? "order_created" : "failed",
    paymentStatus: input.supplierStatus === "paid"
      ? "paid"
      : input.supplierStatus === "failed"
        ? "failed"
        : "pending",
    payFailureReason: input.paymentWarning || (input.tradeId ? undefined : "Creation DS echouee."),
    rawOrderResponse: input.rawResponse,
    updatedAt: new Date().toISOString(),
  };

  await saveAlibabaPurchaseOrder(nextOrder);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const order = body?.order && typeof body.order === "object" ? body.order as DraftOrderInput : null;
    const customDraft = body?.custom_draft && typeof body.custom_draft === "object"
      ? body.custom_draft as Record<string, unknown>
      : null;

    if (!order) {
      return Response.json({ message: "order est obligatoire." }, { status: 400 });
    }

    const draft = customDraft ?? buildDraft(order);
    const result = await createAlibabaBuyNowOrder(draft);
    const success = result.ok && isAlibabaOperationSuccessful(result.responseBody);
    const tradeId = extractAlibabaTradeId(result.responseBody) || undefined;
    const opMessage = extractAlibabaOperationMessage(result.responseBody) || undefined;
    const paymentWarning = success && isAutoPayWarning(opMessage) ? opMessage : undefined;
    const supplierStatus: "paid" | "pending" | "failed" = success
      ? (paymentWarning ? "pending" : "paid")
      : "failed";

    await persistLocalOrder({
      localOrderId: asString(order.local_order_id || order.id).trim() || undefined,
      tradeId,
      supplierStatus,
      paymentWarning,
      draftPayload: draft,
      rawResponse: result.responseBody,
    });

    if (!success) {
      return Response.json({
        success: false,
        message: opMessage || "Creation DS echouee.",
        code: extractAlibabaOperationCode(result.responseBody),
        raw_response: result.responseBody,
      }, { status: 400 });
    }

    return Response.json({
      success: true,
      external_order_id: tradeId || null,
      payment_warning: paymentWarning || null,
      supplier_status: supplierStatus,
      raw_response: result.responseBody,
    });
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Creation DS echouee.",
    }, { status: 400 });
  }
}
