import type { AlibabaPurchaseOrder } from "../../../../../lib/alibaba-operations";
import {
  applyResolvedAliExpressDsLogistics,
  type AliExpressDsDraft,
  buildAliExpressDsDraft,
  getAliExpressDsFreightFailure,
  isAliExpressDsDraft,
  type DraftOrderInput,
  runAliExpressDsFreightPrecheck,
} from "../../../../../lib/aliexpress-ds-automation";
import {
  createAlibabaBuyNowOrder,
  extractAlibabaOperationCode,
  extractAlibabaOperationMessage,
  extractAlibabaTradeId,
  isAlibabaOperationSuccessful,
} from "../../../../../lib/alibaba-open-platform-client";
import { getAlibabaPurchaseOrders, saveAlibabaPurchaseOrder } from "../../../../../lib/alibaba-operations-store";

function asString(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
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
    const customDraft = isAliExpressDsDraft(body?.custom_draft)
      ? body.custom_draft as AliExpressDsDraft
      : null;

    if (!order) {
      return Response.json({ message: "order est obligatoire." }, { status: 400 });
    }

    const initialDraft = customDraft ?? buildAliExpressDsDraft(order);
    const freightCheck = await runAliExpressDsFreightPrecheck(order, initialDraft);
    const freightFailure = getAliExpressDsFreightFailure(freightCheck);
    if (freightFailure) {
      return Response.json({
        success: false,
        message: freightFailure,
        freight_check: freightCheck,
      }, { status: 400 });
    }

    const draft = applyResolvedAliExpressDsLogistics(initialDraft, freightCheck);
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
        freight_check: freightCheck,
        raw_response: result.responseBody,
      }, { status: 400 });
    }

    return Response.json({
      success: true,
      external_order_id: tradeId || null,
      payment_warning: paymentWarning || null,
      supplier_status: supplierStatus,
      freight_check: freightCheck,
      raw_response: result.responseBody,
    });
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Creation DS echouee.",
    }, { status: 400 });
  }
}
