import {
  extractAlibabaOperationCode,
  extractAlibabaOperationMessage,
  isAlibabaOperationSuccessful,
  normalizeAlibabaLogisticsTracking,
  queryAlibabaOrderLogisticsTracking,
} from "@/lib/alibaba-open-platform-client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tradeId = searchParams.get("tradeId") ?? searchParams.get("trade_id") ?? undefined;
    const result = await queryAlibabaOrderLogisticsTracking({ tradeId: tradeId ?? "" });

    if (!result.ok || !isAlibabaOperationSuccessful(result.responseBody)) {
      return Response.json({
        message: extractAlibabaOperationMessage(result.responseBody) ?? "Lecture du suivi logistique AliExpress impossible.",
        code: extractAlibabaOperationCode(result.responseBody),
        responseBody: result.responseBody,
      }, { status: 400 });
    }

    return Response.json({
      trackingList: normalizeAlibabaLogisticsTracking(result.responseBody),
      responseBody: result.responseBody,
    });
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Lecture du suivi logistique AliExpress impossible.",
    }, { status: 400 });
  }
}