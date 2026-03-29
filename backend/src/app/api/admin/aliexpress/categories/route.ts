import {
  extractAlibabaOperationCode,
  extractAlibabaOperationMessage,
  getAlibabaIcbuCategories,
  isAlibabaOperationSuccessful,
  normalizeAlibabaIcbuCategories,
} from "@/lib/alibaba-open-platform-client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parentCategoryId = searchParams.get("parentCategoryId") ?? undefined;
    const language = searchParams.get("language") ?? undefined;
    const appSignature = searchParams.get("appSignature") ?? searchParams.get("app_signature") ?? undefined;
    const result = await getAlibabaIcbuCategories({ parentCategoryId, language, appSignature });

    if (!result.ok || !isAlibabaOperationSuccessful(result.responseBody)) {
      return Response.json({
        message: extractAlibabaOperationMessage(result.responseBody) ?? "Lecture des categories AliExpress impossible.",
        code: extractAlibabaOperationCode(result.responseBody),
        responseBody: result.responseBody,
      }, { status: 400 });
    }

    return Response.json({
      categories: normalizeAlibabaIcbuCategories(result.responseBody),
      responseBody: result.responseBody,
    });
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Lecture des categories AliExpress impossible.",
    }, { status: 400 });
  }
}