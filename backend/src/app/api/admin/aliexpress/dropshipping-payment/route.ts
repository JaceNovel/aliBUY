import {
  createAlibabaDropshippingPayment,
  extractAlibabaOperationCode,
  extractAlibabaOperationMessage,
  isAlibabaOperationSuccessful,
} from "@/lib/alibaba-open-platform-client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const paymentRequest = body?.paymentRequest && typeof body.paymentRequest === "object"
      ? body.paymentRequest as Record<string, unknown>
      : body?.param_order_pay_request && typeof body.param_order_pay_request === "object"
        ? body.param_order_pay_request as Record<string, unknown>
        : undefined;
    const result = await createAlibabaDropshippingPayment({
      tradeId: body?.tradeId ?? body?.trade_id,
      paymentRequest,
    });

    if (!result.ok || !isAlibabaOperationSuccessful(result.responseBody)) {
      return Response.json({
        message: extractAlibabaOperationMessage(result.responseBody) ?? "Paiement dropshipping AliExpress impossible.",
        code: extractAlibabaOperationCode(result.responseBody),
        responseBody: result.responseBody,
      }, { status: 400 });
    }

    return Response.json({ responseBody: result.responseBody });
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Paiement dropshipping AliExpress impossible.",
    }, { status: 400 });
  }
}