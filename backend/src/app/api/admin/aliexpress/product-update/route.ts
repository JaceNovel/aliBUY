import {
  extractAlibabaOperationCode,
  extractAlibabaOperationMessage,
  isAlibabaOperationSuccessful,
  updateAlibabaIcbuProduct,
} from "@/lib/alibaba-open-platform-client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await updateAlibabaIcbuProduct({
      productInfo: body?.productInfo && typeof body.productInfo === "object" ? body.productInfo as Record<string, unknown> : {},
    });

    if (!result.ok || !isAlibabaOperationSuccessful(result.responseBody)) {
      return Response.json({
        message: extractAlibabaOperationMessage(result.responseBody) ?? "Mise a jour de fiche Alibaba impossible.",
        code: extractAlibabaOperationCode(result.responseBody),
        responseBody: result.responseBody,
      }, { status: 400 });
    }

    return Response.json({ responseBody: result.responseBody });
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Mise a jour de fiche Alibaba impossible.",
    }, { status: 400 });
  }
}