import {
  createAlibabaIcbuProductListing,
  extractAlibabaOperationCode,
  extractAlibabaOperationMessage,
  isAlibabaOperationSuccessful,
} from "@/lib/alibaba-open-platform-client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await createAlibabaIcbuProductListing({
      productInfo: body?.productInfo && typeof body.productInfo === "object" ? body.productInfo as Record<string, unknown> : {},
      aiOptimizationConfig: body?.aiOptimizationConfig && typeof body.aiOptimizationConfig === "object"
        ? {
            keywordOptimizationEnabled: body.aiOptimizationConfig.keywordOptimizationEnabled !== false,
            descriptionOptimizationEnabled: body.aiOptimizationConfig.descriptionOptimizationEnabled !== false,
            titleOptimizationEnabled: body.aiOptimizationConfig.titleOptimizationEnabled !== false,
          }
        : undefined,
    });

    if (!result.ok || !isAlibabaOperationSuccessful(result.responseBody)) {
      return Response.json({
        message: extractAlibabaOperationMessage(result.responseBody) ?? "Creation de fiche AliExpress impossible.",
        code: extractAlibabaOperationCode(result.responseBody),
        responseBody: result.responseBody,
      }, { status: 400 });
    }

    return Response.json({ responseBody: result.responseBody });
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Creation de fiche AliExpress impossible.",
    }, { status: 400 });
  }
}