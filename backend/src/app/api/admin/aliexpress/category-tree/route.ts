import {
  extractAlibabaOperationCode,
  extractAlibabaOperationMessage,
  getAliExpressPostCategoryTree,
  isAlibabaOperationSuccessful,
  normalizeAliExpressPostCategoryTree,
} from "@/lib/alibaba-open-platform-client";

function parseBoolean(value: string | null) {
  if (!value) {
    return undefined;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const result = await getAliExpressPostCategoryTree({
      categoryId: searchParams.get("category_id") ?? searchParams.get("categoryId") ?? undefined,
      onlyWithPermission: parseBoolean(searchParams.get("only_with_permission") ?? searchParams.get("onlyWithPermission")),
      channelSellerId: searchParams.get("channel_seller_id") ?? searchParams.get("channelSellerId") ?? undefined,
      channel: searchParams.get("channel") ?? undefined,
    });

    if (!result.ok || !isAlibabaOperationSuccessful(result.responseBody)) {
      return Response.json({
        message: extractAlibabaOperationMessage(result.responseBody) ?? "Lecture de l'arbre de categories AliExpress impossible.",
        code: extractAlibabaOperationCode(result.responseBody),
        responseBody: result.responseBody,
      }, { status: 400 });
    }

    return Response.json({
      categories: normalizeAliExpressPostCategoryTree(result.responseBody),
      responseBody: result.responseBody,
    });
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Lecture de l'arbre de categories AliExpress impossible.",
    }, { status: 400 });
  }
}