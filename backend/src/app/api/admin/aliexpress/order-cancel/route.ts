import {
  cancelAlibabaOrder,
  extractAlibabaOperationCode,
  extractAlibabaOperationMessage,
  isAlibabaOperationSuccessful,
} from "@/lib/alibaba-open-platform-client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await cancelAlibabaOrder({
      tradeId: body?.tradeId ?? body?.trade_id,
    });

    if (!result.ok || !isAlibabaOperationSuccessful(result.responseBody)) {
      return Response.json({
        message: extractAlibabaOperationMessage(result.responseBody) ?? "Annulation de commande AliExpress impossible.",
        code: extractAlibabaOperationCode(result.responseBody),
        responseBody: result.responseBody,
      }, { status: 400 });
    }

    return Response.json({ responseBody: result.responseBody });
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Annulation de commande AliExpress impossible.",
    }, { status: 400 });
  }
}