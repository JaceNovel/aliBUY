import {
  extractAlibabaOperationCode,
  extractAlibabaOperationMessage,
  isAlibabaOperationSuccessful,
  normalizeAliExpressCategoryCascadeProperties,
  queryAliExpressCategoryCascadeProperties,
} from "@/lib/alibaba-open-platform-client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("category_id") ?? searchParams.get("categoryId");
    const locale = searchParams.get("locale");
    if (!categoryId || !locale) {
      return Response.json({ message: "categoryId et locale sont obligatoires." }, { status: 400 });
    }

    const result = await queryAliExpressCategoryCascadeProperties({ categoryId, locale });

    if (!result.ok || !isAlibabaOperationSuccessful(result.responseBody)) {
      return Response.json({
        message: extractAlibabaOperationMessage(result.responseBody) ?? "Lecture des proprietes en cascade AliExpress impossible.",
        code: extractAlibabaOperationCode(result.responseBody),
        responseBody: result.responseBody,
      }, { status: 400 });
    }

    return Response.json({
      properties: normalizeAliExpressCategoryCascadeProperties(result.responseBody),
      responseBody: result.responseBody,
    });
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Lecture des proprietes en cascade AliExpress impossible.",
    }, { status: 400 });
  }
}