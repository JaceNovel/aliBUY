import {
  extractAlibabaOperationCode,
  extractAlibabaOperationMessage,
  getAliExpressPostCategoryChildAttributes,
  isAlibabaOperationSuccessful,
  normalizeAliExpressPostCategoryChildAttributes,
} from "@/lib/alibaba-open-platform-client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const attributePathParts = searchParams.getAll("param2").concat(searchParams.getAll("path"));
    const attributePath = attributePathParts.length > 1
      ? attributePathParts
      : (attributePathParts[0] ?? searchParams.get("param2") ?? searchParams.get("path") ?? undefined);
    const result = await getAliExpressPostCategoryChildAttributes({
      postCategoryId: searchParams.get("param1") ?? searchParams.get("postCategoryId") ?? searchParams.get("categoryId") ?? undefined,
      attributePath,
      locale: searchParams.get("locale") ?? undefined,
      channelSellerId: searchParams.get("channel_seller_id") ?? searchParams.get("channelSellerId") ?? undefined,
      channel: searchParams.get("channel") ?? undefined,
      productType: searchParams.get("product_type") ?? searchParams.get("productType") ?? undefined,
    });

    if (!result.ok || !isAlibabaOperationSuccessful(result.responseBody)) {
      return Response.json({
        message: extractAlibabaOperationMessage(result.responseBody) ?? "Lecture des attributs enfants AliExpress impossible.",
        code: extractAlibabaOperationCode(result.responseBody),
        responseBody: result.responseBody,
      }, { status: 400 });
    }

    return Response.json({
      attributes: normalizeAliExpressPostCategoryChildAttributes(result.responseBody),
      responseBody: result.responseBody,
    });
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Lecture des attributs enfants AliExpress impossible.",
    }, { status: 400 });
  }
}