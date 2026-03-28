import {
  extractAlibabaOperationCode,
  extractAlibabaOperationMessage,
  getAlibabaIcbuProduct,
  isAlibabaOperationSuccessful,
  normalizeAlibabaIcbuProductInfo,
} from "@/lib/alibaba-open-platform-client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId") ?? undefined;
    const skuId = searchParams.get("skuId") ?? undefined;
    const result = await getAlibabaIcbuProduct({ productId, skuId });

    if (!result.ok || !isAlibabaOperationSuccessful(result.responseBody)) {
      return Response.json({
        message: extractAlibabaOperationMessage(result.responseBody) ?? "Lecture du produit AliExpress impossible.",
        code: extractAlibabaOperationCode(result.responseBody),
        responseBody: result.responseBody,
      }, { status: 400 });
    }

    return Response.json({
      productInfo: normalizeAlibabaIcbuProductInfo(result.responseBody),
      responseBody: result.responseBody,
    });
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Lecture du produit AliExpress impossible.",
    }, { status: 400 });
  }
}