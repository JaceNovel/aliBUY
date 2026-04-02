import {
  extractAlibabaOperationCode,
  extractAlibabaOperationMessage,
  isAlibabaOperationSuccessful,
  normalizeAliExpressSkuAttributeInfo,
  queryAliExpressSkuAttributes,
} from "@/lib/alibaba-open-platform-client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("category_id") ?? searchParams.get("categoryId") ?? undefined;
    const aliexpressCategoryId = searchParams.get("aliexpress_category_id") ?? searchParams.get("aliexpressCategoryId") ?? undefined;

    if (!categoryId && !aliexpressCategoryId) {
      return Response.json({ message: "categoryId ou aliexpressCategoryId est obligatoire." }, { status: 400 });
    }

    const result = await queryAliExpressSkuAttributes({ categoryId, aliexpressCategoryId });

    if (!result.ok || !isAlibabaOperationSuccessful(result.responseBody)) {
      return Response.json({
        message: extractAlibabaOperationMessage(result.responseBody) ?? "Lecture des attributs SKU AliExpress impossible.",
        code: extractAlibabaOperationCode(result.responseBody),
        responseBody: result.responseBody,
      }, { status: 400 });
    }

    const normalized = normalizeAliExpressSkuAttributeInfo(result.responseBody);
    return Response.json({
      commonAttributes: normalized.commonAttributes,
      skuAttributes: normalized.skuAttributes,
      responseBody: result.responseBody,
    });
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Lecture des attributs SKU AliExpress impossible.",
    }, { status: 400 });
  }
}