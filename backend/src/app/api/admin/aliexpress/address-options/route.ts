import {
  extractAlibabaOperationCode,
  extractAlibabaOperationMessage,
  isAlibabaOperationSuccessful,
  normalizeAliExpressDsAddressOptions,
  queryAliExpressDsAddress,
} from "@/lib/alibaba-open-platform-client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const countryCode = searchParams.get("countryCode") ?? searchParams.get("country_code") ?? undefined;
    const language = searchParams.get("language") ?? undefined;
    const isMultiLanguage = searchParams.get("isMultiLanguage") ?? searchParams.get("is_multi_language");
    const result = await queryAliExpressDsAddress({
      countryCode: countryCode ?? "",
      language,
      isMultiLanguage: typeof isMultiLanguage === "string" ? isMultiLanguage === "true" : undefined,
    });

    if (!result.ok || !isAlibabaOperationSuccessful(result.responseBody)) {
      return Response.json({
        message: extractAlibabaOperationMessage(result.responseBody) ?? "Lecture des options d'adresse DS AliExpress impossible.",
        code: extractAlibabaOperationCode(result.responseBody),
        responseBody: result.responseBody,
      }, { status: 400 });
    }

    return Response.json({
      options: normalizeAliExpressDsAddressOptions(result.responseBody),
      responseBody: result.responseBody,
    });
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Lecture des options d'adresse DS AliExpress impossible.",
    }, { status: 400 });
  }
}