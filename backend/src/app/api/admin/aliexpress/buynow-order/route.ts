import {
  createAlibabaBuyNowOrder,
  extractAlibabaOperationCode,
  extractAlibabaOperationMessage,
  isAlibabaOperationSuccessful,
} from "@/lib/alibaba-open-platform-client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = body?.payload && typeof body.payload === "object"
      ? body.payload as Record<string, unknown>
      : body && typeof body === "object"
        ? body as Record<string, unknown>
        : {};
    const result = await createAlibabaBuyNowOrder(payload);

    if (!result.ok || !isAlibabaOperationSuccessful(result.responseBody)) {
      return Response.json({
        message: extractAlibabaOperationMessage(result.responseBody) ?? "Creation de commande BuyNow AliExpress impossible.",
        code: extractAlibabaOperationCode(result.responseBody),
        responseBody: result.responseBody,
      }, { status: 400 });
    }

    return Response.json({ responseBody: result.responseBody });
  } catch (error) {
    return Response.json({
      message: error instanceof Error ? error.message : "Creation de commande BuyNow AliExpress impossible.",
    }, { status: 400 });
  }
}