import {
  extractAlibabaOperationCode,
  extractAlibabaOperationMessage,
  isAlibabaOperationSuccessful,
  normalizeAlibabaMergePayGroups,
  queryAlibabaMergePay,
} from "@/lib/alibaba-open-platform-client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const orderIds = Array.isArray(body?.orderIds)
      ? body.orderIds
      : Array.isArray(body?.order_ids)
        ? body.order_ids
        : [];
    const result = await queryAlibabaMergePay({ orderIds });

    if (!result.ok || !isAlibabaOperationSuccessful(result.responseBody)) {
      return Response.json({
        message: extractAlibabaOperationMessage(result.responseBody) ?? "Lecture du merge pay Alibaba impossible.",
        code: extractAlibabaOperationCode(result.responseBody),
        responseBody: result.responseBody,
      }, { status: 400 });
    }

    return Response.json({
      groups: normalizeAlibabaMergePayGroups(result.responseBody),
      responseBody: result.responseBody,
    });
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Lecture du merge pay Alibaba impossible.",
    }, { status: 400 });
  }
}