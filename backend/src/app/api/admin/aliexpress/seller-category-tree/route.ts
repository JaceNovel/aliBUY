import {
  extractAlibabaOperationCode,
  extractAlibabaOperationMessage,
  isAlibabaOperationSuccessful,
  normalizeAliExpressSellerCategoryTree,
  queryAliExpressSellerCategoryTree,
} from "@/lib/alibaba-open-platform-client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("category_id") ?? searchParams.get("categoryId") ?? "0";
    const filterNoPermission = ["1", "true", "yes", "on"].includes((searchParams.get("filter_no_permission") ?? searchParams.get("filterNoPermission") ?? "true").trim().toLowerCase());
    const result = await queryAliExpressSellerCategoryTree({
      categoryId,
      filterNoPermission,
    });

    if (!result.ok || !isAlibabaOperationSuccessful(result.responseBody)) {
      return Response.json({
        message: extractAlibabaOperationMessage(result.responseBody) ?? "Lecture de l'arbre vendeur AliExpress impossible.",
        code: extractAlibabaOperationCode(result.responseBody),
        responseBody: result.responseBody,
      }, { status: 400 });
    }

    return Response.json({
      categories: normalizeAliExpressSellerCategoryTree(result.responseBody),
      responseBody: result.responseBody,
    });
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Lecture de l'arbre vendeur AliExpress impossible.",
    }, { status: 400 });
  }
}