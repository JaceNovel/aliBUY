import {
  extractAlibabaOperationCode,
  extractAlibabaOperationMessage,
  getAliExpressCategoryItemQualifications,
  isAlibabaOperationSuccessful,
  normalizeAliExpressCategoryQualifications,
} from "@/lib/alibaba-open-platform-client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("category_id") ?? searchParams.get("categoryId");
    if (!categoryId) {
      return Response.json({ message: "categoryId est obligatoire." }, { status: 400 });
    }

    const result = await getAliExpressCategoryItemQualifications({
      categoryId,
      locale: searchParams.get("local") ?? searchParams.get("locale") ?? undefined,
      channelSellerId: searchParams.get("channel_seller_id") ?? searchParams.get("channelSellerId") ?? undefined,
    });

    if (!result.ok || !isAlibabaOperationSuccessful(result.responseBody)) {
      return Response.json({
        message: extractAlibabaOperationMessage(result.responseBody) ?? "Lecture des qualifications categorie AliExpress impossible.",
        code: extractAlibabaOperationCode(result.responseBody),
        responseBody: result.responseBody,
      }, { status: 400 });
    }

    const payload = result.responseBody && typeof result.responseBody === "object" ? result.responseBody as Record<string, unknown> : null;
    return Response.json({
      support: payload ? payload.support : undefined,
      qualifications: normalizeAliExpressCategoryQualifications(result.responseBody),
      responseBody: result.responseBody,
    });
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Lecture des qualifications categorie AliExpress impossible.",
    }, { status: 400 });
  }
}